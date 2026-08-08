#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
    'Usage: node tools/align-database-framework-workspace.mjs --workspace <dir> [--migrate-authoritative] [--migrate-client-local <repo,...>] [--dry-run]',
    '',
    'Scaffolds missing database/ layout paths and standard db:* package scripts.',
    'With --migrate-authoritative, upgrades legacy PostgreSQL roots to manifest v2 and moves',
    'root SQLite lifecycle assets to tests/fixtures/database/sqlite.',
  ].join('\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function writeTextIfChanged(filePath, source, dryRun, changes) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  if (current === source) return;
  changes.push(path.relative(process.cwd(), filePath));
  if (!dryRun) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, source, 'utf8');
  }
}

function writeJsonIfChanged(filePath, value, dryRun, changes) {
  if (fs.existsSync(filePath)) {
    try {
      if (JSON.stringify(readJson(filePath)) === JSON.stringify(value)) return;
    } catch {
      // Keep the normal write path so malformed JSON is repaired explicitly.
    }
  }
  writeTextIfChanged(filePath, `${JSON.stringify(value, null, 2)}\n`, dryRun, changes);
}

function replaceTopLevelYamlScalar(source, key, value, afterKey) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const keyPattern = new RegExp(`^${key}:`, 'u');
  const existingIndex = lines.findIndex((line) => keyPattern.test(line));
  if (existingIndex >= 0) {
    lines[existingIndex] = `${key}: ${value}`;
    return lines.join(newline);
  }
  const afterPattern = new RegExp(`^${afterKey}:`, 'u');
  const afterIndex = lines.findIndex((line) => afterPattern.test(line));
  let insertIndex = afterIndex >= 0 ? afterIndex + 1 : 0;
  while (insertIndex < lines.length && /^\s/u.test(lines[insertIndex])) insertIndex += 1;
  lines.splice(insertIndex, 0, `${key}: ${value}`);
  return lines.join(newline);
}

function replaceTopLevelYamlSequence(source, key, values) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line === `${key}:`);
  if (start < 0) {
    const tablesIndex = lines.findIndex((line) => line === 'tables:');
    lines.splice(
      tablesIndex >= 0 ? tablesIndex : lines.length,
      0,
      `${key}:`,
      ...values.map((value) => `  - ${value}`),
    );
    return lines.join(newline);
  }
  let end = start + 1;
  while (end < lines.length && (/^\s/u.test(lines[end]) || !lines[end])) end += 1;
  lines.splice(start, end - start, `${key}:`, ...values.map((value) => `  - ${value}`));
  return lines.join(newline);
}

function moveDirectory(source, destination, dryRun, changes) {
  if (!fs.existsSync(source)) return;
  if (fs.existsSync(destination)) {
    throw new Error(`refusing to merge existing SQLite fixture directory: ${destination}`);
  }
  changes.push(
    `${path.relative(process.cwd(), source)} -> ${path.relative(process.cwd(), destination)}`,
  );
  if (!dryRun) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(source, destination);
  }
}

function walkAuthoredTextFiles(rootDir) {
  const files = [];
  const ignoredDirectories = new Set(['.git', 'node_modules', 'target', 'dist', 'build']);
  const textExtensions = new Set([
    '.json', '.md', '.mjs', '.js', '.cjs', '.ts', '.tsx', '.rs', '.toml', '.yaml', '.yml', '.txt',
  ]);
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (textExtensions.has(path.extname(entry.name))) files.push(absolutePath);
    }
  };
  visit(rootDir);
  return files;
}

function updateSqliteFixtureReferences(repoRoot, dryRun, changes) {
  const replacements = [
    ['database/ddl/baseline/sqlite', 'tests/fixtures/database/sqlite/ddl/baseline'],
    ['database\\\\ddl\\\\baseline\\\\sqlite', 'tests\\\\fixtures\\\\database\\\\sqlite\\\\ddl\\\\baseline'],
    ['database/migrations/sqlite', 'tests/fixtures/database/sqlite/migrations'],
    ['database\\\\migrations\\\\sqlite', 'tests\\\\fixtures\\\\database\\\\sqlite\\\\migrations'],
  ];
  for (const filePath of walkAuthoredTextFiles(repoRoot)) {
    let source = fs.readFileSync(filePath, 'utf8');
    let next = source;
    for (const [from, to] of replacements) next = next.replaceAll(from, to);
    if (next !== source) writeTextIfChanged(filePath, next, dryRun, changes);
  }
}

function updateAuthoritativeMaterializeScript(repoRoot, dryRun, changes) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;
  const packageJson = readJson(packageJsonPath);
  const command = packageJson.scripts?.['db:materialize:contract'];
  if (typeof command !== 'string') return;
  const baselineDir = path.join(repoRoot, 'database/ddl/baseline/postgres');
  const baselineFile = fs.existsSync(baselineDir)
    ? fs.readdirSync(baselineDir).find((entry) => entry.endsWith('.sql'))
    : null;
  if (!baselineFile) return;
  let next = command.replace(
    /--baseline\s+\S+/u,
    `--baseline database/ddl/baseline/postgres/${baselineFile}`,
  );
  next = next.replace(/--engines\s+\S+/u, '--engines postgres');
  if (next === command) return;
  packageJson.scripts['db:materialize:contract'] = next;
  writeJsonIfChanged(packageJsonPath, packageJson, dryRun, changes);
}

function migrateAuthoritativeContract(repoRoot, manifest, dryRun, changes) {
  const isLegacyPostgresRoot = manifest.schemaVersion === 1
    && Array.isArray(manifest.engines)
    && manifest.engines.includes('postgres');
  const isAuthoritativeRoot = manifest.schemaVersion === 2
    && manifest.databaseRole === 'authoritative-server';
  if (!isLegacyPostgresRoot && !isAuthoritativeRoot) return false;

  let manifestChanged = false;
  const setManifestValue = (key, value) => {
    if (JSON.stringify(manifest[key]) === JSON.stringify(value)) return;
    manifest[key] = value;
    manifestChanged = true;
  };
  setManifestValue('schemaVersion', 2);
  setManifestValue('databaseRole', 'authoritative-server');
  setManifestValue('engines', ['postgres']);
  setManifestValue('defaultEngine', 'postgres');
  manifest.lifecycle = manifest.lifecycle ?? {};
  if (manifest.lifecycle.autoMigrate !== false) {
    manifest.lifecycle.autoMigrate = false;
    manifestChanged = true;
  }
  if (manifestChanged) {
    writeJsonIfChanged(
      path.join(repoRoot, 'database/database.manifest.json'),
      manifest,
      dryRun,
      changes,
    );
  }

  const schemaPath = path.join(repoRoot, 'database/contract/schema.yaml');
  if (fs.existsSync(schemaPath)) {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = replaceTopLevelYamlScalar(
      schema,
      'database_role',
      'authoritative-server',
      'kind',
    );
    schema = replaceTopLevelYamlScalar(
      schema,
      'contract_version',
      manifest.contractVersion,
      'module_id',
    );
    schema = replaceTopLevelYamlSequence(schema, 'engines', ['postgres']);
    schema = replaceTopLevelYamlScalar(
      schema,
      'table_prefix',
      primaryManifestPrefix(manifest),
      'engines',
    );
    writeTextIfChanged(schemaPath, schema, dryRun, changes);
  }

  const sqliteBaselineDir = path.join(repoRoot, 'database/ddl/baseline/sqlite');
  const sqliteMigrationsDir = path.join(repoRoot, 'database/migrations/sqlite');
  const hasSqliteLifecycle = fs.existsSync(sqliteBaselineDir) || fs.existsSync(sqliteMigrationsDir);
  moveDirectory(
    sqliteBaselineDir,
    path.join(repoRoot, 'tests/fixtures/database/sqlite/ddl/baseline'),
    dryRun,
    changes,
  );
  moveDirectory(
    sqliteMigrationsDir,
    path.join(repoRoot, 'tests/fixtures/database/sqlite/migrations'),
    dryRun,
    changes,
  );
  if (hasSqliteLifecycle) {
    updateSqliteFixtureReferences(repoRoot, dryRun, changes);
    updateAuthoritativeMaterializeScript(repoRoot, dryRun, changes);
  }
  return true;
}

function migrateClientLocalContract(repoRoot, manifest, dryRun, changes) {
  if (
    manifest.schemaVersion !== 1
    || !Array.isArray(manifest.engines)
    || manifest.engines.length !== 1
    || manifest.engines[0] !== 'sqlite'
  ) {
    throw new Error(
      `refusing client-local migration for non-legacy SQLite-only root: ${repoRoot}`,
    );
  }
  manifest.schemaVersion = 2;
  manifest.databaseRole = 'client-local';
  manifest.engines = ['sqlite'];
  manifest.defaultEngine = 'sqlite';
  if (manifest.baselineStrategy === 'migration') manifest.baselineStrategy = 'migrations-only';
  manifest.clientLocal = {
    mode: 'local-only',
    scope: 'environment-profile-origin-account',
    authoritativeSource: 'local-device',
    syncContract: null,
  };
  manifest.lifecycle = manifest.lifecycle ?? {};
  manifest.lifecycle.autoMigrate = true;
  manifest.paths = manifest.paths ?? {};
  manifest.paths.localDataPolicy = 'local-data-policy.yaml';
  writeJsonIfChanged(
    path.join(repoRoot, 'database/database.manifest.json'),
    manifest,
    dryRun,
    changes,
  );

  const schemaPath = path.join(repoRoot, 'database/contract/schema.yaml');
  if (fs.existsSync(schemaPath)) {
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = replaceTopLevelYamlScalar(schema, 'database_role', 'client-local', 'kind');
    schema = replaceTopLevelYamlScalar(
      schema,
      'contract_version',
      manifest.contractVersion,
      'module_id',
    );
    schema = replaceTopLevelYamlSequence(schema, 'engines', ['sqlite']);
    writeTextIfChanged(schemaPath, schema, dryRun, changes);
  }

  const policyPath = path.join(repoRoot, 'database/local-data-policy.yaml');
  const policy = [
    'schema_version: 1',
    'kind: sdkwork.database.client-local-policy',
    'mode: local-only',
    'scope: environment-profile-origin-account',
    'authoritative_source: local-device',
    'sync_contract: null',
    'security:',
    '  encryption_at_rest: required-when-sensitive',
    '  key_store: os-secure-storage',
    '  backup: excluded-unless-declared',
    '  export: disabled-unless-declared',
    '  lock_state: close-or-rekey-per-platform-policy',
    'retention:',
    '  policy: device-local-until-user-deletion',
    '  max_age_or_event: user-delete-or-uninstall',
    'lifecycle:',
    '  logout: purge-account-scoped-data',
    '  account_switch: isolate-and-purge-active-state',
    '  uninstall: platform-default-with-documented-backup-policy',
    'recovery:',
    '  migration_interruption: atomic-retry-or-restore',
    '  disk_full: fail-without-partial-commit',
    '  corruption: integrity-check-then-rebuild-or-restore',
    '  projection_rebuild: not-applicable-local-only',
    '',
  ].join('\n');
  writeTextIfChanged(policyPath, policy, dryRun, changes);

  moveDirectory(
    path.join(repoRoot, 'database/ddl/baseline/postgres'),
    path.join(repoRoot, 'tests/fixtures/database/postgres/ddl/baseline'),
    dryRun,
    changes,
  );
  moveDirectory(
    path.join(repoRoot, 'database/migrations/postgres'),
    path.join(repoRoot, 'tests/fixtures/database/postgres/migrations'),
    dryRun,
    changes,
  );
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
      const baseline = `database/ddl/baseline/postgres/0001_${moduleId}_baseline.sql`;
      const prefixArg = primaryManifestPrefix(manifest) ? ` --prefixes ${primaryManifestPrefix(manifest)}` : '';
      packageJson.scripts['db:materialize:contract'] =
        `node ../sdkwork-specs/tools/materialize-database-contract-from-baseline.mjs --root . --baseline ${baseline} --module-id ${moduleId} --owner ${manifest.owner ?? moduleId}${prefixArg}`;
      changed = true;
    }
  }
  if (changed) writeJsonIfChanged(packageJsonPath, packageJson, dryRun, changes);
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
  if (needsReplace) {
    changes.push(path.relative(process.cwd(), seedManifestPath));
    if (dryRun) return;
    fs.mkdirSync(path.dirname(seedManifestPath), { recursive: true });
    fs.copyFileSync(templatePath, seedManifestPath);
    return;
  }

  const seedManifest = readJson(seedManifestPath);
  const activeLocales = seedManifest.activeLocales ?? ['zh-CN'];
  seedManifest.i18nVersion = seedManifest.i18nVersion ?? '1.0.0';
  seedManifest.fallbackLocale = seedManifest.fallbackLocale ?? seedManifest.defaultLocale ?? 'zh-CN';
  seedManifest.supportedLocales = Array.from(new Set([
    ...(seedManifest.supportedLocales ?? []),
    ...REQUIRED_LOCALES,
  ]));
  seedManifest.activeLocales = activeLocales;
  seedManifest.localeSets = seedManifest.localeSets ?? {};
  for (const locale of activeLocales) {
    const localeFiles = Array.from(new Set(
      Object.values(seedManifest.profiles ?? {})
        .flatMap((profile) => profile?.locales?.[locale] ?? []),
    ));
    const checksum = createHash('sha256')
      .update(JSON.stringify(localeFiles))
      .digest('hex');
    seedManifest.localeSets[locale] = {
      version: seedManifest.i18nVersion,
      required: true,
      checksum: `sha256:${checksum}`,
      files: localeFiles,
      ...seedManifest.localeSets[locale],
    };
  }
  writeJsonIfChanged(seedManifestPath, seedManifest, dryRun, changes);
}

function primaryManifestPrefix(manifest) {
  if (Array.isArray(manifest.tablePrefixes) && manifest.tablePrefixes.length > 0) {
    return manifest.tablePrefixes[0];
  }
  return manifest.tablePrefix ?? null;
}

function ensureContractRegistries(databaseDir, manifest, dryRun, changes) {
  const prefixPath = path.join(databaseDir, 'contract/prefix-registry.json');
  const tablePath = path.join(databaseDir, 'contract/table-registry.json');
  const tablePrefix = primaryManifestPrefix(manifest) ?? '';
  const owner = manifest.owner ?? manifest.moduleId ?? 'platform';
  const domain = manifest.moduleId ?? 'platform';

  if (fs.existsSync(prefixPath)) {
    const prefixRegistry = readJson(prefixPath);
    const prefixes = Array.isArray(prefixRegistry.prefixes) ? prefixRegistry.prefixes : [];
    prefixRegistry.schemaVersion = prefixRegistry.schemaVersion ?? 1;
    prefixRegistry.kind = prefixRegistry.kind ?? 'sdkwork.database.prefix-registry';
    prefixRegistry.prefixes = prefixes.map((entry) => (
      typeof entry === 'string' ? { prefix: entry, domain, owner } : entry
    ));
    if (prefixRegistry.prefixes.length === 0 && tablePrefix) {
      prefixRegistry.prefixes = [{ prefix: tablePrefix, domain, owner }];
    }
    writeJsonIfChanged(prefixPath, prefixRegistry, dryRun, changes);
  }

  if (fs.existsSync(tablePath)) {
    const tableRegistry = readJson(tablePath);
    tableRegistry.schemaVersion = tableRegistry.schemaVersion ?? 1;
    tableRegistry.kind = tableRegistry.kind ?? 'sdkwork.database.table-registry';
    const currentTables = Array.isArray(tableRegistry.tables) ? tableRegistry.tables : [];
    tableRegistry.tables = currentTables.map((entry) => {
      const normalized = typeof entry === 'string'
        ? { table_name: entry }
        : { ...entry, table_name: entry.table_name ?? entry.name };
      delete normalized.name;
      normalized.owner = normalized.owner ?? owner;
      normalized.compliance_level = normalized.compliance_level
        ?? normalized.complianceLevel
        ?? 'L2';
      normalized.lifecycle_status = normalized.lifecycle_status
        ?? normalized.status
        ?? 'active';
      delete normalized.complianceLevel;
      delete normalized.status;
      if (normalized.engine) normalized.engine = ['postgres'];
      return normalized;
    });
    if (tableRegistry.tables.length === 0) {
      const postgresDir = path.join(databaseDir, 'ddl/baseline/postgres');
      const tables = [];
      if (fs.existsSync(postgresDir)) {
        for (const fileName of fs.readdirSync(postgresDir)) {
          if (!fileName.endsWith('.sql')) continue;
          const sql = fs.readFileSync(path.join(postgresDir, fileName), 'utf8');
          const matches = sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z0-9_]+)/giu);
          for (const match of matches) {
            tables.push({
              table_name: match[1],
              owner,
              compliance_level: 'L2',
              lifecycle_status: 'active',
            });
          }
        }
      }
      if (tables.length > 0) {
        tableRegistry.tables = tables;
      }
    }
    writeJsonIfChanged(tablePath, tableRegistry, dryRun, changes);
  }
}

export function alignDatabaseLayout(
  repoRoot,
  { dryRun = false, migrateAuthoritative = false, migrateClientLocal = false } = {},
) {
  const databaseDir = path.join(repoRoot, 'database');
  const changes = [];
  let manifest = null;
  try {
    manifest = readJson(path.join(databaseDir, 'database.manifest.json'));
  } catch {
    return changes;
  }
  if (migrateAuthoritative) {
    migrateAuthoritativeContract(repoRoot, manifest, dryRun, changes);
  }
  if (migrateClientLocal) {
    migrateClientLocalContract(repoRoot, manifest, dryRun, changes);
    return changes;
  }
  if (
    manifest.schemaVersion !== 2
    || manifest.databaseRole !== 'authoritative-server'
    || JSON.stringify(manifest.engines) !== JSON.stringify(['postgres'])
    || manifest.defaultEngine !== 'postgres'
  ) {
    return changes;
  }

  const templatePaths = [
    'README.md',
    'contract/prefix-registry.json',
    'contract/table-registry.json',
    'seeds/seed.manifest.json',
    'migrations/postgres/README.md',
    'ddl/baseline/postgres/README.md',
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
  ensureDir(path.join(databaseDir, 'ddl/generated'), dryRun, changes);
  ensureDir(path.join(databaseDir, 'fixtures'), dryRun, changes);
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
      'migrate-authoritative': { type: 'boolean', default: false },
      'migrate-client-local': { type: 'string' },
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
  const migrateAuthoritative = Boolean(values['migrate-authoritative']);
  const clientLocalRepos = new Set(
    (values['migrate-client-local'] ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  );
  let exitCode = 0;

  for (const repoRoot of listRepos(workspaceRoot)) {
    const repoName = path.basename(repoRoot);
    const changes = alignDatabaseLayout(repoRoot, {
      dryRun,
      migrateAuthoritative,
      migrateClientLocal: clientLocalRepos.has(repoName),
    });
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
