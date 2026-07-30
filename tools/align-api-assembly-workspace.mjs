#!/usr/bin/env node
/**
 * Workspace driver: align gateway exports, materialize assembly, validate.
 */
import path from 'node:path';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { alignGatewayMountExports } from './align-gateway-mount-exports.mjs';
import { materializeApiAssembly } from './materialize-api-assembly.mjs';
import { validateApiAssembly } from './validate-api-assembly.mjs';

function usage() {
  return [
    'Usage: node tools/align-api-assembly-workspace.mjs --workspace <dir> [--prefix sdkwork-]',
    '',
    'For each application root or repository with route crates:',
    '  1. align gateway_mount and gateway_route_manifest exports',
    '  2. materialize API assembly',
    '  3. validate assembly parity',
  ].join('\n');
}

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    prefix: { type: 'string', default: 'sdkwork-' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

if (!parsed.values.workspace) {
  console.error(usage());
  process.exit(2);
}

const workspaceRoot = path.resolve(parsed.values.workspace);
const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
const failures = [];

for (const repoRoot of repositories) {
  const repoName = path.basename(repoRoot);
  let align;
  let materialize;
  try {
    align = alignGatewayMountExports(repoRoot);
    materialize = materializeApiAssembly(repoRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`fail ${repoName}`);
    console.log(`  - align/materialize: ${message}`);
    failures.push(`${repoName}: align/materialize ${message}`);
    continue;
  }
  if (!materialize.ok) {
    continue;
  }

  const alignFailed = align.results.filter((item) => item.status === 'failed');
  const validation = validateApiAssembly(repoRoot);

  if (validation.ok && alignFailed.length === 0) {
    console.log(`ok   ${repoName}`);
    continue;
  }

  console.log(`fail ${repoName}`);
  for (const item of alignFailed) {
    console.log(`  - align: ${item.packageName}: ${item.reason}`);
    failures.push(`${repoName}: align ${item.packageName}: ${item.reason}`);
  }
  for (const error of validation.errors) {
    console.log(`  - validate: ${error}`);
    failures.push(`${repoName}: validate ${error}`);
  }
}

console.log(`\nRepositories aligned: ${repositories.length}`);
console.log(`Failures: ${failures.length}`);
if (failures.length > 0) {
  process.exit(1);
}
