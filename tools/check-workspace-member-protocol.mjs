#!/usr/bin/env node

import path from 'node:path';

import { validateWorkspaceMemberProtocol } from './lib/workspace-member-protocol.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), repoName: null, skipMaterialization: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') args.root = path.resolve(argv[++index]);
    else if (arg === '--repo') args.repoName = argv[++index];
    else if (arg === '--skip-materialization') args.skipMaterialization = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  if (!args.repoName) args.repoName = path.basename(args.root);
  return args;
}

function usage() {
  console.log(`Usage:
  node tools/check-workspace-member-protocol.mjs --root <repository-root> [--repo <repo-name>] [--skip-materialization]

Enforces DEPENDENCY_MANAGEMENT_SPEC.md section 3 and section 8:
- member package.json files must not use file:/link: for SDKWork sibling sources
- SDKWork workspace packages must use workspace:* (or catalog:)
- repository-root pnpm-workspace.yaml must match sdkwork-specs/workspace/consumers materialization`);
}

const args = parseArgs(process.argv);
if (args.help) {
  usage();
  process.exit(0);
}

const issues = validateWorkspaceMemberProtocol(args.root, {
  repoName: args.repoName,
  checkMaterialization: !args.skipMaterialization,
});

if (issues.length === 0) {
  console.log(`workspace member protocol passed for ${args.root}`);
  process.exit(0);
}

console.error(`workspace member protocol failed: found ${issues.length} issue(s)`);
for (const issue of issues) console.error(`- ${issue}`);
process.exit(1);
