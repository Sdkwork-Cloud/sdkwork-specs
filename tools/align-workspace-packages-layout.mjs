#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { alignRepositoryPackagesLayout, shouldAlignRepositoryPackagesLayout } from './lib/align-packages-layout.mjs';
import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { scanRepositoryPackagesLayout } from './lib/packages-layout-patterns.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-workspace-packages-layout.mjs --root <repository-root> [--dry-run]',
    '  node tools/align-workspace-packages-layout.mjs --workspace <multi-repo-checkout-root> [--dry-run] [--only-needing-align]',
  ].join('\n');
}

function printResult(result) {
  const label = path.basename(result.repoRoot);
  if (result.skipped) {
    console.log(`${label}: skipped (${result.skippedReason || 'n/a'})`);
    return 0;
  }

  console.log(`${label} (kind=${result.repositoryKind}${result.applicationCode ? `, application-code=${result.applicationCode}` : ''})`);
  if (result.actions.length === 0) {
    console.log('  actions: none');
  } else {
    for (const action of result.actions) {
      console.log(`  - ${action}`);
    }
  }

  const blocking = result.issuesAfter?.filter((issue) => issue.severity === 'error' || issue.severity === undefined) ?? [];
  if (blocking.length === 0) {
    console.log('  status: aligned');
    return 0;
  }

  console.log('  status: remaining issues');
  for (const issue of blocking) {
    console.log(`  ! ${issue.kind}: ${issue.path} — ${issue.detail}`);
  }
  return 1;
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    workspace: { type: 'string' },
    dryRun: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean' },
    onlyNeedingAlign: { type: 'boolean', default: false },
    'only-needing-align': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const dryRun = Boolean(parsed.values.dryRun || parsed.values['dry-run']);
const onlyNeedingAlign = Boolean(parsed.values.onlyNeedingAlign || parsed.values['only-needing-align']);
let exitCode = 0;

function processRepo(repoRoot) {
  if (onlyNeedingAlign && !shouldAlignRepositoryPackagesLayout(repoRoot)) {
    return 0;
  }
  const result = alignRepositoryPackagesLayout(repoRoot, { dryRun });
  return printResult(result);
}

if (parsed.values.workspace) {
  const workspaceRoot = path.resolve(parsed.values.workspace);
  const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: '' });
  console.log(`${dryRun ? 'planning' : 'aligning'} packages layout for ${repositories.length} repositories under ${workspaceRoot}`);
  for (const repoRoot of repositories) {
    exitCode = Math.max(exitCode, processRepo(repoRoot));
  }
  process.exit(exitCode);
}

const root = path.resolve(parsed.values.root || process.cwd());
exitCode = processRepo(root);
process.exit(exitCode);
