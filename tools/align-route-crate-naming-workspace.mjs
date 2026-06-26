#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { alignRouteCrateNaming } from './lib/route-crate-naming.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-route-crate-naming.mjs --root <repo> [--dry-run]',
    '  node tools/align-route-crate-naming-workspace.mjs --workspace <dir> [--prefix sdkwork-] [--dry-run]',
  ].join('\n');
}

function printResult(result) {
  const label = path.basename(result.root);
  if (result.skipped) {
    console.log(`${label}: skipped`);
    return 0;
  }
  const mode = result.dryRun ? 'dry-run' : 'apply';
  console.log(`${label} (${mode})`);
  if (result.changed.length > 0) {
    for (const item of result.changed.slice(0, 12)) {
      console.log(`  ${item}`);
    }
    if (result.changed.length > 12) {
      console.log(`  ... ${result.changed.length - 12} more changes`);
    }
  } else {
    console.log('  no changes');
  }
  console.log(`  issues: ${result.issuesBefore} -> ${result.issuesAfter}`);
  if (result.issuesAfter > 0) {
    for (const issue of result.issues.slice(0, 5)) {
      console.log(`  - ${issue}`);
    }
  }
  return result.issuesAfter > 0 || result.changed.some((item) => item.startsWith('rename-failed')) ? 1 : 0;
}

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    prefix: { type: 'string', default: 'sdkwork-' },
    dryRun: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const workspaceRoot = path.resolve(
  parsed.values.workspace
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
);
const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
let failures = 0;

for (const repoRoot of repositories) {
  const result = alignRouteCrateNaming(repoRoot, { dryRun: parsed.values.dryRun });
  failures += printResult(result);
}

console.log(`\nRepositories processed: ${repositories.length}`);
console.log(`remaining failures: ${failures}`);

if (failures > 0) {
  process.exit(1);
}
