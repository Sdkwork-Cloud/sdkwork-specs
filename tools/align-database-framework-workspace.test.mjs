#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { alignDatabaseLayout } from './align-database-framework-workspace.mjs';
import { validateDatabaseFramework } from './check-database-framework-standard.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-align-'));
fs.cpSync(path.resolve('templates/database'), path.join(root, 'database'), { recursive: true });

const manifestPath = path.join(root, 'database/database.manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.schemaVersion = 1;
delete manifest.databaseRole;
manifest.moduleId = 'demo';
manifest.serviceCode = 'DEMO';
manifest.owner = 'demo-platform';
manifest.tablePrefix = 'demo_';
manifest.engines = ['postgres', 'sqlite'];
manifest.baselineStrategy = 'baseline-plus-migrations';
manifest.lifecycle.autoMigrate = true;
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(
  path.join(root, 'database/ddl/baseline/postgres/0001_demo_baseline.sql'),
  'CREATE TABLE demo_probe (id BIGINT PRIMARY KEY);\n',
  'utf8',
);

const schemaPath = path.join(root, 'database/contract/schema.yaml');
let schema = fs.readFileSync(schemaPath, 'utf8');
schema = schema.replace('database_role: authoritative-server\n', '');
schema = schema.replace('module_id: <module-id>', 'module_id: demo');
schema = schema.replace('owner_team: <owner-team>', 'owner_team: demo-platform');
schema = schema.replace('table_prefix: <prefix>_', 'table_prefix: demo_');
schema = schema.replace('  - postgres\n', '  - postgres\n  - sqlite\n');
fs.writeFileSync(schemaPath, schema, 'utf8');
const prefixRegistryPath = path.join(root, 'database/contract/prefix-registry.json');
const prefixRegistry = JSON.parse(fs.readFileSync(prefixRegistryPath, 'utf8'));
prefixRegistry.prefixes = [];
fs.writeFileSync(prefixRegistryPath, `${JSON.stringify(prefixRegistry, null, 2)}\n`, 'utf8');

fs.mkdirSync(path.join(root, 'database/ddl/baseline/sqlite'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'database/ddl/baseline/sqlite/0001_demo_baseline.sql'),
  'CREATE TABLE demo_fixture (id INTEGER PRIMARY KEY);\n',
  'utf8',
);
fs.mkdirSync(path.join(root, 'database/migrations/sqlite'), { recursive: true });
fs.writeFileSync(path.join(root, 'database/migrations/sqlite/.gitkeep'), '', 'utf8');
fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'tests/sqlite-fixture.test.mjs'),
  "const fixture = 'database/ddl/baseline/sqlite/0001_demo_baseline.sql';\n",
  'utf8',
);
fs.writeFileSync(
  path.join(root, 'package.json'),
  `${JSON.stringify({
    scripts: {
      'db:validate': 'echo validate',
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
  }, null, 2)}\n`,
  'utf8',
);

const dryRunChanges = alignDatabaseLayout(root, {
  dryRun: true,
  migrateAuthoritative: true,
});
assert.ok(dryRunChanges.length > 0, 'dry-run should report the authoritative migration');
assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).schemaVersion, 1);

alignDatabaseLayout(root, { migrateAuthoritative: true });
const alignedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(alignedManifest.schemaVersion, 2);
assert.equal(alignedManifest.databaseRole, 'authoritative-server');
assert.deepEqual(alignedManifest.engines, ['postgres']);
assert.equal(alignedManifest.lifecycle.autoMigrate, false);
assert.equal(fs.existsSync(path.join(root, 'database/ddl/baseline/sqlite')), false);
assert.equal(
  fs.existsSync(
    path.join(root, 'tests/fixtures/database/sqlite/ddl/baseline/0001_demo_baseline.sql'),
  ),
  true,
);
assert.match(
  fs.readFileSync(path.join(root, 'tests/sqlite-fixture.test.mjs'), 'utf8'),
  /tests\/fixtures\/database\/sqlite\/ddl\/baseline/u,
);

const validation = validateDatabaseFramework(root);
assert.equal(validation.ok, true, validation.failures.join('\n'));

process.stdout.write('align-database-framework-workspace.test.mjs passed\n');
