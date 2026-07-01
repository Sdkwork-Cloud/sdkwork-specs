import pg from 'pg';

import { buildPostgresDatabaseUrl } from './postgres-config.mjs';
import { ensurePostgresDevExtensions } from './postgres-extensions.mjs';

function assertSafePgIdent(value, label) {
  const normalized = String(value ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(normalized)) {
    throw new Error(`${label} must be a simple PostgreSQL identifier`);
  }
  return normalized;
}

function createPgClient(connection) {
  const client = new pg.Client({
    database: connection.database,
    host: connection.host,
    password: connection.password,
    port: Number.parseInt(String(connection.port ?? '5432'), 10),
    ssl: connection.sslmode === 'require' ? { rejectUnauthorized: false } : undefined,
    user: connection.username,
  });
  return client;
}

async function withPgClient(connection, operation) {
  const client = createPgClient(connection);
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end().catch(() => {});
  }
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sqlLiteral(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

async function ensureRole(client, username, password) {
  const role = assertSafePgIdent(username, 'database username');
  const { rows } = await client.query(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [role],
  );
  if (rows.length === 0) {
    await client.query(
      `CREATE ROLE ${quoteIdent(role)} LOGIN PASSWORD ${sqlLiteral(password)}`,
    );
  } else {
    await client.query(
      `ALTER ROLE ${quoteIdent(role)} WITH LOGIN PASSWORD ${sqlLiteral(password)}`,
    );
  }
}

async function ensureDatabase(client, database, owner) {
  const dbName = assertSafePgIdent(database, 'database name');
  const ownerName = assertSafePgIdent(owner, 'database owner');
  const { rows } = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [dbName],
  );
  if (rows.length === 0) {
    await client.query(
      `CREATE DATABASE ${quoteIdent(dbName)} OWNER ${quoteIdent(ownerName)}`,
    );
  } else {
    await client.query(
      `ALTER DATABASE ${quoteIdent(dbName)} OWNER TO ${quoteIdent(ownerName)}`,
    );
  }
}

async function ensureSchemaAndGrants(client, config) {
  const schema = assertSafePgIdent(config.database.schema, 'database schema');
  const username = assertSafePgIdent(config.database.username, 'database username');
  await client.query(
    `CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schema)} AUTHORIZATION ${quoteIdent(username)}`,
  );
  await client.query(
    `ALTER SCHEMA ${quoteIdent(schema)} OWNER TO ${quoteIdent(username)}`,
  );
  await client.query(
    `GRANT CONNECT ON DATABASE ${quoteIdent(config.database.database)} TO ${quoteIdent(username)}`,
  );
  await client.query(
    `GRANT TEMPORARY ON DATABASE ${quoteIdent(config.database.database)} TO ${quoteIdent(username)}`,
  );
  await client.query(
    `GRANT USAGE, CREATE ON SCHEMA ${quoteIdent(schema)} TO ${quoteIdent(username)}`,
  );
  await client.query(
    `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${quoteIdent(schema)} TO ${quoteIdent(username)}`,
  );
  await client.query(
    `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${quoteIdent(schema)} TO ${quoteIdent(username)}`,
  );
  await client.query(
    `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${quoteIdent(schema)} TO ${quoteIdent(username)}`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(schema)} `
    + `GRANT ALL PRIVILEGES ON TABLES TO ${quoteIdent(username)}`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(schema)} `
    + `GRANT ALL PRIVILEGES ON SEQUENCES TO ${quoteIdent(username)}`,
  );
  await client.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA ${quoteIdent(schema)} `
    + `GRANT ALL PRIVILEGES ON FUNCTIONS TO ${quoteIdent(username)}`,
  );
  await client.query(
    `ALTER ROLE ${quoteIdent(username)} SET search_path TO ${quoteIdent(schema)}, public`,
  );
}

export async function initializePostgresRoleAndDatabase(config) {
  const adminConnection = {
    ...config.admin,
    database: config.admin.database ?? 'postgres',
  };
  await withPgClient(adminConnection, async (client) => {
    await ensureRole(client, config.database.username, config.database.password);
    await ensureDatabase(client, config.database.database, config.database.username);
  });
}

export async function initializePostgresSchemaAndGrants(config) {
  const targetConnection = {
    ...config.admin,
    database: config.database.database,
  };
  await withPgClient(targetConnection, async (client) => {
    await ensureSchemaAndGrants(client, config);
  });
}

export async function executePostgresInitWithNode(config) {
  await initializePostgresRoleAndDatabase(config);
  await initializePostgresSchemaAndGrants(config);
  await ensurePostgresDevExtensions(config);
  return {
    databaseUrl: buildPostgresDatabaseUrl(config.database),
  };
}
