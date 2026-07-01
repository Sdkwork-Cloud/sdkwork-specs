import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  buildPostgresDatabaseUrl,
  parseClawPostgresConfig,
} from './postgres-config.mjs';
import { ensurePostgresDevEnvFile } from './postgres-dev-profile.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-postgres-tools-'));
const envExample = path.join(fixtureRoot, '.env.postgres.example');
fs.writeFileSync(envExample, `SDKWORK_CLAW_DATABASE_ENGINE=postgresql
SDKWORK_CLAW_DATABASE_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_PORT=5432
SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev
SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123
SDKWORK_CLAW_DATABASE_SSL_MODE=disable
SDKWORK_CLAW_DATABASE_ADMIN_HOST=127.0.0.1
SDKWORK_CLAW_DATABASE_ADMIN_PORT=5432
SDKWORK_CLAW_DATABASE_ADMIN_USERNAME=postgres
SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD=postgres_admin_pass
SDKWORK_CLAW_DATABASE_ADMIN_DATABASE=postgres
SDKWORK_CLAW_DATABASE_ADMIN_SSL_MODE=disable
`);

const envPath = ensurePostgresDevEnvFile(fixtureRoot, { stdout: { write() {} } });
assert.equal(envPath, path.join(fixtureRoot, '.env.postgres'));

const config = parseClawPostgresConfig({ configPath: envPath, repoRoot: fixtureRoot });
assert.equal(config.database.database, 'sdkwork_ai_dev');
assert.equal(config.admin.username, 'postgres');
assert.match(
  buildPostgresDatabaseUrl(config.database),
  /^postgresql:\/\/sdkwork_ai_dev:/u,
);

import { SDKWORK_DEV_POSTGRES_EXTENSIONS } from './postgres-extensions.mjs';
assert.ok(SDKWORK_DEV_POSTGRES_EXTENSIONS.some((entry) => entry.extension === 'vector'));
assert.ok(SDKWORK_DEV_POSTGRES_EXTENSIONS.some((entry) => entry.extension === 'pg_trgm'));

console.log('postgres-db-cli shared tools contract passed');
