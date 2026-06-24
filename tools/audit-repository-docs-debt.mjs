#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  auditRepositoryDocsDebt,
  listAllWorkspaceRepositories,
} from './complete-repository-docs-migration-lib.mjs';

function usage() {
  return [
    'Usage: node tools/audit-repository-docs-debt.mjs --workspace <dir>',
    '',
    'Reports remaining documentation migration debt after Canon alignment.',
  ].join('\n');
}

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    root: { type: 'string' },
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

const repositories = parsed.values.root
  ? [path.resolve(parsed.values.root)]
  : listAllWorkspaceRepositories(workspaceRoot);

const failures = [];

for (const repoRoot of repositories) {
  const result = auditRepositoryDocsDebt(repoRoot);
  if (result.issues.length === 0) {
    console.log(`ok  ${path.basename(repoRoot)}`);
    continue;
  }
  console.log(`debt ${path.basename(repoRoot)} (${result.issues.length})`);
  for (const issue of result.issues.slice(0, 10)) {
    console.log(`  - ${issue}`);
  }
  if (result.issues.length > 10) {
    console.log(`  - ... and ${result.issues.length - 10} more`);
  }
  failures.push(...result.issues.map((issue) => `${path.basename(repoRoot)}: ${issue}`));
}

console.log(`\nRepositories checked: ${repositories.length}`);
console.log(`Repositories with debt: ${new Set(failures.map((item) => item.split(':')[0])).size}`);

if (failures.length > 0) {
  console.error('\nRun migration:');
  console.error(`node tools/complete-repository-docs-migration.mjs --workspace ${workspaceRoot}`);
  process.exit(1);
}
