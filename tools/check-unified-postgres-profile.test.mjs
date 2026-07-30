#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectLine } from './check-unified-postgres-profile.mjs';

test('accepts the canonical shared development identity', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.equal(inspectLine('SDKWORK_DATABASE_NAME=sdkwork_ai_dev', filePath), null);
  assert.equal(inspectLine('SDKWORK_DATABASE_SCHEMA=sdkwork_ai_dev', filePath), null);
  assert.equal(inspectLine('SDKWORK_DATABASE_USERNAME=sdkwork_ai_dev', filePath), null);
});

test('rejects application-prefixed database identity keys', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.match(
    inspectLine('SDKWORK_DEMO_DATABASE_NAME=sdkwork_ai_dev', filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine('SDKWORK_DEMO_DATABASE_URL=postgresql://sdkwork_ai_dev:secret@db:5432/sdkwork_ai_dev', filePath),
    /retired application\/module-prefixed database key/u,
  );
});

test('requires exact shared identities in every application development profile', () => {
  const filePath = 'sdkwork-demo/etc/topology/standalone.development.env';
  assert.match(
    inspectLine('SDKWORK_DEMO_DATABASE_NAME=postgres', filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine('SDKWORK_DEMO_DATABASE_SCHEMA=sdkwork_ai_prod', filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine('SDKWORK_DEMO_DATABASE_USERNAME=postgres', filePath),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(
      'SDKWORK_DEMO_DATABASE_URL=postgresql://sdkwork_ai_prod:secret@db:5432/sdkwork_ai_prod',
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
    inspectLine('SDKWORK_DEMO_DATABASE_SCHEMA=sdkwork_demo_dev', filePath),
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
    inspectLine('SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev', 'sdkwork-demo/.env.postgres.example'),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(
      'SDKWORK_CLAW_DATABASE_URL=${SDKWORK_DATABASE_URL}',
      'sdkwork-demo/etc/topology/standalone.development.env',
    ),
    /retired application\/module-prefixed database key/u,
  );
  assert.match(
    inspectLine(
      '# SDKWORK_CLAW_DATABASE_URL=postgresql://db.example.com/sdkwork_ai_dev',
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
