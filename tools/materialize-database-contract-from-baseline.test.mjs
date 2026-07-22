import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const toolPath = fileURLToPath(
  new URL('./materialize-database-contract-from-baseline.mjs', import.meta.url),
);

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runTool(root) {
  execFileSync(
    process.execPath,
    [
      toolPath,
      '--root', root,
      '--baseline', 'database/ddl/baseline/postgres/0001_test_baseline.sql',
      '--module-id', 'test',
      '--owner', 'test-platform',
      '--engines', 'sqlite,postgres',
    ],
    { stdio: 'pipe' },
  );
}

test('materialization preserves semantic contract metadata and is idempotent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-database-materialize-'));
  write(
    root,
    'database/ddl/baseline/postgres/0001_test_baseline.sql',
    [
      'CREATE TABLE IF NOT EXISTS alpha_record (id BIGINT PRIMARY KEY);',
      'CREATE TABLE IF NOT EXISTS beta_record (id BIGINT PRIMARY KEY);',
      '',
    ].join('\n'),
  );
  write(
    root,
    'database/database.manifest.json',
    `${JSON.stringify({ contractVersion: '1.4.0', lifecycle: { autoMigrate: false } }, null, 2)}\n`,
  );
  write(
    root,
    'database/contract/schema.yaml',
    [
      'schema_version: 1',
      'kind: sdkwork.database.schema',
      'module_id: test',
      'contract_version: 1.4.0',
      'owner_team: test-platform',
      'compliance_level: L2',
      'engines:',
      '  - sqlite',
      '  - postgres',
      'table_prefixes:',
      '  - alpha_',
      '  - beta_',
      'tables:',
      '  - name: alpha_record',
      '    lifecycle_status: active',
      '    owner: test-platform',
      '    indexes:',
      '      - name: uk_alpha_record_id',
      '        columns:',
      '          - id',
      '        unique: true',
      '',
    ].join('\n'),
  );

  runTool(root);

  const schemaPath = path.join(root, 'database/contract/schema.yaml');
  const manifestPath = path.join(root, 'database/database.manifest.json');
  const firstSchema = fs.readFileSync(schemaPath, 'utf8');
  const firstManifest = fs.readFileSync(manifestPath, 'utf8');
  assert.match(firstSchema, /^contract_version: 1\.4\.0$/m);
  assert.match(firstSchema, /^table_prefixes:\n  - alpha_\n  - beta_$/m);
  assert.match(firstSchema, /name: uk_alpha_record_id/);
  assert.match(firstSchema, /^  - name: beta_record$/m);
  assert.equal(JSON.parse(firstManifest).contractVersion, '1.4.0');
  assert.equal(JSON.parse(firstManifest).lifecycle.autoMigrate, true);

  runTool(root);

  assert.equal(fs.readFileSync(schemaPath, 'utf8'), firstSchema);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), firstManifest);
});

test('materialization rejects mismatched contract versions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-database-version-mismatch-'));
  write(
    root,
    'database/ddl/baseline/postgres/0001_test_baseline.sql',
    'CREATE TABLE IF NOT EXISTS test_record (id BIGINT PRIMARY KEY);\n',
  );
  write(root, 'database/database.manifest.json', '{"contractVersion":"2.0.0","lifecycle":{}}\n');
  write(
    root,
    'database/contract/schema.yaml',
    'contract_version: 1.0.0\ntables:\n  - name: test_record\n',
  );

  assert.throws(
    () => runTool(root),
    /database contract version mismatch: manifest=2\.0\.0, schema=1\.0\.0/,
  );
});
