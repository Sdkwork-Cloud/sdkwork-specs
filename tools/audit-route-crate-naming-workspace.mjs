#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { auditRouteCrateNaming } from './lib/route-crate-naming.mjs';

function usage() {
  return [
    'Usage: node tools/audit-route-crate-naming-workspace.mjs --workspace <dir> [--prefix sdkwork-]',
    '',
    'Reports legacy sdkwork-routes-* HTTP route crate and foundation PC React naming debt.',
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

const workspaceRoot = path.resolve(
  parsed.values.workspace
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
);
const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
const failures = [];
let skipped = 0;
let ok = 0;

for (const repoRoot of repositories) {
  const result = auditRouteCrateNaming(repoRoot);
  const label = path.basename(repoRoot);
  if (result.skipped) {
    skipped += 1;
    console.log(`skip ${label}`);
    continue;
  }
  if (result.issues.length === 0) {
    ok += 1;
    console.log(`ok   ${label}`);
    continue;
  }
  console.log(`fail ${label} (${result.issues.length})`);
  for (const issue of result.issues.slice(0, 8)) {
    console.log(`  - ${issue}`);
    failures.push(`${label}: ${issue}`);
  }
  if (result.issues.length > 8) {
    console.log(`  - ... ${result.issues.length - 8} more`);
    for (const issue of result.issues.slice(8)) {
      failures.push(`${label}: ${issue}`);
    }
  }
}

console.log(`\nRepositories checked: ${repositories.length}`);
console.log(`ok: ${ok}`);
console.log(`skipped: ${skipped}`);
console.log(`failures: ${failures.length}`);

if (failures.length > 0) {
  console.error('\nRun alignment:');
  console.error(`node tools/align-route-crate-naming-workspace.mjs --workspace ${workspaceRoot}`);
  process.exit(1);
}
