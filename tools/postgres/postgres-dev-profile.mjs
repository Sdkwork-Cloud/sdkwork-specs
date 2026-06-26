import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import {
  buildPostgresDatabaseUrl,
  clawDatabaseEnvFromConfig,
  parseClawPostgresConfig,
  parseDotEnv,
} from './postgres-config.mjs';

export const POSTGRES_DEV_ENV_FILENAME = '.env.postgres';
export const POSTGRES_DEV_ENV_EXAMPLE_FILENAME = '.env.postgres.example';

const DATABASE_ENV_PREFIXES = [
  'SDKWORK_CLAW_DATABASE_',
  'SDKWORK_IAM_DATABASE_',
  'SDKWORK_DATABASE_',
];

function isDatabaseEnvKey(key) {
  return DATABASE_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))
    || /^SDKWORK_[A-Z0-9_]+_DATABASE_/u.test(key);
}

export function resolvePostgresDevEnvFilePath(repoRoot) {
  return path.resolve(repoRoot, POSTGRES_DEV_ENV_FILENAME);
}

export function resolvePostgresDevEnvExamplePath(repoRoot) {
  return path.resolve(repoRoot, POSTGRES_DEV_ENV_EXAMPLE_FILENAME);
}

export function ensurePostgresDevEnvFile(repoRoot, {
  stdout = process.stdout,
} = {}) {
  const envFilePath = resolvePostgresDevEnvFilePath(repoRoot);
  if (fs.existsSync(envFilePath)) {
    return envFilePath;
  }
  const examplePath = resolvePostgresDevEnvExamplePath(repoRoot);
  if (!fs.existsSync(examplePath)) {
    throw new Error(
      `PostgreSQL dev env is missing (${envFilePath}) and no example file exists at ${examplePath}`,
    );
  }
  fs.copyFileSync(examplePath, envFilePath);
  stdout.write(
    `[sdkwork-postgres] created ${POSTGRES_DEV_ENV_FILENAME} from ${POSTGRES_DEV_ENV_EXAMPLE_FILENAME}; `
    + 'edit database credentials there once, then app startup and db:* commands stay aligned\n',
  );
  return envFilePath;
}

export function readPostgresDevFileEnv(repoRoot, {
  ensureFile = true,
  stdout = process.stdout,
} = {}) {
  const configPath = ensureFile
    ? ensurePostgresDevEnvFile(repoRoot, { stdout })
    : resolvePostgresDevEnvFilePath(repoRoot);
  if (!fs.existsSync(configPath)) {
    return { configPath, fileEnv: {} };
  }
  return {
    configPath,
    fileEnv: parseDotEnv(fs.readFileSync(configPath, 'utf8')),
  };
}

export function mergePostgresDevRuntimeEnv({
  env = process.env,
  fileEnv,
  extraEnv = {},
}) {
  const runtimeWithoutDatabase = { ...env };
  for (const key of Object.keys(runtimeWithoutDatabase)) {
    if (isDatabaseEnvKey(key)) {
      delete runtimeWithoutDatabase[key];
    }
  }
  return {
    ...runtimeWithoutDatabase,
    ...fileEnv,
    ...extraEnv,
  };
}

export function resolvePostgresDevProfile({
  env = process.env,
  extraEnv = {},
  repoRoot,
  legacyDatabasePrefixes = [],
  ensureFile = true,
  stdout = process.stdout,
} = {}) {
  if (!repoRoot) {
    throw new Error('resolvePostgresDevProfile requires repoRoot');
  }
  const { configPath, fileEnv } = readPostgresDevFileEnv(repoRoot, { ensureFile, stdout });
  const mergedEnv = mergePostgresDevRuntimeEnv({ env, fileEnv, extraEnv });
  const config = parseClawPostgresConfig({
    configPath,
    repoRoot,
    legacyDatabasePrefixes,
  });
  const databaseUrl = buildPostgresDatabaseUrl(config.database);
  return {
    config,
    configPath,
    databaseUrl,
    env: {
      ...mergedEnv,
      ...clawDatabaseEnvFromConfig(config),
    },
    fileEnv,
  };
}

export function isPostgresDevProfile(env = process.env) {
  const engine = String(
    env.SDKWORK_CLAW_DATABASE_ENGINE
    ?? env.SDKWORK_CLAW_DATABASE_PROVIDER
    ?? '',
  ).trim();
  if (!engine) {
    return true;
  }
  return /^postgres(?:ql)?$/iu.test(engine);
}
