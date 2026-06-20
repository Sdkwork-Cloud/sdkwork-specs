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
    engines: ['postgres'],
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
    } else if (token === '--engines') {
      args.engines = (argv[index + 1] ?? 'postgres')
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

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.baseline || !args.moduleId || !args.owner) {
    throw new Error('usage: --root <dir> --baseline <relative-sql> --module-id <id> --owner <team> [--table-prefix p_] [--prefixes p1_,p2_] [--engines postgres,sqlite]');
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
    `module_id: ${args.moduleId}`,
    'contract_version: 1.0.0',
    `owner_team: ${args.owner}`,
    'compliance_level: L2',
    'engines:',
    ...args.engines.map((engine) => `  - ${engine}`),
    `table_prefix: ${prefixes[0] ?? args.tablePrefix}`,
    'tables:',
    ...tableNames.map(
      (name) => `  - name: ${name}\n    lifecycle_status: active\n    owner: ${args.owner}`,
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
  fs.writeFileSync(path.join(args.root, 'database/contract/schema.yaml'), schemaYaml);

  const manifestPath = path.join(args.root, 'database/database.manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.contractVersion = '1.0.0';
  manifest.lifecycle.autoMigrate = true;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  process.stdout.write(
    `materialized ${tableNames.length} tables (${prefixes.length} prefixes) into ${args.moduleId} database contract\n`,
  );
}

main();
