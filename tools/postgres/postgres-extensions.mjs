import pg from 'pg';
import process from 'node:process';

import { buildPostgresDatabaseUrl } from './postgres-config.mjs';

/** PostgreSQL extensions required by SDKWork dev database baselines. */
export const SDKWORK_DEV_POSTGRES_EXTENSIONS = Object.freeze([
  {
    extension: 'vector',
    ubuntuPackages: ['postgresql-18-pgvector'],
    note: 'knowledgebase embedding search (pgvector)',
  },
  {
    extension: 'pg_trgm',
    ubuntuPackages: ['postgresql-contrib', 'postgresql-18'],
    note: 'search trigram indexes',
  },
]);

function assertSafePgIdent(value, label) {
  const normalized = String(value ?? '').trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(normalized)) {
    throw new Error(`${label} must be a simple PostgreSQL identifier`);
  }
  return normalized;
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function createPgClient(connection) {
  return new pg.Client({
    database: connection.database,
    host: connection.host,
    password: connection.password,
    port: Number.parseInt(String(connection.port ?? '5432'), 10),
    ssl: connection.sslmode === 'require' ? { rejectUnauthorized: false } : undefined,
    user: connection.username,
  });
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

async function extensionExists(client, extensionName) {
  const { rows } = await client.query(
    'SELECT 1 FROM pg_extension WHERE extname = $1',
    [extensionName],
  );
  return rows.length > 0;
}

export async function ensurePostgresDevExtensions(config, {
  extensions = SDKWORK_DEV_POSTGRES_EXTENSIONS,
  stdout = process.stdout,
} = {}) {
  const database = assertSafePgIdent(config.database.database, 'database name');
  const username = assertSafePgIdent(config.database.username, 'database username');
  const adminConnection = {
    ...config.admin,
    database,
  };

  const installed = [];
  await withPgClient(adminConnection, async (client) => {
    for (const entry of extensions) {
      const extensionName = assertSafePgIdent(entry.extension, 'extension name');
      if (await extensionExists(client, extensionName)) {
        stdout.write(`[sdkwork-postgres] extension ${extensionName} already installed\n`);
        installed.push(extensionName);
        continue;
      }
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS ${quoteIdent(extensionName)}`);
        stdout.write(`[sdkwork-postgres] installed extension ${extensionName}\n`);
        installed.push(extensionName);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `failed to install PostgreSQL extension ${extensionName}: ${message}. `
          + `On Ubuntu 22.04 install host packages first: `
          + `sudo apt install ${entry.ubuntuPackages.join(' ')}`,
        );
      }
    }

    await client.query(
      `GRANT USAGE ON SCHEMA public TO ${quoteIdent(username)}`,
    );
    await client.query(
      `GRANT CREATE ON SCHEMA public TO ${quoteIdent(username)}`,
    );
  });

  return {
    databaseUrl: buildPostgresDatabaseUrl(config.database),
    extensions: installed,
  };
}
