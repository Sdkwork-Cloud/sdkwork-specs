#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { scanRepositoryLockPackagePaths, scanWorkspaceLockPackagePaths } from './lib/lock-package-path-patterns.mjs';

function parseArgs(argv) {
  const args = { target: process.cwd(), scope: 'root' };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      args.scope = 'root';
      args.target = path.resolve(argv[++index]);
    } else if (arg === '--workspace') {
      args.scope = 'workspace';
      args.target = path.resolve(argv[++index]);
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node tools/check-workspace-lock-package-paths.mjs --root <repository-root>',
    '  node tools/check-workspace-lock-package-paths.mjs --workspace <multi-repo-checkout-root>',
  ].join('\n');
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const issues = args.scope === 'workspace'
  ? scanWorkspaceLockPackagePaths(args.target)
  : scanRepositoryLockPackagePaths(args.target).map((issue) => ({
    repo: path.basename(args.target),
    ...issue,
  }));

if (issues.length === 0) {
  console.log('lock package paths passed');
  process.exit(0);
}

console.error(`lock package paths failed: found ${issues.length} issue(s)`);
for (const issue of issues) {
  console.error(`- error ${issue.kind}: [${issue.repo}] ${issue.path} — ${issue.detail}`);
  console.error(`  ${issue.line}`);
}
process.exit(1);
