#!/usr/bin/env node
/**
 * Verify database bootstrap references resolve to existing files and flag
 * greenfield SQL hazards in consolidated baselines.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');

const INCLUDE_RE = /include_str!\(\s*"([^"]+\.sql)"/g;
const PATH_RE = /database\/ddl\/baseline\/[^\s"'`]+\.sql|database\/migrations\/[^\s"'`]+\.sql/g;

function parseArgs(argv) {
  const args = { workspace: WORKSPACE_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--workspace') {
      args.workspace = path.resolve(argv[index + 1] ?? '');
      index += 1;
    }
  }
  return args;
}

function listRepos(workspace) {
  return fs
    .readdirSync(workspace, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspace, entry.name))
    .filter((repoRoot) => fs.existsSync(path.join(repoRoot, 'database', 'database.manifest.json')));
}

function walkSourceFiles(rootDir, files = []) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (['node_modules', 'target', '.git', '.runtime', 'dist'].includes(entry.name)) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(fullPath, files);
      continue;
    }
    if (/\.(rs|mjs|js|py|json)$/u.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveSqlPath(repoRoot, rawPath) {
  const normalized = rawPath.replaceAll('\\', '/');
  if (path.isAbsolute(normalized)) {
    return normalized;
  }
  return path.normalize(path.join(repoRoot, normalized));
}

function stripSqlComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
}

function isRetiredStub(sql) {
  return !/CREATE\s+TABLE/iu.test(stripSqlComments(sql));
}

function checkBaselineDir(repoRoot, engine, issues) {
  const dir = path.join(repoRoot, 'database', 'ddl', 'baseline', engine);
  if (!fs.existsSync(dir)) {
    return;
  }
  const sqlFiles = fs.readdirSync(dir).filter((name) => name.endsWith('.sql'));
  const primary = sqlFiles.filter((name) => /^0001_.*_baseline\.sql$/u.test(name));
  const stubs = sqlFiles.filter((name) => !/^0001_.*_baseline\.sql$/u.test(name));
  if (primary.length !== 1) {
    issues.push(`${engine}: expected exactly one 0001_*_baseline.sql (found ${primary.length})`);
  }
  for (const stub of stubs) {
    const sql = fs.readFileSync(path.join(dir, stub), 'utf8');
    if (!isRetiredStub(sql)) {
      issues.push(`${engine}/${stub}: supplemental baseline must be retired stub without CREATE TABLE`);
    }
  }
  if (engine === 'sqlite' && primary.length === 1) {
    const sql = stripSqlComments(fs.readFileSync(path.join(dir, primary[0]), 'utf8'));
    if (/CREATE\s+EXTENSION/iu.test(sql)) {
      issues.push(`${engine}/${primary[0]}: sqlite baseline must not CREATE EXTENSION`);
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const failures = [];

  for (const repoRoot of listRepos(args.workspace)) {
    const repoName = path.basename(repoRoot);
    const repoIssues = [];

    for (const filePath of walkSourceFiles(repoRoot)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (filePath.endsWith('.rs')) {
        for (const match of content.matchAll(INCLUDE_RE)) {
          const resolved = resolveSqlPath(path.dirname(filePath), match[1]);
          if (!fs.existsSync(resolved)) {
            repoIssues.push(`missing include_str target: ${match[1]} (${path.relative(repoRoot, filePath)})`);
          }
        }
      }
      for (const match of content.matchAll(PATH_RE)) {
        if (!match[0].startsWith('database/ddl/baseline/')) {
          continue;
        }
        if (match[0].includes('_legacy_baseline') || match[0].includes('_catalog_baseline')) {
          const resolved = resolveSqlPath(repoRoot, match[0]);
          if (!fs.existsSync(resolved)) {
            repoIssues.push(`stale baseline path: ${match[0]} (${path.relative(repoRoot, filePath)})`);
          }
        }
      }
    }

    checkBaselineDir(repoRoot, 'postgres', repoIssues);
    checkBaselineDir(repoRoot, 'sqlite', repoIssues);

    if (repoIssues.length > 0) {
      failures.push({ repo: repoName, issues: repoIssues });
    }
  }

  if (failures.length === 0) {
    console.log('check-database-bootstrap-references: PASS');
    return;
  }

  console.error('check-database-bootstrap-references: FAIL');
  for (const entry of failures) {
    console.error(`\n${entry.repo}:`);
    for (const issue of entry.issues) {
      console.error(`  - ${issue}`);
    }
  }
  process.exit(1);
}

main();
