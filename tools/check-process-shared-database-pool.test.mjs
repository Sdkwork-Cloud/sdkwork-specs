#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateProcessSharedDatabasePool } from './check-process-shared-database-pool.mjs';

function write(root, relativePath, content) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function scaffold() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-process-pool-'));
  write(
    root,
    '.env.postgres.example',
    'SDKWORK_DEMO_DATABASE_NAME=sdkwork_ai_dev\nSDKWORK_DEMO_DATABASE_SCHEMA=sdkwork_ai_dev\n',
  );
  write(
    root,
    'crates/sdkwork-api-demo-standalone-gateway/src/main.rs',
    'fn main() { enable_process_shared_database_pool(); bootstrap_demo_database_from_env(); }\n',
  );
  write(
    root,
    'crates/sdkwork-api-demo-assembly/src/bootstrap.rs',
    'fn assemble(pool: DatabasePool) { let _consumer = pool.clone(); }\n',
  );
  write(
    root,
    'specs/process-database-pool.spec.json',
    `${JSON.stringify({
      schemaVersion: 1,
      kind: 'sdkwork.process-database-pool',
      profile: {
        exampleFile: '.env.postgres.example',
        database: 'sdkwork_ai_dev',
        schema: 'sdkwork_ai_dev',
      },
      processes: [{
        id: 'sdkwork-api-demo-standalone-gateway',
        entrypoint: 'crates/sdkwork-api-demo-standalone-gateway/src/main.rs',
        poolOwner: 'crates/sdkwork-api-demo-standalone-gateway/src/main.rs',
        driver: 'sdkwork-database-sqlx-pg',
        poolCount: 1,
        databaseUrlEnv: 'SDKWORK_DEMO_DATABASE_URL',
        schemaEnv: 'SDKWORK_DEMO_DATABASE_SCHEMA',
        maxConnectionsEnv: 'SDKWORK_DEMO_DATABASE_MAX_CONNECTIONS',
        productionSourceRoots: ['crates/sdkwork-api-demo-standalone-gateway/src'],
        consumers: [{
          module: 'demo',
          poolMode: 'injected',
          evidence: ['crates/sdkwork-api-demo-assembly/src/bootstrap.rs'],
        }],
        temporaryDriverExceptions: [],
      }],
      verification: [
        'node ../sdkwork-specs/tools/check-process-shared-database-pool.mjs --root .',
      ],
    }, null, 2)}\n`,
  );
  return root;
}

const validRoot = scaffold();
assert.equal(validateProcessSharedDatabasePool(validRoot).ok, true);

const lateEnableRoot = scaffold();
write(
  lateEnableRoot,
  'crates/sdkwork-api-demo-standalone-gateway/src/main.rs',
  'fn main() { bootstrap_demo_database_from_env(); enable_process_shared_database_pool(); }\n',
);
const lateEnable = validateProcessSharedDatabasePool(lateEnableRoot);
assert.equal(lateEnable.ok, false);
assert.ok(lateEnable.failures.some((failure) => failure.includes('after database bootstrap')));

const duplicatePoolRoot = scaffold();
write(
  duplicatePoolRoot,
  'crates/sdkwork-api-demo-standalone-gateway/src/extra.rs',
  'fn open() { let _pool = PgPoolOptions::new(); }\n',
);
const duplicatePool = validateProcessSharedDatabasePool(duplicatePoolRoot);
assert.equal(duplicatePool.ok, false);
assert.ok(duplicatePool.failures.some((failure) => failure.includes('PgPoolOptions::new')));

const testPoolRoot = scaffold();
write(
  testPoolRoot,
  'crates/sdkwork-api-demo-standalone-gateway/src/test_support.rs',
  '#[cfg(test)]\nmod tests { fn open() { let _pool = PgPoolOptions::new(); } }\n',
);
assert.equal(validateProcessSharedDatabasePool(testPoolRoot).ok, true);

const schemaMismatchRoot = scaffold();
const contractPath = path.join(schemaMismatchRoot, 'specs/process-database-pool.spec.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
contract.profile.schema = 'other_schema';
fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
const schemaMismatch = validateProcessSharedDatabasePool(schemaMismatchRoot);
assert.equal(schemaMismatch.ok, false);
assert.ok(schemaMismatch.failures.some((failure) => failure.includes('profile schema mismatch')));

process.stdout.write('check-process-shared-database-pool.test.mjs passed\n');
