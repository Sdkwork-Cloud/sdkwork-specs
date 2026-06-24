#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';

import { alignRepositoryDocs, listWorkspaceRepositories } from './align-repository-docs-lib.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-repository-docs.mjs --root <repo> [--force-canon]',
    '  node tools/align-repository-docs.mjs --workspace <dir> [--prefix sdkwork-] [--force-canon]',
  ].join('\n');
}

function printResult(result) {
  const { root, identity, changed, validation } = result;
  console.log(`${path.basename(root)} (${identity.profile})`);
  if (changed.length > 0) {
    for (const item of changed) {
      console.log(`  updated: ${item}`);
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
    prefix: { type: 'string', default: 'sdkwork-' },
    'force-canon': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const forceCanon = Boolean(parsed.values['force-canon']);
let exitCode = 0;

if (parsed.values.workspace) {
  const workspaceRoot = path.resolve(parsed.values.workspace);
  const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
  console.log(`aligning ${repositories.length} repositories under ${workspaceRoot}`);
  for (const repoRoot of repositories) {
    const code = printResult(alignRepositoryDocs(repoRoot, { forceCanon }));
    exitCode = Math.max(exitCode, code);
  }
  process.exit(exitCode);
}

const root = path.resolve(parsed.values.root || process.cwd());
exitCode = printResult(alignRepositoryDocs(root, { forceCanon }));
process.exit(exitCode);
