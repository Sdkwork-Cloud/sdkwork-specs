#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { scanRepositoryLockPackagePaths, scanWorkspaceLockPackagePaths, alignRepositoryLockfileText } from './lib/lock-package-path-patterns.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-workspace-lock-package-paths.mjs --root <repository-root>',
    '  node tools/align-workspace-lock-package-paths.mjs --workspace <multi-repo-checkout-root>',
  ].join('\n');
}

function uniqueRepos(issues) {
  return [...new Set(issues.map((issue) => issue.repo))].sort();
}

function refreshLockfile(repoRoot) {
  execFileSync('pnpm', ['install', '--lockfile-only'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    workspace: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const issues = parsed.values.workspace
  ? scanWorkspaceLockPackagePaths(path.resolve(parsed.values.workspace))
  : scanRepositoryLockPackagePaths(path.resolve(parsed.values.root || process.cwd()))
      .map((issue) => ({ repo: path.basename(parsed.values.root || process.cwd()), ...issue }));

if (issues.length === 0) {
  console.log('lock package paths already aligned');
  process.exit(0);
}

const workspaceRoot = parsed.values.workspace
  ? path.resolve(parsed.values.workspace)
  : path.dirname(path.resolve(parsed.values.root || process.cwd()));

let exitCode = 0;
for (const repoName of uniqueRepos(issues)) {
  const repoRoot = parsed.values.workspace
    ? path.join(workspaceRoot, repoName)
    : path.resolve(parsed.values.root || process.cwd());
  console.log(`refreshing pnpm-lock.yaml for ${repoName}`);
  try {
    refreshLockfile(repoRoot);
  } catch (error) {
    console.error(`  install failed (${error.message}); applying text rewrite fallback`);
    alignRepositoryLockfileText(repoRoot);
  }
  const remaining = scanRepositoryLockPackagePaths(repoRoot);
  if (remaining.length === 0) {
    console.log('  status: aligned');
  } else {
    alignRepositoryLockfileText(repoRoot);
    const afterText = scanRepositoryLockPackagePaths(repoRoot);
    if (afterText.length === 0) {
      console.log('  status: aligned (text rewrite)');
    } else {
      console.log(`  status: remaining ${afterText.length} stale lock reference(s)`);
      exitCode = 1;
    }
  }
}

process.exit(exitCode);
