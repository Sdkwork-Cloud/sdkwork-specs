#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));

function usage() {
  return [
    'Usage: node tools/align-database-migration-metadata-workspace.mjs --workspace <dir> [--write]',
    '',
    'Adds structured headers to untracked migrations and checksum-external sidecar metadata for tracked migrations.',
    'Tracked migration SQL is checksum-covered and is never rewritten.',
    'The default mode is dry-run; --write applies the reported header or sidecar changes.',
  ].join('\n');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function isTrackedMigration(filePath) {
  let repositoryRoot;
  try {
    repositoryRoot = execFileSync(
      'git',
      ['-C', path.dirname(filePath), 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return false;
  }

  const repositoryPath = path.relative(repositoryRoot, filePath).replaceAll('\\', '/');
  try {
    execFileSync(
      'git',
      ['-C', repositoryRoot, 'ls-files', '--error-unmatch', '--', repositoryPath],
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}

function migrationMetadata(source) {
  const values = {};
  for (const match of source.matchAll(/^--\s*([a-z_]+):\s*(.+?)\s*$/gmu)) {
    values[match[1]] = match[2];
  }
  return values;
}

function upsertMetadata(source, desired) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const lines = source.split(/\r?\n/u);
  let markerIndex = lines.findIndex((line) => /^--\s*sdkwork:migration\s*$/u.test(line));
  if (markerIndex < 0) {
    lines.unshift('-- sdkwork:migration');
    markerIndex = 0;
  }
  let insertIndex = markerIndex + 1;
  for (const [key, value] of Object.entries(desired)) {
    const pattern = new RegExp(`^--\\s*${key}:`, 'u');
    const existingIndex = lines.findIndex((line) => pattern.test(line));
    if (existingIndex >= 0) {
      lines[existingIndex] = `-- ${key}: ${value}`;
      insertIndex = Math.max(insertIndex, existingIndex + 1);
    } else {
      lines.splice(insertIndex, 0, `-- ${key}: ${value}`);
      insertIndex += 1;
    }
  }
  return lines.join(newline);
}

function desiredMetadata(source, engine, hasDown) {
  const current = migrationMetadata(source);
  const concurrent = /\bCONCURRENTLY\b/iu.test(source);
  const desired = {
    engine,
    reversible: hasDown ? 'true' : (current.reversible ?? 'false'),
    rollback: hasDown ? 'down-migration' : (current.rollback ?? 'forward-fix'),
    transactional: concurrent ? 'false' : (current.transactional ?? 'true'),
  };
  if (engine === 'postgres') {
    desired.lock = current.lock ?? (concurrent ? 'lightweight' : 'access-exclusive');
    desired.lock_timeout = current.lock_timeout ?? '2s';
    desired.statement_timeout = current.statement_timeout ?? '30s';
  }
  return { current, desired };
}

function readMetadataSidecar(sidecarPath, engine) {
  if (!fs.existsSync(sidecarPath)) {
    return {
      schemaVersion: 1,
      kind: 'sdkwork.database.migration-metadata',
      engine,
      sourcePolicy: 'historical-immutable',
      migrations: {},
    };
  }
  return readJson(sidecarPath);
}

export function alignMigrationDirectory(databaseDir, engine, { write = false } = {}) {
  const migrationDir = path.join(databaseDir, 'migrations', engine);
  if (!fs.existsSync(migrationDir)) return [];
  const changes = [];
  const sidecarPath = path.join(migrationDir, 'metadata.json');
  const sidecar = readMetadataSidecar(sidecarPath, engine);
  const originalSidecar = `${JSON.stringify(sidecar, null, 2)}\n`;
  for (const fileName of fs.readdirSync(migrationDir).sort()) {
    if (!fileName.endsWith('.up.sql')) continue;
    const upPath = path.join(migrationDir, fileName);
    const downPath = upPath.replace(/\.up\.sql$/u, '.down.sql');
    const hasDown = fs.existsSync(downPath);
    const source = fs.readFileSync(upPath, 'utf8');
    const { current, desired } = desiredMetadata(source, engine, hasDown);
    const missingMetadata = Object.keys(desired).some((key) => current[key] === undefined);

    if (isTrackedMigration(upPath)) {
      if (missingMetadata) {
        sidecar.migrations ??= {};
        sidecar.migrations[fileName] = desired;
      }
      continue;
    }

    const next = upsertMetadata(source, desired);
    if (next === source) continue;
    changes.push(upPath);
    if (write) fs.writeFileSync(upPath, next, 'utf8');
  }

  if (sidecar.migrations && Object.keys(sidecar.migrations).length > 0) {
    sidecar.migrations = Object.fromEntries(
      Object.entries(sidecar.migrations).sort(([left], [right]) => left.localeCompare(right)),
    );
    const nextSidecar = `${JSON.stringify(sidecar, null, 2)}\n`;
    const existingSidecar = fs.existsSync(sidecarPath)
      ? fs.readFileSync(sidecarPath, 'utf8')
      : originalSidecar;
    if (nextSidecar !== existingSidecar) {
      changes.push(sidecarPath);
      if (write) fs.writeFileSync(sidecarPath, nextSidecar, 'utf8');
    }
  }
  return changes;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      write: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(usage());
    return;
  }
  const workspaceRoot = path.resolve(values.workspace ?? path.join(TOOL_DIR, '..', '..'));
  let changed = 0;
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('sdkwork-')) continue;
    const databaseDir = path.join(workspaceRoot, entry.name, 'database');
    const manifestPath = path.join(databaseDir, 'database.manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJson(manifestPath);
    const engine = manifest.databaseRole === 'authoritative-server'
      ? 'postgres'
      : manifest.databaseRole === 'client-local'
        ? 'sqlite'
        : null;
    if (!engine) continue;
    const changes = alignMigrationDirectory(databaseDir, engine, { write: values.write });
    if (changes.length === 0) continue;
    changed += changes.length;
    console.log(`${entry.name}: ${changes.length} migration metadata asset(s)`);
    for (const filePath of changes) console.log(`  - ${path.relative(workspaceRoot, filePath)}`);
  }
  console.log(`${values.write ? 'Updated' : 'Would update'} ${changed} migration metadata asset(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
