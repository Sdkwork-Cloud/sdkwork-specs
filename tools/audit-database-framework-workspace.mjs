#!/usr/bin/env node
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

function listSdkworkRepos(workspaceRoot) {
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => entry.name)
    .sort();
}

function detectLegacyPaths(repoRoot) {
  const candidates = [
    'deployments/database',
    'specs/database',
    'migrations',
    'crates',
  ];
  const legacy = [];
  for (const relative of candidates) {
    const absolute = path.join(repoRoot, relative);
    if (!fs.existsSync(absolute)) {
      continue;
    }
    if (relative === 'crates') {
      const hits = [];
      for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }
        const migrationDir = path.join(absolute, entry.name, 'migrations');
        if (fs.existsSync(migrationDir)) {
          hits.push(path.relative(repoRoot, migrationDir).replace(/\\/g, '/'));
        }
      }
      legacy.push(...hits);
      continue;
    }
    legacy.push(relative);
  }
  return legacy;
}

function scriptCoverage(packageJsonPath) {
  if (!fs.existsSync(packageJsonPath)) {
    return { present: [], missing: REQUIRED_DB_SCRIPTS };
  }
  const scripts = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8').replace(/^\uFEFF/u, '')).scripts ?? {};
  const present = REQUIRED_DB_SCRIPTS.filter((name) => Boolean(scripts[name]));
  const missing = REQUIRED_DB_SCRIPTS.filter((name) => !scripts[name]);
  return { present, missing };
}

function classifyRepo(repoName, repoRoot) {
  const hasDatabaseDir = fs.existsSync(path.join(repoRoot, 'database'));
  const hasManifest = fs.existsSync(path.join(repoRoot, 'database', 'database.manifest.json'));
  const framework = hasDatabaseDir ? validateDatabaseFramework(repoRoot) : { ok: true, skipped: true, failures: [] };
  const legacyPaths = detectLegacyPaths(repoRoot);
  const scripts = scriptCoverage(path.join(repoRoot, 'package.json'));
  const ownsDb =
    hasDatabaseDir ||
    legacyPaths.length > 0 ||
    fs.existsSync(path.join(repoRoot, 'Cargo.toml')) &&
      fs.readFileSync(path.join(repoRoot, 'Cargo.toml'), 'utf8').includes('repository-sqlx');

  let compliance = 'none';
  if (hasManifest && framework.ok && scripts.missing.length === 0) {
    compliance = 'compliant';
  } else if (hasDatabaseDir || legacyPaths.length > 0) {
    compliance = legacyPaths.length > 0 && !hasManifest ? 'legacy-only' : 'partial';
  }

  return {
    repo: repoName,
    ownsDb,
    compliance,
    hasDatabaseDir,
    hasManifest,
    frameworkOk: framework.ok,
    frameworkFailures: framework.failures ?? [],
    legacyPaths,
    dbScriptsPresent: scripts.present,
    dbScriptsMissing: scripts.missing,
    hasPackageJson: fs.existsSync(path.join(repoRoot, 'package.json')),
  };
}

function main() {
  const { workspace, json } = parseArgs(process.argv.slice(2));
  const rows = listSdkworkRepos(workspace).map((repo) =>
    classifyRepo(repo, path.join(workspace, repo)),
  );

  if (json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return;
  }

  const owning = rows.filter((row) => row.ownsDb);
  const compliant = owning.filter((row) => row.compliance === 'compliant');
  const partial = owning.filter((row) => row.compliance === 'partial');
  const legacy = owning.filter((row) => row.compliance === 'legacy-only');

  process.stdout.write(`Database framework workspace audit (${workspace})\n`);
  process.stdout.write(`Repos scanned: ${rows.length}\n`);
  process.stdout.write(`DB owners: ${owning.length}\n`);
  process.stdout.write(`Compliant: ${compliant.length}\n`);
  process.stdout.write(`Partial: ${partial.length}\n`);
  process.stdout.write(`Legacy-only: ${legacy.length}\n\n`);

  for (const row of owning) {
    const flags = [
      row.compliance,
      row.hasManifest ? 'manifest' : 'no-manifest',
      row.dbScriptsMissing.length === 0 ? 'db-scripts' : `missing:${row.dbScriptsMissing.join(',')}`,
    ];
    process.stdout.write(`${row.repo}: ${flags.join(' | ')}\n`);
    if (row.frameworkFailures.length > 0) {
      for (const failure of row.frameworkFailures.slice(0, 5)) {
        process.stdout.write(`  - ${failure}\n`);
      }
      if (row.frameworkFailures.length > 5) {
        process.stdout.write(`  - ... ${row.frameworkFailures.length - 5} more\n`);
      }
    }
    if (row.legacyPaths.length > 0) {
      process.stdout.write(`  legacy: ${row.legacyPaths.join(', ')}\n`);
    }
  }

  const failing = owning.filter((row) => row.compliance !== 'compliant');
  process.exit(failing.length === 0 ? 0 : 1);
}

main();
