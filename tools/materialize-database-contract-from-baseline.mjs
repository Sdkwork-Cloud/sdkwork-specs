#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    baseline: '',
    moduleId: '',
    owner: '',
    tablePrefix: '',
    prefixes: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root') {
      args.root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--baseline') {
      args.baseline = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--module-id') {
      args.moduleId = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--owner') {
      args.owner = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--table-prefix') {
      args.tablePrefix = argv[index + 1] ?? '';
      index += 1;
    } else if (token === '--prefixes') {
      args.prefixes = (argv[index + 1] ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    }
  }
  return args;
}

function collectTableNames(sql) {
  const seen = new Set();
  const tableNames = [];
  for (const match of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? ([a-z0-9_]+)/gi)) {
    const name = match[1];
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    tableNames.push(name);
  }
  return tableNames;
}

function collectPrefixes(tableNames) {
  const prefixes = new Set();
  for (const tableName of tableNames) {
    const match = tableName.match(/^([a-z]+_)/);
    if (match) {
      prefixes.add(match[1]);
    }
  }
  return [...prefixes].sort();
}

function readExistingSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    return { contractVersion: '', tableBlocks: new Map() };
  }

  const text = fs.readFileSync(schemaPath, 'utf8');
  const contractVersion = text.match(/^contract_version:\s*(\S+)/m)?.[1] ?? '';
  const tableBlocks = new Map();
  const tablesOffset = text.search(/^tables:\s*$/m);
  if (tablesOffset < 0) {
    return { contractVersion, tableBlocks };
  }

  const tablesText = text.slice(tablesOffset).replace(/^tables:\s*\r?\n/, '');
  const matches = [...tablesText.matchAll(/^  - name:\s*([a-z0-9_]+)\s*$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const start = match.index;
    const end = matches[index + 1]?.index ?? tablesText.length;
    tableBlocks.set(match[1], tablesText.slice(start, end).trimEnd());
  }
  return { contractVersion, tableBlocks };
}

function resolveContractVersion(manifest, existingSchema) {
  const manifestVersion = manifest.contractVersion ?? '';
  const schemaVersion = existingSchema.contractVersion;
  if (manifestVersion && schemaVersion && manifestVersion !== schemaVersion) {
    throw new Error(
      `database contract version mismatch: manifest=${manifestVersion}, schema=${schemaVersion}`,
    );
  }
  return manifestVersion || schemaVersion || '1.0.0';
}

function renderPrefixContract(prefixes, fallbackPrefix) {
  const resolvedPrefixes = prefixes.length > 0 ? prefixes : [fallbackPrefix].filter(Boolean);
  if (resolvedPrefixes.length <= 1) {
    return [`table_prefix: ${resolvedPrefixes[0] ?? ''}`];
  }
  return ['table_prefixes:', ...resolvedPrefixes.map((prefix) => `  - ${prefix}`)];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.baseline || !args.moduleId || !args.owner) {
    throw new Error('usage: --root <dir> --baseline <relative-postgres-sql> --module-id <id> --owner <team> [--table-prefix p_] [--prefixes p1_,p2_]');
  }

  const baselinePath = path.join(args.root, args.baseline);
  const sql = fs.readFileSync(baselinePath, 'utf8');
  const tableNames = collectTableNames(sql);
  const prefixes =
    args.prefixes.length > 0
      ? args.prefixes
      : args.tablePrefix
      ? [args.tablePrefix]
      : collectPrefixes(tableNames);

  const schemaPath = path.join(args.root, 'database/contract/schema.yaml');
  const manifestPath = path.join(args.root, 'database/database.manifest.json');
  const existingSchema = readExistingSchema(schemaPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.databaseRole !== 'authoritative-server') {
    throw new Error('contract materialization requires databaseRole=authoritative-server');
  }
  if (JSON.stringify(manifest.engines) !== JSON.stringify(['postgres']) || manifest.defaultEngine !== 'postgres') {
    throw new Error('authoritative contract materialization requires engines=[postgres] and defaultEngine=postgres');
  }
  const contractVersion = resolveContractVersion(manifest, existingSchema);

  const tableRegistry = {
    schemaVersion: 1,
    kind: 'sdkwork.database.table-registry',
    tables: tableNames.map((table_name) => ({
      table_name,
      owner: args.owner,
      compliance_level: 'L2',
      lifecycle_status: 'active',
    })),
  };

  const prefixRegistry = {
    schemaVersion: 1,
    kind: 'sdkwork.database.prefix-registry',
    prefixes: prefixes.map((prefix) => ({
      prefix,
      owner: args.owner,
      domain: args.moduleId,
    })),
  };

  const schemaYaml = [
    'schema_version: 1',
    'kind: sdkwork.database.schema',
    'database_role: authoritative-server',
    `module_id: ${args.moduleId}`,
    `contract_version: ${contractVersion}`,
    `owner_team: ${args.owner}`,
    'compliance_level: L2',
    'engines:',
    '  - postgres',
    ...renderPrefixContract(prefixes, args.tablePrefix),
    'tables:',
    ...tableNames.map((name) =>
      existingSchema.tableBlocks.get(name)
      ?? `  - name: ${name}\n    lifecycle_status: active\n    owner: ${args.owner}`,
    ),
    '',
  ].join('\n');

  fs.writeFileSync(
    path.join(args.root, 'database/contract/table-registry.json'),
    `${JSON.stringify(tableRegistry, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(args.root, 'database/contract/prefix-registry.json'),
    `${JSON.stringify(prefixRegistry, null, 2)}\n`,
  );
  fs.writeFileSync(schemaPath, schemaYaml);

  manifest.contractVersion = contractVersion;
  manifest.schemaVersion = 2;
  manifest.databaseRole = 'authoritative-server';
  manifest.engines = ['postgres'];
  manifest.defaultEngine = 'postgres';
  manifest.lifecycle ??= {};
  manifest.lifecycle.autoMigrate ??= false;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  process.stdout.write(
    `materialized ${tableNames.length} tables (${prefixes.length} prefixes) into ${args.moduleId} database contract\n`,
  );
}

main();
