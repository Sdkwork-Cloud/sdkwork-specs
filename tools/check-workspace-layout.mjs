#!/usr/bin/env node

import path from 'node:path';

import {
  listWorkspaceRepositoryRoots,
  validateWorkspaceLayout,
} from './lib/workspace-layout.mjs';

function parseArgs(argv) {
  const args = { scope: 'root', target: process.cwd() };
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
    '  node tools/check-workspace-layout.mjs --root <repository-root>',
    '  node tools/check-workspace-layout.mjs --workspace <workspace-root>',
  ].join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const roots = args.scope === 'workspace'
    ? listWorkspaceRepositoryRoots(args.target)
    : [args.target];
  const issues = roots.flatMap((root) => validateWorkspaceLayout(root).map((issue) => ({
    ...issue,
    repository: path.basename(root),
  })));

  if (issues.length > 0) {
    console.error(`workspace layout failed (${issues.length} issue(s)):`);
    for (const issue of issues) {
      console.error(`- [${issue.repository}] ${issue.kind}: ${issue.path} - ${issue.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`workspace layout passed (${roots.length} repository root(s))`);
}

main();
