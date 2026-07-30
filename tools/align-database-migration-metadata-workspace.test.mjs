#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { alignMigrationDirectory } from './align-database-migration-metadata-workspace.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-migration-metadata-'));
const migrations = path.join(root, 'migrations/postgres');
fs.mkdirSync(migrations, { recursive: true });
const upPath = path.join(migrations, '0001_demo.up.sql');
fs.writeFileSync(upPath, 'CREATE TABLE demo (id BIGINT PRIMARY KEY);\n', 'utf8');
fs.writeFileSync(path.join(migrations, '0001_demo.down.sql'), 'DROP TABLE demo;\n', 'utf8');

const dryRun = alignMigrationDirectory(root, 'postgres');
assert.deepEqual(dryRun, [upPath]);
assert.doesNotMatch(fs.readFileSync(upPath, 'utf8'), /sdkwork:migration/u);

alignMigrationDirectory(root, 'postgres', { write: true });
const source = fs.readFileSync(upPath, 'utf8');
for (const expected of [
  '-- sdkwork:migration',
  '-- engine: postgres',
  '-- reversible: true',
  '-- rollback: down-migration',
  '-- transactional: true',
  '-- lock: access-exclusive',
  '-- lock_timeout: 2s',
  '-- statement_timeout: 30s',
]) {
  assert.ok(source.includes(expected), `migration header must include ${expected}`);
}
assert.deepEqual(alignMigrationDirectory(root, 'postgres', { write: true }), []);

const trackedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-tracked-migration-'));
const trackedMigrations = path.join(trackedRoot, 'migrations/postgres');
fs.mkdirSync(trackedMigrations, { recursive: true });
const trackedPath = path.join(trackedMigrations, '0001_historical.up.sql');
const trackedSource = 'CREATE TABLE historical (id BIGINT PRIMARY KEY);\n';
fs.writeFileSync(trackedPath, trackedSource, 'utf8');
execFileSync('git', ['init'], { cwd: trackedRoot, stdio: 'ignore' });
execFileSync('git', ['add', 'migrations/postgres/0001_historical.up.sql'], {
  cwd: trackedRoot,
  stdio: 'ignore',
});

assert.deepEqual(
  alignMigrationDirectory(trackedRoot, 'postgres', { write: true }),
  [path.join(trackedMigrations, 'metadata.json')],
  'tracked migrations must receive checksum-external metadata',
);
assert.equal(fs.readFileSync(trackedPath, 'utf8'), trackedSource);
const trackedMetadata = JSON.parse(
  fs.readFileSync(path.join(trackedMigrations, 'metadata.json'), 'utf8'),
);
assert.deepEqual(trackedMetadata.migrations['0001_historical.up.sql'], {
  engine: 'postgres',
  reversible: 'false',
  rollback: 'forward-fix',
  transactional: 'true',
  lock: 'access-exclusive',
  lock_timeout: '2s',
  statement_timeout: '30s',
});
assert.deepEqual(alignMigrationDirectory(trackedRoot, 'postgres', { write: true }), []);

process.stdout.write('align-database-migration-metadata-workspace.test.mjs passed\n');
