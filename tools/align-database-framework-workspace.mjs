#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { validateDatabaseFramework } from './check-database-framework-standard.mjs';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(TOOL_DIR, '../templates/database');
const DATABASE_CLI = 'cargo run --manifest-path ../sdkwork-database/Cargo.toml -p sdkwork-database-cli -- --app-root .';

const DB_SCRIPTS = {
  'db:validate': 'node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .',
  'db:plan': `${DATABASE_CLI} plan`,
  'db:init': `${DATABASE_CLI} init`,
  'db:migrate': `${DATABASE_CLI} migrate`,
  'db:seed': `${DATABASE_CLI} seed`,
  'db:status': `${DATABASE_CLI} status`,
  'db:drift': `${DATABASE_CLI} drift`,
  'db:drift:check': `${DATABASE_CLI} drift-check`,
  'db:bootstrap': `${DATABASE_CLI} bootstrap`,
};

const REQUIRED_LOCALES = ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'ru-RU', 'ko-KR'];

function usage() {
  return [
    'Usage: node tools/align-database-framework-workspace.mjs --workspace <dir> [--dry-run]',
    '',
    'Scaffolds missing database/ layout paths and standard db:* package scripts.',
  ].join('\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function listRepos(workspaceRoot) {
  return fs.readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((repoRoot) => fs.existsSync(path.join(repoRoot, 'database')))
    .sort();
}

function copyIfMissing(source, destination, dryRun, changes) {
  if (fs.existsSync(destination)) {
    return;
  }
  changes.push(path.relative(process.cwd(), destination));
  if (dryRun) {
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.statSync(source).isDirectory()) {
    fs.cpSync(source, destination, { recursive: true });
  } else {
    fs.copyFileSync(source, destination);
  }
}

function ensureDir(dirPath, dryRun, changes) {
  if (fs.existsSync(dirPath)) {
    return;
  }
  changes.push(path.relative(process.cwd(), dirPath));
  if (!dryRun) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureSqliteBaselineFromPostgres(databaseDir, dryRun, changes) {
  const postgresDir = path.join(databaseDir, 'ddl/baseline/postgres');
  const sqliteDir = path.join(databaseDir, 'ddl/baseline/sqlite');
  if (!fs.existsSync(postgresDir)) {
    return;
  }
  ensureDir(sqliteDir, dryRun, changes);
  const postgresBaselines = fs.readdirSync(postgresDir).filter((name) => name.endsWith('.sql'));
  if (postgresBaselines.length === 0) {
    return;
  }
  for (const fileName of postgresBaselines) {
    const target = path.join(sqliteDir, fileName);
    if (fs.existsSync(target)) {
      continue;
    }
    changes.push(path.relative(process.cwd(), target));
    if (!dryRun) {
      fs.copyFileSync(path.join(postgresDir, fileName), target);
    }
  }
}

function ensureSeedBootstrap(databaseDir, moduleId, dryRun, changes) {
  const seedPath = path.join(databaseDir, 'seeds/common/001_bootstrap.sql');
  if (fs.existsSync(seedPath)) {
    return;
  }
  changes.push(path.relative(process.cwd(), seedPath));
  if (!dryRun) {
    fs.mkdirSync(path.dirname(seedPath), { recursive: true });
    fs.writeFileSync(
      seedPath,
      `-- Minimal bootstrap seed for ${moduleId}\nSELECT 1;\n`,
      'utf8',
    );
  }
}

function ensurePackageScripts(repoRoot, dryRun, changes) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }
  const packageJson = readJson(packageJsonPath);
  packageJson.scripts = packageJson.scripts ?? {};
  let changed = false;
  for (const [name, command] of Object.entries(DB_SCRIPTS)) {
    if (packageJson.scripts[name] === command) {
      continue;
    }
    if (!packageJson.scripts[name]) {
      packageJson.scripts[name] = command;
      changed = true;
    }
  }
  if (!changed && !packageJson.scripts['db:materialize:contract']) {
    const manifestPath = path.join(repoRoot, 'database/database.manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = readJson(manifestPath);
      const moduleId = manifest.moduleId ?? path.basename(repoRoot).replace(/^sdkwork-/u, '');
      const engines = manifest.engines?.length ? manifest.engines : ['postgres'];
      const defaultEngine = engines.includes('postgres') ? 'postgres' : engines[0];
      const baseline = `database/ddl/baseline/${defaultEngine}/0001_${moduleId}_legacy_baseline.sql`;
      const prefixArg = manifest.tablePrefix ? ` --prefixes ${manifest.tablePrefix}` : '';
      packageJson.scripts['db:materialize:contract'] =
        `node ../sdkwork-specs/tools/materialize-database-contract-from-baseline.mjs --root . --baseline ${baseline} --module-id ${moduleId} --owner ${manifest.owner ?? moduleId}${prefixArg} --engines ${engines.join(',')}`;
      changed = true;
    }
  }
  changes.push(path.relative(process.cwd(), packageJsonPath));
  if (!dryRun) {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }
}

function ensureSeedManifest(databaseDir, dryRun, changes) {
  const seedManifestPath = path.join(databaseDir, 'seeds/seed.manifest.json');
  const templatePath = path.join(TEMPLATE_DIR, 'seeds/seed.manifest.json');
  let needsReplace = !fs.existsSync(seedManifestPath);
  if (!needsReplace) {
    try {
      const current = readJson(seedManifestPath);
      if (current.kind !== 'sdkwork.database.seed' || !current.defaultLocale) {
        needsReplace = true;
      }
    } catch {
      needsReplace = true;
    }
  }
  if (!needsReplace) {
    return;
  }
  changes.push(path.relative(process.cwd(), seedManifestPath));
  if (!dryRun) {
    fs.mkdirSync(path.dirname(seedManifestPath), { recursive: true });
    fs.copyFileSync(templatePath, seedManifestPath);
  }
}

function ensureContractRegistries(databaseDir, manifest, dryRun, changes) {
  const prefixPath = path.join(databaseDir, 'contract/prefix-registry.json');
  const tablePath = path.join(databaseDir, 'contract/table-registry.json');
  const tablePrefix = manifest.tablePrefix ?? '';
  const owner = manifest.owner ?? manifest.moduleId ?? 'platform';
  const domain = manifest.moduleId ?? 'platform';

  if (fs.existsSync(prefixPath)) {
    const prefixRegistry = readJson(prefixPath);
    if (!Array.isArray(prefixRegistry.prefixes) || prefixRegistry.prefixes.length === 0) {
      if (tablePrefix) {
        prefixRegistry.prefixes = [{ prefix: tablePrefix, domain, owner }];
        changes.push(path.relative(process.cwd(), prefixPath));
        if (!dryRun) {
          fs.writeFileSync(prefixPath, `${JSON.stringify(prefixRegistry, null, 2)}\n`, 'utf8');
        }
      }
    }
  }

  if (fs.existsSync(tablePath)) {
    const tableRegistry = readJson(tablePath);
    if (!Array.isArray(tableRegistry.tables) || tableRegistry.tables.length === 0) {
      const postgresDir = path.join(databaseDir, 'ddl/baseline/postgres');
      const tables = [];
      if (fs.existsSync(postgresDir)) {
        for (const fileName of fs.readdirSync(postgresDir)) {
          if (!fileName.endsWith('.sql')) continue;
          const sql = fs.readFileSync(path.join(postgresDir, fileName), 'utf8');
          const matches = sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z0-9_]+)/giu);
          for (const match of matches) {
            tables.push({
              name: match[1],
              prefix: tablePrefix || undefined,
              domain,
            });
          }
        }
      }
      if (tables.length > 0) {
        tableRegistry.tables = tables;
        changes.push(path.relative(process.cwd(), tablePath));
        if (!dryRun) {
          fs.writeFileSync(tablePath, `${JSON.stringify(tableRegistry, null, 2)}\n`, 'utf8');
        }
      }
    }
  }
}

function alignDatabaseLayout(repoRoot, { dryRun = false } = {}) {
  const databaseDir = path.join(repoRoot, 'database');
  const changes = [];
  let manifest = null;
  try {
    manifest = readJson(path.join(databaseDir, 'database.manifest.json'));
  } catch {
    return changes;
  }

  const templatePaths = [
    'README.md',
    'contract/prefix-registry.json',
    'contract/table-registry.json',
    'seeds/seed.manifest.json',
    'migrations/postgres/README.md',
    'migrations/sqlite/README.md',
    'ddl/baseline/postgres/README.md',
    'ddl/baseline/sqlite/README.md',
    'ddl/generated/README.md',
    'fixtures/README.md',
    'seeds/common/README.md',
    'seeds/locales/README.md',
  ];

  for (const relativePath of templatePaths) {
    copyIfMissing(
      path.join(TEMPLATE_DIR, relativePath),
      path.join(databaseDir, relativePath),
      dryRun,
      changes,
    );
  }

  for (const locale of REQUIRED_LOCALES) {
    copyIfMissing(
      path.join(TEMPLATE_DIR, 'seeds/locales', locale, 'README.md'),
      path.join(databaseDir, 'seeds/locales', locale, 'README.md'),
      dryRun,
      changes,
    );
  }

  ensureDir(path.join(databaseDir, 'migrations/postgres'), dryRun, changes);
  ensureDir(path.join(databaseDir, 'migrations/sqlite'), dryRun, changes);
  ensureDir(path.join(databaseDir, 'ddl/generated'), dryRun, changes);
  ensureDir(path.join(databaseDir, 'fixtures'), dryRun, changes);
  ensureSqliteBaselineFromPostgres(databaseDir, dryRun, changes);
  ensureSeedBootstrap(databaseDir, manifest.moduleId ?? path.basename(repoRoot), dryRun, changes);
  ensureSeedManifest(databaseDir, dryRun, changes);
  ensureContractRegistries(databaseDir, manifest, dryRun, changes);
  ensurePackageScripts(repoRoot, dryRun, changes);

  return changes;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const workspaceRoot = path.resolve(
    values.workspace || path.join(TOOL_DIR, '..', '..'),
  );
  const dryRun = Boolean(values['dry-run']);
  let exitCode = 0;

  for (const repoRoot of listRepos(workspaceRoot)) {
    const repoName = path.basename(repoRoot);
    const changes = alignDatabaseLayout(repoRoot, { dryRun });
    const validation = validateDatabaseFramework(repoRoot);
    const status = validation.ok ? 'ok' : 'fail';
    if (changes.length > 0) {
      console.log(`${status} ${repoName} (${changes.length} change(s))`);
      for (const change of changes.slice(0, 12)) {
        console.log(`  - ${change}`);
      }
      if (changes.length > 12) {
        console.log(`  - ... ${changes.length - 12} more`);
      }
    } else {
      console.log(`${status} ${repoName}`);
    }
    if (!validation.ok) {
      for (const failure of validation.failures.slice(0, 5)) {
        console.log(`  issue: ${failure}`);
      }
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}

main();
