#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scanWorkspaceFederationPaths } from './lib/workspace-federation-path-patterns.mjs';

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
    '  node tools/check-workspace-federation-paths.mjs --root <repository-root>',
    '  node tools/check-workspace-federation-paths.mjs --workspace <multi-repo-checkout-root>',
  ].join('\n');
}

function listWorkspaceRepositories(workspaceRoot) {
  return fs.readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((repoRoot) => fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml')))
    .sort();
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(usage());
  process.exit(0);
}

const repoRoots = args.scope === 'workspace'
  ? listWorkspaceRepositories(args.target)
  : [args.target];

const issues = [];
for (const repoRoot of repoRoots) {
  const result = scanWorkspaceFederationPaths(repoRoot);
  for (const issue of result.issues) {
    issues.push({
      repo: path.basename(repoRoot),
      ...issue,
    });
  }
}

if (issues.length === 0) {
  console.log(`workspace federation paths passed (${repoRoots.length} repository root(s))`);
  process.exit(0);
}

console.error(`workspace federation paths failed: found ${issues.length} issue(s)`);
for (const issue of issues) {
  const suggestion = issue.suggested ? ` -> ${issue.suggested}` : '';
  const location = issue.path && issue.path !== 'pnpm-workspace.yaml'
    ? `${issue.path}${issue.alias ? ` (${issue.alias})` : ''}: `
    : '';
  console.error(`- error ${issue.kind}: [${issue.repo}] ${location}${issue.entry}${suggestion} — ${issue.detail}`);
}
process.exit(1);
