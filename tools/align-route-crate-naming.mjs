#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { alignRouteCrateNaming } from './lib/route-crate-naming.mjs';

function usage() {
  return [
    'Usage: node tools/align-route-crate-naming.mjs --root <repo> [--dry-run]',
  ].join('\n');
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    dryRun: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const root = path.resolve(
  parsed.values.root
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
);
const result = alignRouteCrateNaming(root, { dryRun: parsed.values.dryRun });
const label = path.basename(root);

if (result.skipped) {
  console.log(`${label}: skipped`);
  process.exit(0);
}

console.log(`${label} (${result.dryRun ? 'dry-run' : 'apply'})`);
for (const item of result.changed) {
  console.log(`  ${item}`);
}
console.log(`issues: ${result.issuesBefore} -> ${result.issuesAfter}`);

if (result.issuesAfter > 0) {
  for (const issue of result.issues) {
    console.log(`  - ${issue}`);
  }
  process.exit(1);
}
