import assert from 'node:assert/strict';
import test from 'node:test';

import {
  lifecycleEnvironmentForPath,
  migratePostgresProfileContent,
  workspaceIdentityForEnvironment,
} from './unify-postgres-profile.mjs';

test('resolves every lifecycle environment without mapping staging to production', () => {
  assert.equal(lifecycleEnvironmentForPath('etc/topology/standalone.development.env'), 'development');
  assert.equal(lifecycleEnvironmentForPath('etc/topology/standalone.test.env'), 'test');
  assert.equal(lifecycleEnvironmentForPath('etc/topology/cloud.staging.env'), 'staging');
  assert.equal(lifecycleEnvironmentForPath('etc/topology/cloud.production.env'), 'production');
  assert.equal(workspaceIdentityForEnvironment('staging').database, 'sdkwork_ai_staging');
});

test('renames application and module database keys in source text', () => {
  const source = `SDKWORK_CLAW_DATABASE_URL=postgresql://old:secret@db/sdkwork_claw_dev
SDKWORK_CLAW_ROUTER_DATABASE_AUTO_MIGRATE=true
SDKWORK_IAM_DATABASE_MAX_CONNECTIONS=4`;
  const result = migratePostgresProfileContent(source, 'src/config.rs');
  assert.equal(result.conflicts.length, 0);
  assert.match(result.content, /SDKWORK_DATABASE_URL/u);
  assert.match(result.content, /SDKWORK_DATABASE_AUTO_MIGRATE/u);
  assert.match(result.content, /SDKWORK_DATABASE_MAX_CONNECTIONS/u);
  assert.doesNotMatch(result.content, /SDKWORK_(?:CLAW|CLAW_ROUTER|IAM)_DATABASE_/u);
});

test('normalizes config identity according to the profile path', () => {
  const source = `SDKWORK_DRIVE_DATABASE_NAME=sdkwork_drive_staging
SDKWORK_DRIVE_DATABASE_SCHEMA=public
SDKWORK_DRIVE_DATABASE_USERNAME=sdkwork_drive
SDKWORK_DRIVE_DATABASE_URL=postgresql://sdkwork_drive:secret@db/sdkwork_drive_staging?sslmode=require`;
  const result = migratePostgresProfileContent(
    source,
    'sdkwork-drive/etc/topology/cloud.staging.env',
  );
  assert.equal(result.conflicts.length, 0);
  assert.match(result.content, /SDKWORK_DATABASE_NAME=sdkwork_ai_staging/u);
  assert.match(result.content, /SDKWORK_DATABASE_SCHEMA=sdkwork_ai_staging/u);
  assert.match(result.content, /SDKWORK_DATABASE_USERNAME=sdkwork_ai_staging/u);
  assert.match(
    result.content,
    /postgresql:\/\/sdkwork_ai_staging:secret@db\/sdkwork_ai_staging\?sslmode=require/u,
  );
});

test('detects canonical key conflicts without exposing values', () => {
  const result = migratePostgresProfileContent(
    `SDKWORK_CLAW_DATABASE_PASSWORD=first
SDKWORK_DATABASE_PASSWORD=second`,
    'sdkwork-demo/.env.release.example',
  );
  assert.deepEqual(result.conflicts, ['SDKWORK_DATABASE_PASSWORD']);
});
