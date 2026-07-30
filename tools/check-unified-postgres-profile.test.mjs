#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectLine,
  inspectPostgresExampleFile,
  inspectRuntimeSourceLine,
} from './check-unified-postgres-profile.mjs';

const scopedDatabaseKey = (scope, field) => ['SDKWORK', scope, 'DATABASE', field].join('_');

test('accepts the canonical shared development identity', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.equal(inspectLine('SDKWORK_DATABASE_NAME=sdkwork_ai_dev', filePath), null);
  assert.equal(inspectLine('SDKWORK_DATABASE_SCHEMA=sdkwork_ai_dev', filePath), null);
  assert.equal(inspectLine('SDKWORK_DATABASE_USERNAME=sdkwork_ai_dev', filePath), null);
});

test('accepts a password file as the checked-in PostgreSQL credential source', () => {
  const content = `SDKWORK_DATABASE_ENGINE=postgresql
SDKWORK_DATABASE_HOST=127.0.0.1
SDKWORK_DATABASE_PORT=5432
SDKWORK_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_DATABASE_USERNAME=sdkwork_ai_dev
SDKWORK_DATABASE_PASSWORD_FILE=/run/secrets/sdkwork/database-password
SDKWORK_DATABASE_SSL_MODE=disable
SDKWORK_DATABASE_MAX_CONNECTIONS=10
SDKWORK_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_DATABASE_ADMIN_PORT=5432
SDKWORK_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_DATABASE_ADMIN_SSL_MODE=disable
`;

  assert.deepEqual(
    inspectPostgresExampleFile('sdkwork-demo/.env.postgres.example', content),
    [],
  );
});

test('accepts a direct password as the development PostgreSQL credential source', () => {
  const content = `SDKWORK_DATABASE_ENGINE=postgresql
SDKWORK_DATABASE_HOST=127.0.0.1
SDKWORK_DATABASE_PORT=5432
SDKWORK_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_DATABASE_USERNAME=sdkwork_ai_dev
SDKWORK_DATABASE_PASSWORD=sdkworkdev123
SDKWORK_DATABASE_SSL_MODE=disable
SDKWORK_DATABASE_MAX_CONNECTIONS=10
SDKWORK_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_DATABASE_ADMIN_PORT=5432
SDKWORK_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_DATABASE_ADMIN_SSL_MODE=disable
`;

  assert.deepEqual(
    inspectPostgresExampleFile('sdkwork-demo/.env.postgres.example', content),
    [],
  );
});

test('rejects application-prefixed database identity keys', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.match(
    inspectLine(`${scopedDatabaseKey('DEMO', 'NAME')}=sdkwork_ai_dev`, filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(`${scopedDatabaseKey('DEMO', 'URL')}=postgresql://sdkwork_ai_dev:secret@db:5432/sdkwork_ai_dev`, filePath),
    /retired application\/module-prefixed database key/u,
  );
});

test('requires exact shared identities in every application development profile', () => {
  const filePath = 'sdkwork-demo/etc/topology/standalone.development.env';
  assert.match(
    inspectLine(`${scopedDatabaseKey('DEMO', 'NAME')}=postgres`, filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(`${scopedDatabaseKey('DEMO', 'SCHEMA')}=sdkwork_ai_prod`, filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(`${scopedDatabaseKey('DEMO', 'USERNAME')}=postgres`, filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(
      `${scopedDatabaseKey('DEMO', 'URL')}=postgresql://sdkwork_ai_prod:secret@db:5432/sdkwork_ai_prod`,
      filePath,
    ),
    /retired application\/module-prefixed database key/u,
  );
});

test('rejects application-specific development databases and schemas', () => {
  const filePath = 'sdkwork-clawrouter/.env.postgres.example';
  assert.match(
    inspectLine('SDKWORK_DATABASE_NAME=sdkwork_clawrouter_dev', filePath),
    /non-canonical/u,
  );
  assert.match(
    inspectLine('SDKWORK_DATABASE_SCHEMA=sdkwork_clawrouter_dev', filePath),
    /non-canonical/u,
  );
  assert.match(
    inspectLine(`${scopedDatabaseKey('DEMO', 'SCHEMA')}=sdkwork_demo_dev`, filePath),
    /retired application\/module-prefixed database key/u,
  );
});

test('rejects application-specific PostgreSQL URL targets', () => {
  const filePath = 'sdkwork-clawrouter/etc/topology/standalone.development.env';
  assert.match(
    inspectLine(
      'SDKWORK_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sdkwork_clawrouter_dev?sslmode=disable',
      filePath,
    ),
    /non-canonical/u,
  );
});

test('keeps production identity distinct from development identity', () => {
  const productionPath = 'sdkwork-demo/etc/topology/standalone.production.env';
  assert.equal(
    inspectLine('SDKWORK_DATABASE_NAME=sdkwork_ai_prod', productionPath),
    null,
  );
  assert.match(
    inspectLine('SDKWORK_DATABASE_NAME=sdkwork_ai_dev', productionPath),
    /expected sdkwork_ai_prod/u,
  );
  assert.match(
    inspectLine(
      'SDKWORK_DATABASE_URL=postgresql://sdkwork_ai_dev:secret@db:5432/sdkwork_ai_dev',
      productionPath,
    ),
    /expected sdkwork_ai_prod/u,
  );
});

test('ignores deployment-time connection placeholders', () => {
  assert.equal(
    inspectLine(
      'SDKWORK_DATABASE_URL=postgresql://DEPLOY_INJECT:user@db:5432/DEPLOY_INJECT:database',
      'sdkwork-demo/etc/topology/cloud.production.env',
    ),
    null,
  );
});

test('rejects retired claw-scoped database keys', () => {
  assert.match(
    inspectLine(`${scopedDatabaseKey('CLAW', 'NAME')}=sdkwork_ai_dev`, 'sdkwork-demo/.env.postgres.example'),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(
      `${scopedDatabaseKey('CLAW', 'URL')}=\${SDKWORK_DATABASE_URL}`,
      'sdkwork-demo/etc/topology/standalone.development.env',
    ),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(
      `# ${scopedDatabaseKey('CLAW', 'URL')}=postgresql://db.example.com/sdkwork_ai_dev`,
      'sdkwork-demo/.env.postgres.example',
    ),
    /retired application\/module-prefixed database key/u,
  );
});

test('allows only workspace-scoped test database identities', () => {
  const filePath = 'sdkwork-demo/etc/topology/standalone.test.env';
  assert.equal(inspectLine('SDKWORK_DATABASE_NAME=sdkwork_ai_test', filePath), null);
  assert.equal(inspectLine('SDKWORK_DATABASE_SCHEMA=sdkwork_ai_test_123', filePath), null);
  assert.equal(inspectLine('SDKWORK_DATABASE_USERNAME=sdkwork_ai_test', filePath), null);
  assert.match(
    inspectLine('SDKWORK_DATABASE_USERNAME=sdkwork_ai_test_123', filePath),
    /expected sdkwork_ai_test/u,
  );
  assert.match(
    inspectLine('SDKWORK_DATABASE_NAME=demo_test_123', filePath),
    /expected sdkwork_ai_test/u,
  );
  assert.match(
    inspectLine('database = "sdkwork_drive_test"', filePath),
    /non-canonical/u,
  );
});

test('enforces lifecycle identity for structured TOML fields', () => {
  const stagingPath = 'sdkwork-demo/etc/server/demo.staging.toml.example';
  assert.equal(inspectLine('database = "sdkwork_ai_staging"', stagingPath), null);
  assert.equal(inspectLine('schema = "sdkwork_ai_staging"', stagingPath), null);
  assert.equal(inspectLine('username = "sdkwork_ai_staging"', stagingPath), null);
  assert.match(
    inspectLine('database = "sdkwork_ai_prod"', stagingPath),
    /expected sdkwork_ai_staging/u,
  );
  assert.match(
    inspectLine('schema = "public"', stagingPath),
    /expected sdkwork_ai_staging/u,
  );
});

test('rejects retired generic aliases', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.match(
    inspectLine('SDKWORK_DATABASE_SSLMODE=disable', filePath),
    /SDKWORK_DATABASE_SSL_MODE/u,
  );
  assert.match(inspectLine('DATABASE_PROVIDER=postgresql', filePath), /retired database key/u);
});

test('workspace temporary pool governance keys remain canonical database keys', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.equal(
    inspectLine('SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION=true', filePath),
    null,
  );
  assert.equal(
    inspectLine('SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT=1', filePath),
    null,
  );
});

test('runtime source rejects concrete module-scoped database keys', () => {
  assert.match(
    inspectRuntimeSourceLine(`${scopedDatabaseKey('CLAW', 'URL')}=postgresql://localhost/db`),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectRuntimeSourceLine('const KEY: &str = "SDKWORK_AIOT_DEVICE_DATABASE_ENGINE";'),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectRuntimeSourceLine('std::env::var("TEST_DATABASE_URL")'),
    /retired legacy database key/u,
  );
  assert.match(
    inspectRuntimeSourceLine('std::env::var("SDKWORK_CLIENT_DATABASE_PATH")'),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectRuntimeSourceLine('const KEY: &str = "SDKWORK_DRIVE_DATABASE_SQLITE_URL";'),
    /retired application\/module-prefixed database key/u,
  );
});

test('runtime source rejects retired workspace SQLite and SSL aliases', () => {
  assert.match(
    inspectRuntimeSourceLine('std::env::var("SDKWORK_DATABASE_PATH")'),
    /retired workspace database alias/u,
  );
  assert.match(
    inspectRuntimeSourceLine('std::env::var("SDKWORK_DATABASE_SQLITE_URL")'),
    /retired workspace database alias/u,
  );
  assert.match(
    inspectRuntimeSourceLine('std::env::var("SDKWORK_DATABASE_SSLMODE")'),
    /retired workspace database alias/u,
  );
});

test('runtime source permits explicit fail-closed retired-key rejection definitions', () => {
  assert.equal(
    inspectRuntimeSourceLine(
      '"SDKWORK_DATABASE_SSLMODE" // sdkwork-retired-database-key-rejection',
    ),
    null,
  );
});

test('runtime source allows internal database-related identifier names', () => {
  assert.equal(
    inspectRuntimeSourceLine('const DEFAULT_SQLITE_DATABASE_URL: &str = "sqlite::memory:";'),
    null,
  );
  assert.equal(
    inspectRuntimeSourceLine('struct IamDatabaseHost;'),
    null,
  );
});

test('checked-in topology env rejects legacy database keys without SDKWORK prefix', () => {
  assert.match(
    inspectLine(
      'GAMES_DATABASE_URL=postgresql://sdkwork_ai_dev:secret@db:5432/sdkwork_ai_dev',
      'sdkwork-games/configs/topology/standalone.development.env',
    ),
    /retired legacy database key/u,
  );
});

test('runtime source rejects invalid generic mode and table-prefix keys', () => {
  assert.match(
    inspectRuntimeSourceLine('SDKWORK_DATABASE_MODE=pool'),
    /unsupported workspace database key/u,
  );
  assert.match(
    inspectRuntimeSourceLine('const TABLE_PREFIX_KEY = "SDKWORK_DATABASE_TABLE_PREFIX";'),
    /unsupported workspace database key/u,
  );
});

test('runtime source rejects dynamic module-scoped database key construction', () => {
  assert.match(
    inspectRuntimeSourceLine('const key = `SDKWORK_${service}_DATABASE_URL`;'),
    /dynamic application\/module-prefixed database key construction/u,
  );
  assert.match(
    inspectRuntimeSourceLine('let key = format!("SDKWORK_{service}_DATABASE_URL");'),
    /dynamic application\/module-prefixed database key construction/u,
  );
  assert.match(
    inspectRuntimeSourceLine("const key = 'SDKWORK_' + service + '_DATABASE_URL';"),
    /concatenated application\/module-prefixed database key construction/u,
  );
});

test('runtime source accepts canonical database keys and module ownership metadata', () => {
  assert.equal(inspectRuntimeSourceLine('SDKWORK_DATABASE_URL=postgresql://localhost/db'), null);
  assert.equal(inspectRuntimeSourceLine('SDKWORK_DATABASE_MODULE_ID=iot'), null);
  assert.equal(inspectRuntimeSourceLine('SDKWORK_DATABASE_MAX_CONNECTIONS=10'), null);
  assert.equal(inspectRuntimeSourceLine('SDKWORK_DATABASE_FILE=.data/client.db'), null);
});
