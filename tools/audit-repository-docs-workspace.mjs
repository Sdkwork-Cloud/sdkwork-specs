#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { validateRepositoryDocsStandard } from './check-repository-docs-standard.mjs';

function usage() {
  return [
    'Usage: node tools/audit-repository-docs-workspace.mjs --workspace <dir> [--prefix sdkwork-]',
    '',
    'Reports repository documentation Canon compliance for SDKWork repositories with AGENTS.md.',
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

for (const repoRoot of repositories) {
  const result = validateRepositoryDocsStandard(repoRoot, { profile: 'auto' });
  if (result.issues.length === 0) {
    console.log(`ok  ${path.basename(repoRoot)} (${result.profile})`);
    continue;
  }
  console.log(`fail ${path.basename(repoRoot)} (${result.profile})`);
  for (const issue of result.issues) {
    console.log(`  - ${issue}`);
    failures.push(`${path.basename(repoRoot)}: ${issue}`);
  }
}

console.log(`\nRepositories checked: ${repositories.length}`);
console.log(`Failures: ${failures.length}`);

if (failures.length > 0) {
  console.error('\nRun alignment:');
  console.error(`node tools/align-repository-docs.mjs --workspace ${workspaceRoot}`);
  process.exit(1);
}
