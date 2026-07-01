#!/usr/bin/env node
/**
 * Per-repo verification that application databases are in initialization state
 * per DATABASE_FRAMEWORK_SPEC.md and check-database-framework-standard.mjs.
 *
 * Usage:
 *   node verify-database-initialization-state.mjs --workspace <dir> [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDatabaseFramework } from './check-database-framework-standard.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');

const REQUIRED_DB_SCRIPTS = [
  'db:validate',
  'db:plan',
  'db:init',
  'db:migrate',
  'db:seed',
  'db:status',
  'db:drift',
  'db:drift:check',
  'db:materialize:contract',
  'db:bootstrap',
];

const REQUIRED_LOCALES = ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'ru-RU', 'ko-KR'];

function isRetiredBaselineStub(sql) {
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return !/CREATE\s+TABLE/iu.test(withoutComments);
}

function parseArgs(argv) {
  const args = { workspace: WORKSPACE_ROOT, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--workspace') {
      args.workspace = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--json') {
      args.json = true;
    }
  }
  return args;
}

function normalizeModuleId(moduleId) {
  return String(moduleId ?? 'module')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function listRepos(workspaceRoot) {
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(workspaceRoot, name, 'database', 'database.manifest.json')))
    .sort();
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function verifyRepo(workspaceRoot, repoName) {
  const repoRoot = path.join(workspaceRoot, repoName);
  const databaseDir = path.join(repoRoot, 'database');
  const manifest = readJson(path.join(databaseDir, 'database.manifest.json'));
  const normalizedModuleId = normalizeModuleId(manifest.moduleId);
  const targetBaseline = `0001_${normalizedModuleId}_baseline.sql`;
  const issues = [];

  const framework = validateDatabaseFramework(repoRoot);
  if (!framework.ok) {
    issues.push(...framework.failures.map((failure) => `framework: ${failure}`));
  }

  if (manifest.baselineStrategy !== 'baseline-plus-migrations') {
    issues.push(`manifest: baselineStrategy must be baseline-plus-migrations (found ${manifest.baselineStrategy ?? 'missing'})`);
  }

  const readmePath = path.join(databaseDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    issues.push('readme: database/README.md missing');
  } else {
    const readme = fs.readFileSync(readmePath, 'utf8');
    if (!readme.includes('## Initialization state')) {
      issues.push('readme: missing ## Initialization state section');
    }
    if (!/db:validate/.test(readme)) {
      issues.push('readme: missing db:validate command documentation');
    }
  }

  for (const engine of ['postgres', 'sqlite']) {
    const migrationDir = path.join(databaseDir, 'migrations', engine);
    if (fs.existsSync(migrationDir)) {
      for (const entry of fs.readdirSync(migrationDir)) {
        if (entry.endsWith('.sql')) {
          issues.push(`migration-debt: migrations/${engine}/${entry}`);
        }
      }
    }
    const baselineDir = path.join(databaseDir, 'ddl/baseline', engine);
    if (!fs.existsSync(baselineDir)) {
      issues.push(`baseline: ddl/baseline/${engine} missing`);
      continue;
    }
    const sqlFiles = fs.readdirSync(baselineDir).filter((name) => name.endsWith('.sql'));
    const primaryBaselines = sqlFiles.filter((name) => /^0001_.*_baseline\.sql$/iu.test(name));
    const supplementalBaselines = sqlFiles.filter((name) => !/^0001_.*_baseline\.sql$/iu.test(name));

    if (sqlFiles.length === 0) {
      issues.push(`baseline: ddl/baseline/${engine} has no .sql file`);
    } else {
      for (const supplemental of supplementalBaselines) {
        const supplementalSql = fs.readFileSync(path.join(baselineDir, supplemental), 'utf8');
        if (!isRetiredBaselineStub(supplementalSql)) {
          issues.push(
            `baseline: supplemental ddl/baseline/${engine}/${supplemental} must be retired stub without CREATE TABLE`,
          );
        }
      }
      if (primaryBaselines.length !== 1) {
        issues.push(
          `baseline: ddl/baseline/${engine} must have exactly one 0001_*_baseline.sql (found ${primaryBaselines.length})`,
        );
      } else if (primaryBaselines[0].toLowerCase() !== targetBaseline.toLowerCase()) {
        issues.push(`baseline: expected ${targetBaseline}, found ${primaryBaselines[0]} in ${engine}`);
      } else {
        const sql = fs.readFileSync(path.join(baselineDir, primaryBaselines[0]), 'utf8').trim();
        if (sql.length < 32) {
          issues.push(`baseline: ddl/baseline/${engine}/${primaryBaselines[0]} is too small`);
        }
      }
    }
  }

  const looseMigrations = fs.existsSync(path.join(databaseDir, 'migrations'))
    ? fs.readdirSync(path.join(databaseDir, 'migrations'), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
        .map((entry) => `migration-debt: migrations/${entry.name}`)
    : [];
  issues.push(...looseMigrations);

  for (const locale of REQUIRED_LOCALES) {
    const localeDir = path.join(databaseDir, 'seeds/locales', locale);
    if (!fs.existsSync(localeDir)) {
      issues.push(`seeds: seeds/locales/${locale} missing`);
    }
  }

  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const scripts = readJson(packageJsonPath).scripts ?? {};
    for (const scriptName of REQUIRED_DB_SCRIPTS) {
      if (!scripts[scriptName]) {
        issues.push(`scripts: package.json missing ${scriptName}`);
      }
    }
    const materialize = scripts['db:materialize:contract'] ?? '';
    const engines = manifest.engines?.length ? manifest.engines : ['postgres'];
    const defaultEngine = engines.includes('postgres') ? 'postgres' : engines[0];
    const expectedBaseline = `database/ddl/baseline/${defaultEngine}/${targetBaseline}`;
    if (!materialize.includes(expectedBaseline)) {
      issues.push(`scripts: db:materialize:contract must reference ${expectedBaseline}`);
    }
    if (!fs.existsSync(path.join(repoRoot, expectedBaseline))) {
      issues.push(`scripts: db:materialize:contract baseline file missing at ${expectedBaseline}`);
    }
  }

  const contractTest = path.join(repoRoot, 'tests/contract/database-framework.contract.test.mjs');
  if (!fs.existsSync(contractTest)) {
    issues.push('tests: tests/contract/database-framework.contract.test.mjs missing');
  }

  return {
    repo: repoName,
    moduleId: manifest.moduleId,
    ok: issues.length === 0,
    issues,
  };
}

function main() {
  const { workspace, json } = parseArgs(process.argv.slice(2));
  const rows = listRepos(workspace).map((repo) => verifyRepo(workspace, repo));

  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    process.exit(rows.every((row) => row.ok) ? 0 : 1);
    return;
  }

  const passing = rows.filter((row) => row.ok);
  const failing = rows.filter((row) => !row.ok);

  process.stdout.write(`Database initialization state verification (${workspace})\n`);
  process.stdout.write(`Modules: ${rows.length}\n`);
  process.stdout.write(`Pass: ${passing.length}\n`);
  process.stdout.write(`Fail: ${failing.length}\n\n`);

  for (const row of rows) {
    process.stdout.write(`${row.ok ? 'PASS' : 'FAIL'} ${row.repo} (${row.moduleId})\n`);
    for (const issue of row.issues.slice(0, 8)) {
      process.stdout.write(`  - ${issue}\n`);
    }
    if (row.issues.length > 8) {
      process.stdout.write(`  - ... ${row.issues.length - 8} more\n`);
    }
  }

  process.exit(failing.length === 0 ? 0 : 1);
}

main();
