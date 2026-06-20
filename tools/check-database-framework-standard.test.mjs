#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDatabaseFramework, validateDatabaseModuleLayout } from './check-database-framework-standard.mjs';

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
      lifecycle: { activeSeedLocales: ['zh-CN'] },
    },
    rootDir,
  );
  writeText(
    'database/contract/schema.yaml',
    'schema_version: 1\nkind: sdkwork.database.schema\nmodule_id: demo\ntables: []\n',
    rootDir,
  );
  writeJson('database/contract/prefix-registry.json', { schemaVersion: 1, prefixes: [] }, rootDir);
  writeJson('database/contract/table-registry.json', { schemaVersion: 1, tables: [] }, rootDir);
  writeJson(
    'database/seeds/seed.manifest.json',
    {
      schemaVersion: 1,
      kind: 'sdkwork.database.seed',
      defaultLocale: 'zh-CN',
      supportedLocales: ['zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 'ru-RU', 'ko-KR'],
      activeLocales: ['zh-CN'],
      profiles: { standard: { common: [], locales: { 'zh-CN': [] } } },
    },
    rootDir,
  );
  writeText('database/drift/policy.yaml', 'schemaVersion: 1\nkind: sdkwork.database.drift-policy\nrules: {}\n', rootDir);
  writeText('database/migrations/postgres/.gitkeep', '', rootDir);
  writeText('database/migrations/sqlite/.gitkeep', '', rootDir);
  writeText('database/seeds/common/.gitkeep', '', rootDir);
  writeText('database/ddl/baseline/postgres/.gitkeep', '', rootDir);
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

process.stdout.write('check-database-framework-standard.test.mjs passed\n');
