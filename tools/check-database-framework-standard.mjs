#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_LOCALES = ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'ru-RU', 'ko-KR'];
const REQUIRED_DB_SCRIPTS = [
  'db:validate',
  'db:plan',
  'db:init',
  'db:migrate',
  'db:seed',
  'db:status',
  'db:drift',
  'db:drift:check',
];
const L2_DB_SCRIPTS = ['db:materialize:contract', 'db:bootstrap'];
const L2_CONTRACT_VERSION = '1.0.0';

function parseArgs(argv) {
  const args = { root: process.cwd(), layout: 'application' };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root') {
      args.root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--layout') {
      args.layout = argv[index + 1] ?? 'application';
      index += 1;
    }
  }
  return args;
}

function existsAt(baseDir, relativePath) {
  return fs.existsSync(path.join(baseDir, relativePath));
}

function readJsonAt(baseDir, relativePath) {
  const absolutePath = path.join(baseDir, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function listBaselineSqlFiles(moduleRootDir, engine) {
  const baselineDir = path.join(moduleRootDir, 'ddl/baseline', engine);
  if (!fs.existsSync(baselineDir)) {
    return [];
  }
  return fs
    .readdirSync(baselineDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort();
}

export function validateDatabaseModuleContract(moduleRootDir) {
  const failures = [];

  function fail(message) {
    failures.push(message);
  }

  let manifest;
  try {
    manifest = readJsonAt(moduleRootDir, 'database.manifest.json');
  } catch (error) {
    fail(`database.manifest.json must be valid JSON (${error.message})`);
    return { ok: false, failures };
  }

  if (manifest.contractVersion !== L2_CONTRACT_VERSION) {
    fail(
      `database.manifest.json contractVersion must be ${L2_CONTRACT_VERSION} (found ${manifest.contractVersion ?? 'missing'})`,
    );
  }
  if (manifest.lifecycle?.autoMigrate !== true) {
    fail('database.manifest.json lifecycle.autoMigrate must be true for L2 modules');
  }

  const engines = manifest.engines?.length ? manifest.engines : ['postgres'];
  for (const engine of engines) {
    const baselineFiles = listBaselineSqlFiles(moduleRootDir, engine);
    if (baselineFiles.length === 0) {
      fail(`ddl/baseline/${engine} must contain at least one .sql baseline file`);
    }
  }

  try {
    const prefixRegistry = readJsonAt(moduleRootDir, 'contract/prefix-registry.json');
    if (!Array.isArray(prefixRegistry.prefixes) || prefixRegistry.prefixes.length === 0) {
      fail('contract/prefix-registry.json prefixes must be non-empty for L2 modules');
    }
  } catch (error) {
    fail(`contract/prefix-registry.json must be valid JSON (${error.message})`);
  }

  try {
    const tableRegistry = readJsonAt(moduleRootDir, 'contract/table-registry.json');
    if (!Array.isArray(tableRegistry.tables) || tableRegistry.tables.length === 0) {
      fail('contract/table-registry.json tables must be non-empty for L2 modules');
    }
  } catch (error) {
    fail(`contract/table-registry.json must be valid JSON (${error.message})`);
  }

  return { ok: failures.length === 0, failures };
}

export function validateDatabaseModuleLayout(moduleRootDir) {
  const failures = [];

  function fail(message) {
    failures.push(message);
  }

  const requiredPaths = [
    'README.md',
    'database.manifest.json',
    'contract/schema.yaml',
    'contract/prefix-registry.json',
    'contract/table-registry.json',
    'seeds/seed.manifest.json',
    'drift/policy.yaml',
    'migrations/postgres',
    'migrations/sqlite',
    'seeds/common',
    'ddl/baseline/postgres',
    'ddl/baseline/sqlite',
    'ddl/generated',
    'fixtures',
  ];

  for (const relativePath of requiredPaths) {
    if (!existsAt(moduleRootDir, relativePath)) {
      fail(`${relativePath} must exist`);
    }
  }

  for (const locale of REQUIRED_LOCALES) {
    const relativePath = `seeds/locales/${locale}`;
    if (!existsAt(moduleRootDir, relativePath)) {
      fail(`${relativePath} must exist`);
    }
  }

  for (const engine of ['postgres', 'sqlite']) {
    const migrationDir = path.join(moduleRootDir, 'migrations', engine);
    if (!fs.existsSync(migrationDir)) {
      continue;
    }
    for (const entry of fs.readdirSync(migrationDir)) {
      if (!entry.endsWith('.up.sql')) {
        continue;
      }
      if (!/^\d{4}_[a-z0-9_]+\.up\.sql$/.test(entry)) {
        fail(`migrations/${engine}/${entry} must match ^\\d{4}_[a-z0-9_]+\\.up\\.sql$`);
      }
      const downName = entry.replace(/\.up\.sql$/, '.down.sql');
      if (!fs.existsSync(path.join(migrationDir, downName))) {
        fail(`migrations/${engine}/${downName} must exist for ${entry}`);
      }
    }
  }

  try {
    const manifest = readJsonAt(moduleRootDir, 'database.manifest.json');
    if (manifest.kind !== 'sdkwork.database.module') {
      fail('database.manifest.json kind must be sdkwork.database.module');
    }
    if (!manifest.moduleId || !manifest.serviceCode) {
      fail('database.manifest.json must define moduleId and serviceCode');
    }
    const activeLocales = manifest.lifecycle?.activeSeedLocales ?? ['zh-CN'];
    if (!activeLocales.includes('zh-CN')) {
      fail('database.manifest.json lifecycle.activeSeedLocales must include zh-CN');
    }
  } catch (error) {
    fail(`database.manifest.json must be valid JSON (${error.message})`);
  }

  try {
    const seedManifest = readJsonAt(moduleRootDir, 'seeds/seed.manifest.json');
    if (seedManifest.kind !== 'sdkwork.database.seed') {
      fail('seeds/seed.manifest.json kind must be sdkwork.database.seed');
    }
    if (seedManifest.defaultLocale !== 'zh-CN') {
      fail('seeds/seed.manifest.json defaultLocale must be zh-CN');
    }
  } catch (error) {
    fail(`seeds/seed.manifest.json must be valid JSON (${error.message})`);
  }

  return { ok: failures.length === 0, failures };
}

export function validateDatabaseFramework(rootDir) {
  if (!existsAt(rootDir, 'database')) {
    return { ok: true, skipped: true, failures: [] };
  }

  const moduleResult = validateDatabaseModuleLayout(path.join(rootDir, 'database'));
  const contractResult = validateDatabaseModuleContract(path.join(rootDir, 'database'));
  const failures = [...moduleResult.failures, ...contractResult.failures];
  const packageJsonPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts ?? {};
    for (const scriptName of REQUIRED_DB_SCRIPTS) {
      if (!scripts[scriptName]) {
        failures.push(`package.json scripts must define ${scriptName}`);
      }
    }
    for (const scriptName of L2_DB_SCRIPTS) {
      if (!scripts[scriptName]) {
        failures.push(`package.json scripts must define ${scriptName} for L2 database modules`);
      }
    }
  }

  return { ok: failures.length === 0, skipped: false, failures };
}

function main() {
  const { root, layout } = parseArgs(process.argv.slice(2));

  if (layout === 'module') {
    const result = validateDatabaseModuleLayout(root);
    if (!result.ok) {
      process.stderr.write(
        `Database module layout failed:\n${result.failures.map((item) => `- ${item}`).join('\n')}\n`,
      );
      process.exit(1);
    }
    process.stdout.write('Database module layout passed\n');
    return;
  }

  const result = validateDatabaseFramework(root);

  if (result.skipped) {
    process.stdout.write('Database framework standard skipped (no database/ directory)\n');
    return;
  }

  if (!result.ok) {
    process.stderr.write(
      `Database framework standard failed:\n${result.failures.map((item) => `- ${item}`).join('\n')}\n`,
    );
    process.exit(1);
  }

  process.stdout.write('Database framework standard passed\n');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main();
}
