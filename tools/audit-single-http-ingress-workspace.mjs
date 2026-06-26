#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { validateRepository } from './check-single-http-ingress.mjs';

function usage() {
  return [
    'Usage: node tools/audit-single-http-ingress-workspace.mjs --workspace <dir> [--prefix sdkwork-] [--strict]',
    '',
    'Reports single HTTP ingress compliance for SDKWork repositories with AGENTS.md.',
    'Fails on multi-listener orchestration errors; prints gateway migration warnings unless --strict.',
  ].join('\n');
}

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    prefix: { type: 'string', default: 'sdkwork-' },
    strict: { type: 'boolean', default: false },
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
const warnings = [];
let checked = 0;

for (const repoRoot of repositories) {
  const topologyPath = path.join(repoRoot, 'specs', 'topology.spec.json');
  const scriptsDir = path.join(repoRoot, 'scripts');
  if (!fs.existsSync(topologyPath) && !fs.existsSync(scriptsDir)) {
    continue;
  }

  checked += 1;
  const result = validateRepository(repoRoot);
  const repoName = path.basename(repoRoot);

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log(`ok   ${repoName}`);
    continue;
  }

  if (result.errors.length === 0) {
    console.log(`warn ${repoName} (${result.warnings.length} gateway migration warnings)`);
    for (const warning of result.warnings) {
      console.log(`  ~ ${warning}`);
      warnings.push(`${repoName}: ${warning}`);
    }
    continue;
  }

  console.log(`fail ${repoName} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
  for (const issue of result.errors) {
    console.log(`  - ${issue}`);
    failures.push(`${repoName}: ${issue}`);
  }
  for (const warning of result.warnings) {
    console.log(`  ~ ${warning}`);
    warnings.push(`${repoName}: ${warning}`);
  }
}

console.log(`\nRepositories checked: ${checked}`);
console.log(`Errors: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (failures.length > 0 || (parsed.values.strict && warnings.length > 0)) {
  console.error('\nSee APPLICATION_GATEWAY_SPEC.md §5.6 and APP_RUNTIME_TOPOLOGY_SPEC.md §8.');
  process.exit(1);
}
