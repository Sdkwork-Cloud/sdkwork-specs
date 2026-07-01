#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { alignWorkspaceFederationPaths } from './lib/workspace-federation-path-patterns.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-workspace-federation-paths.mjs --root <repository-root> [--dry-run]',
    '  node tools/align-workspace-federation-paths.mjs --workspace <multi-repo-checkout-root> [--dry-run]',
  ].join('\n');
}

function listWorkspaceRepositories(workspaceRoot) {
  return fs.readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((repoRoot) => fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml')))
    .sort();
}

function printResult(result) {
  const label = path.basename(result.repoRoot);
  if (result.actions.length === 0) {
    console.log(`${label}: aligned`);
    return result.issuesAfter.length === 0 ? 0 : 1;
  }

  console.log(label);
  for (const action of result.actions) {
    console.log(`  - ${action}`);
  }

  if (result.issuesAfter.length === 0) {
    console.log('  status: aligned');
    return 0;
  }

  console.log('  status: remaining issues');
  for (const issue of result.issuesAfter) {
    console.log(`  ! ${issue.entry} — ${issue.detail}`);
  }
  return 1;
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    workspace: { type: 'string' },
    dryRun: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const dryRun = Boolean(parsed.values.dryRun || parsed.values['dry-run']);
let exitCode = 0;

function processRepo(repoRoot) {
  const result = alignWorkspaceFederationPaths(repoRoot, { dryRun });
  return printResult(result);
}

if (parsed.values.workspace) {
  const workspaceRoot = path.resolve(parsed.values.workspace);
  const repositories = listWorkspaceRepositories(workspaceRoot);
  console.log(`${dryRun ? 'planning' : 'aligning'} workspace federation paths for ${repositories.length} repositories under ${workspaceRoot}`);
  for (const repoRoot of repositories) {
    exitCode = Math.max(exitCode, processRepo(repoRoot));
  }
  process.exit(exitCode);
}

const root = path.resolve(parsed.values.root || process.cwd());
exitCode = processRepo(root);
process.exit(exitCode);
