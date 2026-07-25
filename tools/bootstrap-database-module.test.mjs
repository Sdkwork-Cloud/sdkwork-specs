#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertPostgresLegacySqlGlobs,
  materializeLegacyBaseline,
} from './bootstrap-database-module.mjs';

const invalidConfig = {
  repo: 'sdkwork-demo',
  moduleId: 'demo',
  legacySqlGlobs: [
    'crates/demo/migrations/postgres/*.sql',
    'crates/demo/migrations/sqlite/*.sql',
  ],
};

assert.throws(
  () => assertPostgresLegacySqlGlobs(invalidConfig),
  /must not import SQLite sources/u,
  'authoritative bootstrap must reject SQLite source globs',
);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-db-bootstrap-'));
try {
  const postgresDir = path.join(tempRoot, 'crates/demo/migrations/postgres');
  const databaseDir = path.join(tempRoot, 'database');
  fs.mkdirSync(postgresDir, { recursive: true });
  fs.mkdirSync(path.join(databaseDir, 'ddl/baseline/postgres'), { recursive: true });
  fs.writeFileSync(
    path.join(postgresDir, '0001_init.sql'),
    'CREATE TABLE demo_probe (id BIGINT PRIMARY KEY);\n',
    'utf8',
  );

  const copied = materializeLegacyBaseline(
    tempRoot,
    {
      repo: 'sdkwork-demo',
      moduleId: 'demo',
      legacySqlGlobs: ['crates/demo/migrations/postgres/*.sql'],
    },
    databaseDir,
  );

  assert.deepEqual(copied, ['crates/demo/migrations/postgres/0001_init.sql']);
  const baseline = fs.readFileSync(
    path.join(databaseDir, 'ddl/baseline/postgres/0001_demo_baseline.sql'),
    'utf8',
  );
  assert.match(baseline, /migrations\/postgres\/0001_init\.sql/u);
  assert.doesNotMatch(baseline, /migrations\/sqlite\//u);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

process.stdout.write('bootstrap-database-module.test.mjs passed\n');
