#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectLine } from './check-unified-postgres-profile.mjs';

test('accepts the canonical shared development identity', () => {
  const filePath = 'sdkwork-demo/.env.postgres.example';
  assert.equal(inspectLine('SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev', filePath), null);
  assert.equal(inspectLine('SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev', filePath), null);
  assert.equal(inspectLine('SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev', filePath), null);
});

test('rejects application-specific development databases and schemas', () => {
  const filePath = 'sdkwork-clawrouter/.env.postgres.example';
  assert.match(
    inspectLine('SDKWORK_CLAW_DATABASE_NAME=sdkwork_clawrouter_dev', filePath),
    /non-canonical/u,
  );
  assert.match(
    inspectLine('SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_clawrouter_dev', filePath),
    /non-canonical/u,
  );
  assert.match(
    inspectLine('SDKWORK_DEMO_DATABASE_SCHEMA=sdkwork_demo_dev', filePath),
    /non-canonical/u,
  );
});

test('rejects application-specific PostgreSQL URL targets', () => {
  const filePath = 'sdkwork-clawrouter/etc/topology/standalone.development.env';
  assert.match(
    inspectLine(
      'SDKWORK_CLAW_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sdkwork_clawrouter_dev?sslmode=disable',
      filePath,
    ),
    /non-canonical/u,
  );
});

test('keeps production identity distinct from development identity', () => {
  const productionPath = 'sdkwork-demo/etc/topology/standalone.production.env';
  assert.equal(
    inspectLine('SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod', productionPath),
    null,
  );
  assert.match(
    inspectLine('SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev', productionPath),
    /expected sdkwork_ai_prod/u,
  );
});

test('ignores deployment-time connection placeholders', () => {
  assert.equal(
    inspectLine(
      'SDKWORK_CLAW_DATABASE_URL=postgresql://DEPLOY_INJECT:user@db:5432/DEPLOY_INJECT:database',
      'sdkwork-demo/etc/topology/cloud.production.env',
    ),
    null,
  );
});
