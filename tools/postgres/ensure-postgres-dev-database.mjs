import process from 'node:process';

import { executePostgresInitWithNode } from './postgres-init-node.mjs';
import {
  isPostgresDevProfile,
  resolvePostgresDevProfile,
} from './postgres-dev-profile.mjs';
import { validateAdminExecutionConfig } from './postgres-config.mjs';

function normalizeText(value) {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function shouldAutoPreparePostgresDevDatabase(env = process.env) {
  const flag = normalizeText(env.SDKWORK_DEV_POSTGRES_AUTO_PREPARE)
    ?? normalizeText(env.SDKWORK_IM_DEV_POSTGRES_AUTO_MIGRATE);
  if (!flag) {
    return true;
  }
  return !['0', 'false', 'off', 'no'].includes(flag.toLowerCase());
}

export async function ensurePostgresDevDatabaseReady({
  env = process.env,
  repoRoot,
  stdout = process.stdout,
  stderr = process.stderr,
  legacyDatabasePrefixes = [],
  runMigrations,
} = {}) {
  if (!isPostgresDevProfile(env)) {
    return { skipped: true, reason: 'non-postgres-profile' };
  }
  if (!shouldAutoPreparePostgresDevDatabase(env)) {
    return { skipped: true, reason: 'auto-prepare-disabled' };
  }

  const profile = resolvePostgresDevProfile({
    env,
    legacyDatabasePrefixes,
    repoRoot,
    stdout,
  });
  stdout.write(
    `[sdkwork-postgres] using ${profile.configPath} for dev database init and app runtime\n`,
  );
  stdout.write('[sdkwork-postgres] ensuring PostgreSQL role and schema before dev startup\n');

  try {
    validateAdminExecutionConfig(profile.config.admin);
    await executePostgresInitWithNode(profile.config);
    let migrateResult;
    if (typeof runMigrations === 'function') {
      migrateResult = await runMigrations(profile);
    }
    return {
      configPath: profile.configPath,
      databaseUrl: profile.databaseUrl,
      migrateResult,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const poolExhausted = /pool timed out while waiting for an open connection|Pool creation error: pool timed out/i.test(message);
    stderr.write(
      '[sdkwork-postgres] automatic PostgreSQL prepare failed during dev startup\n'
      + `${message}\n`,
    );
    if (poolExhausted) {
      stderr.write(
        'PostgreSQL is reachable but the connection pool is exhausted. Stop stale dev gateways, then retry:\n'
        + '  taskkill /F /IM sdkwork-api-im-standalone-gateway.exe\n'
        + '  taskkill /F /IM sdkwork-api-clawrouter-standalone-gateway.exe\n'
        + '  pnpm db:postgres:migrate\n'
        + '  pnpm dev\n',
      );
    } else {
      stderr.write(
        `Edit database credentials in ${profile.configPath}, then run:\n`
        + '  pnpm db:postgres:init\n'
        + '  pnpm db:init\n',
      );
    }
    throw error;
  }
}
