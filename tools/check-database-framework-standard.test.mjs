#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDatabaseFramework, validateDatabaseModuleLayout, validateDatabaseModuleContract } from './check-database-framework-standard.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

function writeJson(relativePath, value, rootDir) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relativePath, value, rootDir) {
  const absolutePath = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, value, 'utf8');
}

function scaffoldValidDatabaseRoot(rootDir) {
  writeText('database/README.md', '# database\n', rootDir);
  writeJson(
    'database/database.manifest.json',
    {
      schemaVersion: 1,
      kind: 'sdkwork.database.module',
      moduleId: 'demo',
      serviceCode: 'DEMO',
      contractVersion: '1.0.0',
      engines: ['postgres'],
      lifecycle: { activeSeedLocales: ['zh-CN'], autoMigrate: true },
    },
    rootDir,
  );
  writeText(
    'database/contract/schema.yaml',
    'schema_version: 1\nkind: sdkwork.database.schema\nmodule_id: demo\ntables: []\n',
    rootDir,
  );
  writeJson('database/contract/prefix-registry.json', {
    schemaVersion: 1,
    kind: 'sdkwork.database.prefix-registry',
    prefixes: [{ prefix: 'demo_', owner: 'demo-platform', domain: 'demo' }],
  }, rootDir);
  writeJson('database/contract/table-registry.json', {
    schemaVersion: 1,
    kind: 'sdkwork.database.table-registry',
    tables: [{ table_name: 'demo_probe', owner: 'demo-platform', compliance_level: 'L2', lifecycle_status: 'active' }],
  }, rootDir);
  writeJson(
    'database/seeds/seed.manifest.json',
    {
      schemaVersion: 1,
      kind: 'sdkwork.database.seed',
      i18nVersion: '1.0.0',
      defaultLocale: 'zh-CN',
      fallbackLocale: 'zh-CN',
      supportedLocales: ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'ru-RU', 'ko-KR'],
      activeLocales: ['zh-CN'],
      localeSets: {
        'zh-CN': {
          version: '1.0.0',
          required: true,
          checksum: 'sha256:test',
          files: [],
        },
      },
      profiles: { standard: { common: [], locales: { 'zh-CN': [] } } },
    },
    rootDir,
  );
  writeText('database/drift/policy.yaml', 'schemaVersion: 1\nkind: sdkwork.database.drift-policy\nrules: {}\n', rootDir);
  writeText('database/migrations/postgres/.gitkeep', '', rootDir);
  writeText('database/migrations/sqlite/.gitkeep', '', rootDir);
  writeText('database/seeds/common/.gitkeep', '', rootDir);
  writeText('database/ddl/baseline/postgres/0001_demo_baseline.sql', 'CREATE TABLE demo_probe (id INTEGER PRIMARY KEY);\n', rootDir);
  writeText('database/ddl/baseline/sqlite/.gitkeep', '', rootDir);
  writeText('database/ddl/generated/.gitkeep', '', rootDir);
  writeText('database/fixtures/.gitkeep', '', rootDir);
  for (const locale of ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'ru-RU', 'ko-KR']) {
    writeText(`database/seeds/locales/${locale}/.gitkeep`, '', rootDir);
  }
  writeJson(
    'package.json',
    {
      scripts: {
        'db:validate': 'node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .',
        'db:plan': 'echo plan',
        'db:init': 'echo init',
        'db:migrate': 'echo migrate',
        'db:seed': 'echo seed',
        'db:status': 'echo status',
        'db:drift': 'echo drift',
        'db:drift:check': 'echo drift-check',
        'db:materialize:contract': 'echo materialize',
        'db:bootstrap': 'echo bootstrap',
      },
    },
    rootDir,
  );
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-framework-'));
scaffoldValidDatabaseRoot(tempRoot);
const valid = validateDatabaseFramework(tempRoot);
assert.equal(valid.ok, true, 'valid scaffold should pass');

const missingLocaleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-framework-'));
scaffoldValidDatabaseRoot(missingLocaleRoot);
fs.rmSync(path.join(missingLocaleRoot, 'database/seeds/locales/ko-KR'), { recursive: true, force: true });
const missingLocale = validateDatabaseFramework(missingLocaleRoot);
assert.equal(missingLocale.ok, false, 'missing locale directory should fail');

const missingI18nRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-framework-'));
scaffoldValidDatabaseRoot(missingI18nRoot);
const seedManifest = JSON.parse(
  fs.readFileSync(path.join(missingI18nRoot, 'database/seeds/seed.manifest.json'), 'utf8'),
);
delete seedManifest.i18nVersion;
delete seedManifest.localeSets;
fs.writeFileSync(
  path.join(missingI18nRoot, 'database/seeds/seed.manifest.json'),
  `${JSON.stringify(seedManifest, null, 2)}\n`,
);
const missingI18n = validateDatabaseModuleLayout(path.join(missingI18nRoot, 'database'));
assert.equal(missingI18n.ok, false, 'missing seed i18n metadata should fail');
assert.ok(
  missingI18n.failures.some((item) => item.includes('i18nVersion') || item.includes('localeSets')),
  'failure should mention seed i18n metadata',
);

const templateRoot = path.resolve(toolsDir, '../templates/database');
const templateResult = validateDatabaseModuleLayout(templateRoot);
assert.equal(templateResult.ok, true, 'templates/database should satisfy module layout checks');

const missingDownRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-framework-'));
scaffoldValidDatabaseRoot(missingDownRoot);
writeText(
  'database/migrations/sqlite/0001_create_demo.up.sql',
  'CREATE TABLE demo_probe (id INTEGER PRIMARY KEY);',
  missingDownRoot,
);
const missingDown = validateDatabaseModuleLayout(path.join(missingDownRoot, 'database'));
assert.equal(missingDown.ok, false, 'up migration without down.sql should fail');
assert.ok(
  missingDown.failures.some((item) => item.includes('.down.sql')),
  'failure should mention missing down.sql',
);

const missingBaselineRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-framework-'));
scaffoldValidDatabaseRoot(missingBaselineRoot);
fs.rmSync(path.join(missingBaselineRoot, 'database/ddl/baseline/postgres/0001_demo_baseline.sql'));
const missingBaseline = validateDatabaseModuleContract(path.join(missingBaselineRoot, 'database'));
assert.equal(missingBaseline.ok, false, 'missing postgres baseline should fail L2 contract checks');

const autoMigrateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-framework-'));
scaffoldValidDatabaseRoot(autoMigrateRoot);
const autoMigrateManifest = JSON.parse(
  fs.readFileSync(path.join(autoMigrateRoot, 'database/database.manifest.json'), 'utf8'),
);
autoMigrateManifest.lifecycle.autoMigrate = false;
fs.writeFileSync(
  path.join(autoMigrateRoot, 'database/database.manifest.json'),
  `${JSON.stringify(autoMigrateManifest, null, 2)}\n`,
);
const autoMigrate = validateDatabaseModuleContract(path.join(autoMigrateRoot, 'database'));
assert.equal(autoMigrate.ok, false, 'autoMigrate false should fail L2 contract checks');

process.stdout.write('check-database-framework-standard.test.mjs passed\n');
