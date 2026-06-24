#!/usr/bin/env node
/**
 * Align SDKWork gateway crate names across sdkwork-space consumer repositories.
 * See APPLICATION_GATEWAY_SPEC.md and MIGRATION_SPEC.md section 8.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'target',
  'target-alt',
  'target-rust-tests',
  'target-test-fixtures',
  'target-verify',
  'dist',
  'artifacts',
  '.pnpm-store',
  'vendor',
  'external',
]);

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.mjs',
  '.js',
  '.ts',
  '.tsx',
  '.rs',
  '.toml',
  '.yaml',
  '.yml',
  '.env',
  '.sql',
  '.sh',
  '.ps1',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.proto',
  '.txt',
  '.cfg',
  '.ini',
  '.properties',
]);

const REPLACEMENTS = [
  ['sdkwork-api-gateway-api-server', 'sdkwork-api-cloud-gateway-api-server'],
  ['sdkwork-api-gateway-observability', 'sdkwork-api-cloud-gateway-observability'],
  ['sdkwork-api-gateway-registry', 'sdkwork-api-cloud-gateway-registry'],
  ['sdkwork-api-gateway-config', 'sdkwork-api-cloud-gateway-config'],
  ['sdkwork_im_gateway_observability', 'sdkwork_im_cloud_gateway_observability'],
  ['sdkwork_im_gateway_config', 'sdkwork_im_cloud_gateway_config'],
  ['sdkwork_im_gateway', 'sdkwork_im_cloud_gateway'],
  ['sdkwork_aiot_gateway', 'sdkwork_aiot_cloud_gateway'],
  ['sdkwork_clawrouter_gateway', 'sdkwork_clawrouter_cloud_gateway'],
  ['sdkwork_api_gateway_observability', 'sdkwork_api_cloud_gateway_observability'],
  ['sdkwork_api_gateway_registry', 'sdkwork_api_cloud_gateway_registry'],
  ['sdkwork_api_gateway_config', 'sdkwork_api_cloud_gateway_config'],
  ['sdkwork_api_gateway', 'sdkwork_api_cloud_gateway'],
  ['SDKWORK_API_GATEWAY_', 'SDKWORK_API_CLOUD_GATEWAY_'],
  ['../sdkwork-api-gateway/', '../sdkwork-api-cloud-gateway/'],
  ['sdkwork-api-gateway', 'sdkwork-api-cloud-gateway'],
  ['gateway:bundle:validate:cloud', 'gateway:validate:cloud'],
  ['gateway:bundle:cloud', 'gateway:package:cloud'],
];

const DIR_RENAMES = [
  {
    repo: 'sdkwork-api-cloud-gateway',
    renames: [
      ['crates/sdkwork-api-gateway-api-server', 'crates/sdkwork-api-cloud-gateway-api-server'],
      ['crates/sdkwork-api-gateway-observability', 'crates/sdkwork-api-cloud-gateway-observability'],
      ['crates/sdkwork-api-gateway-registry', 'crates/sdkwork-api-cloud-gateway-registry'],
      ['crates/sdkwork-api-gateway-config', 'crates/sdkwork-api-cloud-gateway-config'],
      ['crates/sdkwork-api-gateway', 'crates/sdkwork-api-cloud-gateway'],
    ],
  },
  {
    repo: 'sdkwork-im',
    renames: [
      ['services/sdkwork-im-gateway', 'services/sdkwork-im-cloud-gateway'],
      ['crates/sdkwork-im-gateway-observability', 'crates/sdkwork-im-cloud-gateway-observability'],
      ['crates/sdkwork-im-gateway-config', 'crates/sdkwork-im-cloud-gateway-config'],
    ],
  },
  {
    repo: 'sdkwork-aiot',
    renames: [
      ['services/sdkwork-aiot-gateway', 'services/sdkwork-aiot-cloud-gateway'],
    ],
  },
];

function usage() {
  return [
    'Usage: node tools/migrate-gateway-naming.mjs [--workspace <path>] [--dry-run]',
    '',
    'Renames gateway crate directories and replaces retired gateway identifiers in text files.',
  ].join('\n');
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, files);
    else files.push(full);
  }
  return files;
}

function shouldProcessFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return false;
  if (file.includes(`${path.sep}node_modules${path.sep}`)) return false;
  return true;
}

function migrateText(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

function renamePath(root, fromRel, toRel, dryRun) {
  const from = path.join(root, fromRel);
  const to = path.join(root, toRel);
  if (!fs.existsSync(from)) return null;
  if (fs.existsSync(to)) return `skip exists ${toRel}`;
  if (dryRun) return `would rename ${fromRel} -> ${toRel}`;
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (error && error.code === 'EBUSY') {
      return `busy ${fromRel} -> ${toRel} (update Cargo package name manually until directory is free)`;
    }
    throw error;
  }
  return `renamed ${fromRel} -> ${toRel}`;
}

function renameConfigFiles(root, dryRun) {
  const actions = [];
  for (const file of walkFiles(root)) {
    const base = path.basename(file);
    if (!base.startsWith('sdkwork-api-gateway.')) continue;
    const next = base.replace(/^sdkwork-api-gateway\./, 'sdkwork-api-cloud-gateway.');
    const target = path.join(path.dirname(file), next);
    if (fs.existsSync(target)) continue;
    if (dryRun) actions.push(`would rename ${path.relative(root, file)}`);
    else fs.renameSync(file, target);
    actions.push(`renamed ${path.relative(root, file)} -> ${next}`);
  }
  return actions;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(usage());
    return;
  }

  const workspace = path.resolve(values.workspace);
  const dryRun = values['dry-run'];
  const changedFiles = [];
  const renameActions = [];

  for (const { repo, renames } of DIR_RENAMES) {
    const repoRoot = path.join(workspace, repo);
    if (!fs.existsSync(repoRoot)) continue;
    for (const [fromRel, toRel] of renames) {
      const action = renamePath(repoRoot, fromRel, toRel, dryRun);
      if (action) renameActions.push(`${repo}: ${action}`);
    }
    renameActions.push(
      ...renameConfigFiles(repoRoot, dryRun).map((line) => `${repo}: ${line}`),
    );
  }

  for (const repo of fs.readdirSync(workspace)) {
    const repoRoot = path.join(workspace, repo);
    if (!fs.statSync(repoRoot).isDirectory()) continue;
    if (repo === 'sdkwork-kernel' && repoRoot.includes('external')) continue;
    for (const file of walkFiles(repoRoot)) {
      if (!shouldProcessFile(file)) continue;
      if (file.endsWith('migrate-gateway-naming.mjs')) continue;
      const before = fs.readFileSync(file, 'utf8');
      const after = migrateText(before);
      if (after === before) continue;
      if (!dryRun) fs.writeFileSync(file, after, 'utf8');
      changedFiles.push(path.relative(workspace, file));
    }
  }

  console.log(`Gateway migration ${dryRun ? '(dry run)' : 'complete'}`);
  console.log(`Directory/config renames: ${renameActions.length}`);
  for (const line of renameActions) console.log(`- ${line}`);
  console.log(`Text files updated: ${changedFiles.length}`);
  for (const file of changedFiles.slice(0, 80)) console.log(`  ${file}`);
  if (changedFiles.length > 80) {
    console.log(`  ... and ${changedFiles.length - 80} more`);
  }
}

main();
