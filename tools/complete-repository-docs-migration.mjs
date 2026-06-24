#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  completeRepositoryDocsMigration,
  listAllWorkspaceRepositories,
} from './complete-repository-docs-migration-lib.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/complete-repository-docs-migration.mjs --root <repo>',
    '  node tools/complete-repository-docs-migration.mjs --workspace <dir> [--dry-run]',
  ].join('\n');
}

function printResult(result) {
  const { root, identity, changed, ingested, validation } = result;
  console.log(`${path.basename(root)} (${identity.profile})`);
  console.log(`  ingested: ${ingested?.length || 0}`);
  if (changed.length > 0) {
    for (const item of changed.slice(0, 20)) {
      console.log(`  updated: ${item}`);
    }
    if (changed.length > 20) {
      console.log(`  updated: ... and ${changed.length - 20} more`);
    }
  } else {
    console.log('  updated: none');
  }
  if (validation.issues.length === 0) {
    console.log('  status: compliant');
    return 0;
  }
  console.log('  status: non-compliant');
  for (const issue of validation.issues) {
    console.log(`  - ${issue}`);
  }
  return 1;
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    workspace: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const dryRun = Boolean(parsed.values['dry-run']);
let exitCode = 0;

if (parsed.values.workspace) {
  const workspaceRoot = path.resolve(parsed.values.workspace);
  const repositories = listAllWorkspaceRepositories(workspaceRoot);
  console.log(`migrating ${repositories.length} repositories under ${workspaceRoot}`);
  for (const repoRoot of repositories) {
    const code = printResult(completeRepositoryDocsMigration(repoRoot, { dryRun }));
    exitCode = Math.max(exitCode, code);
  }
  process.exit(exitCode);
}

const root = path.resolve(parsed.values.root || process.cwd());
exitCode = printResult(completeRepositoryDocsMigration(root, { dryRun }));
process.exit(exitCode);
