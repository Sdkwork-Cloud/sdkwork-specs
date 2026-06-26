import fs from 'node:fs';
import path from 'node:path';

const CLAW_PREFIX = 'SDKWORK_CLAW_DATABASE_';
const CLAW_ADMIN_PREFIX = 'SDKWORK_CLAW_DATABASE_ADMIN_';

function normalizeField(value) {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function stripInlineComment(value) {
  let quote = '';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && value[index - 1] !== '\\') {
      quote = quote === char ? '' : quote || char;
      continue;
    }
    if (char === '#' && !quote && /\s/u.test(value[index - 1] ?? ' ')) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function unquoteConfigValue(value) {
  const trimmed = stripInlineComment(String(value ?? '').trim());
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1);
    return trimmed.startsWith('"')
      ? inner.replaceAll('\\"', '"').replaceAll('\\\\', '\\')
      : inner.replaceAll("''", "'");
  }
  return trimmed;
}

export function parseDotEnv(text) {
  const result = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalizedLine = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const equalsIndex = normalizedLine.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }
    const key = normalizedLine.slice(0, equalsIndex).trim();
    const value = normalizedLine.slice(equalsIndex + 1);
    result[key] = unquoteConfigValue(value);
  }
  return result;
}

function resolveConfigPath(configPath, repoRoot) {
  if (!configPath) {
    return undefined;
  }
  return path.isAbsolute(configPath) ? configPath : path.resolve(repoRoot, configPath);
}

function decodePostgresDatabasePath(pathname) {
  return decodeURIComponent(String(pathname ?? '').replace(/^\//u, ''));
}

function parsePostgresDatabaseUrl(value, schema) {
  const normalized = normalizeField(value);
  if (!normalized) {
    return undefined;
  }
  if (!/^postgres(?:ql)?:\/\//iu.test(normalized)) {
    throw new Error(`unsupported PostgreSQL database URL: ${sanitizePostgresDatabaseUrl(normalized)}`);
  }
  const parsed = new URL(normalized);
  return {
    database: decodePostgresDatabasePath(parsed.pathname),
    host: parsed.hostname,
    password: decodeURIComponent(parsed.password || ''),
    port: parsed.port || '5432',
    schema: normalizeField(schema) ?? decodePostgresDatabasePath(parsed.pathname),
    sslmode: parsed.searchParams.get('sslmode') ?? undefined,
    username: decodeURIComponent(parsed.username || ''),
  };
}

function readEnvValue(env, keys) {
  for (const key of keys) {
    const value = normalizeField(env[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function buildConnectionFromEnv(env, {
  urlKeys = [`${CLAW_PREFIX}URL`],
  hostKeys = [`${CLAW_PREFIX}HOST`],
  portKeys = [`${CLAW_PREFIX}PORT`],
  databaseKeys = [`${CLAW_PREFIX}NAME`],
  schemaKeys = [`${CLAW_PREFIX}SCHEMA`, `${CLAW_PREFIX}NAME`],
  usernameKeys = [`${CLAW_PREFIX}USERNAME`],
  passwordKeys = [`${CLAW_PREFIX}PASSWORD`],
  sslModeKeys = [`${CLAW_PREFIX}SSL_MODE`, `${CLAW_PREFIX}SSLMODE`],
  legacyPrefixes = [],
} = {}) {
  const legacyHostKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}HOST`]);
  const legacyPortKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}PORT`]);
  const legacyDatabaseKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}NAME`]);
  const legacySchemaKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}SCHEMA`, `${prefix}NAME`]);
  const legacyUsernameKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}USERNAME`]);
  const legacyPasswordKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}PASSWORD`]);
  const legacySslModeKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}SSL_MODE`, `${prefix}SSLMODE`]);
  const legacyUrlKeys = legacyPrefixes.flatMap((prefix) => [`${prefix}URL`]);

  const fromUrl = parsePostgresDatabaseUrl(
    readEnvValue(env, [...urlKeys, ...legacyUrlKeys]),
    readEnvValue(env, [...schemaKeys, ...legacySchemaKeys]),
  );
  if (fromUrl) {
    return fromUrl;
  }

  return {
    database: readEnvValue(env, [...databaseKeys, ...legacyDatabaseKeys]),
    host: readEnvValue(env, [...hostKeys, ...legacyHostKeys]),
    password: readEnvValue(env, [...passwordKeys, ...legacyPasswordKeys]),
    port: readEnvValue(env, [...portKeys, ...legacyPortKeys]) ?? '5432',
    schema: readEnvValue(env, [...schemaKeys, ...legacySchemaKeys]),
    sslmode: readEnvValue(env, [...sslModeKeys, ...legacySslModeKeys]),
    username: readEnvValue(env, [...usernameKeys, ...legacyUsernameKeys]),
  };
}

function buildAdminFromEnv(env, database, legacyPrefixes = []) {
  const legacyAdminPrefixes = legacyPrefixes.map((prefix) => prefix.replace(/_DATABASE_$/, '_DATABASE_ADMIN_'));
  const adminFromUrl = parsePostgresDatabaseUrl(
    readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}URL`,
      ...legacyAdminPrefixes.map((prefix) => `${prefix}URL`),
    ]),
    undefined,
  );
  if (adminFromUrl) {
    return adminFromUrl;
  }

  return {
    database: readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}DATABASE`,
      ...legacyAdminPrefixes.map((prefix) => `${prefix}DATABASE`),
    ]) ?? 'postgres',
    host: readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}HOST`,
      ...legacyAdminPrefixes.map((prefix) => `${prefix}HOST`),
    ]) ?? database.host,
    password: readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}PASSWORD`,
      ...legacyAdminPrefixes.map((prefix) => `${prefix}PASSWORD`),
    ]),
    port: readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}PORT`,
      ...legacyAdminPrefixes.map((prefix) => `${prefix}PORT`),
    ]) ?? database.port,
    sslmode: readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}SSL_MODE`,
      `${CLAW_ADMIN_PREFIX}SSLMODE`,
      ...legacyAdminPrefixes.flatMap((prefix) => [`${prefix}SSL_MODE`, `${prefix}SSLMODE`]),
    ]) ?? database.sslmode,
    username: readEnvValue(env, [
      `${CLAW_ADMIN_PREFIX}USERNAME`,
      ...legacyAdminPrefixes.map((prefix) => `${prefix}USERNAME`),
    ]) ?? 'postgres',
  };
}

function validateDatabaseConfig(database) {
  const missing = [];
  for (const field of ['host', 'database', 'username', 'password']) {
    if (!normalizeField(database[field])) {
      missing.push(`SDKWORK_CLAW_DATABASE_${field.toUpperCase()}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`PostgreSQL configuration requires ${missing.join(', ')}`);
  }
}

function validateAdminConfig(admin) {
  const missing = [];
  for (const field of ['host', 'database', 'username']) {
    if (!normalizeField(admin[field])) {
      missing.push(`SDKWORK_CLAW_DATABASE_ADMIN_${field.toUpperCase()}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`PostgreSQL initialization requires ${missing.join(', ')}`);
  }
}

export function validateAdminExecutionConfig(admin) {
  validateAdminConfig(admin);
  if (!normalizeField(admin.password)) {
    throw new Error(
      'PostgreSQL initialization requires SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD or SDKWORK_CLAW_DATABASE_ADMIN_URL',
    );
  }
}

export function parseClawPostgresConfig({
  configPath = '.env.postgres',
  configText,
  repoRoot = process.cwd(),
  legacyDatabasePrefixes = [],
} = {}) {
  const resolvedConfigPath = resolveConfigPath(configPath, repoRoot);
  const sourceText = configText ?? fs.readFileSync(resolvedConfigPath, 'utf8');
  const env = parseDotEnv(sourceText);
  const database = buildConnectionFromEnv(env, { legacyPrefixes: legacyDatabasePrefixes });
  const admin = buildAdminFromEnv(env, database, legacyDatabasePrefixes);
  const config = {
    admin,
    database,
    source: {
      format: 'env',
      path: resolvedConfigPath,
    },
  };
  validateDatabaseConfig(config.database);
  validateAdminConfig(config.admin);
  return config;
}

function encodePostgresDatabaseName(database) {
  return encodeURIComponent(database).replaceAll('%2F', '/');
}

export function buildPostgresDatabaseUrl(database) {
  const host = normalizeField(database.host);
  const dbName = normalizeField(database.database);
  const username = normalizeField(database.username);
  const password = normalizeField(database.password);
  const port = normalizeField(database.port);
  const credentials = `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ''}`;
  const authority = `${credentials}@${host}${port ? `:${port}` : ''}`;
  const params = new URLSearchParams();
  if (normalizeField(database.sslmode)) {
    params.set('sslmode', normalizeField(database.sslmode));
  }
  const query = params.toString();
  return `postgresql://${authority}/${encodePostgresDatabaseName(dbName)}${query ? `?${query}` : ''}`;
}

export function sanitizePostgresDatabaseUrl(value) {
  try {
    const parsed = new URL(String(value));
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return String(value ?? '').replace(/(:\/\/[^:\s]+:)([^@\s]+)(@)/u, '$1***$3');
  }
}

export function clawDatabaseEnvFromConfig(config) {
  const database = config.database;
  const url = buildPostgresDatabaseUrl(database);
  return {
    SDKWORK_CLAW_DATABASE_ENGINE: 'postgresql',
    SDKWORK_CLAW_DATABASE_HOST: database.host,
    SDKWORK_CLAW_DATABASE_PORT: database.port,
    SDKWORK_CLAW_DATABASE_NAME: database.database,
    SDKWORK_CLAW_DATABASE_SCHEMA: database.schema ?? database.database,
    SDKWORK_CLAW_DATABASE_USERNAME: database.username,
    SDKWORK_CLAW_DATABASE_PASSWORD: database.password,
    SDKWORK_CLAW_DATABASE_SSL_MODE: database.sslmode ?? 'disable',
    SDKWORK_CLAW_DATABASE_URL: url,
    SDKWORK_DATABASE_URL: url,
  };
}
