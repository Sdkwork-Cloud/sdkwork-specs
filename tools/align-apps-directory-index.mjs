#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { alignAppsDirectoryIndex } from './lib/apps-directory-index.mjs';
import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { validateAppsDirectoryIndex } from './check-apps-directory-index.mjs';

function usage() {
  return [
    'Usage:',
    '  node tools/align-apps-directory-index.mjs --root <repo>',
    '  node tools/align-apps-directory-index.mjs --workspace <dir> [--prefix sdkwork-]',
  ].join('\n');
}

function printResult(result) {
  const label = path.basename(result.root);
  if (result.skipped) {
    console.log(`${label}: skipped (${result.identity.profile})`);
    return 0;
  }
  console.log(`${label} (${result.identity.profile})`);
  if (result.changed.length > 0) {
    for (const item of result.changed) {
      console.log(`  updated: ${item}`);
    }
  } else {
    console.log('  updated: none');
  }
  const validation = validateAppsDirectoryIndex(result.root);
  if (validation.skipped || validation.issues.length === 0) {
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
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

let exitCode = 0;

if (parsed.values.workspace) {
  const workspaceRoot = path.resolve(parsed.values.workspace);
  const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
  console.log(`aligning apps directory index for ${repositories.length} repositories under ${workspaceRoot}`);
  for (const repoRoot of repositories) {
    const result = alignAppsDirectoryIndex(repoRoot);
    exitCode = Math.max(exitCode, printResult(result));
  }
  process.exit(exitCode);
}

const root = path.resolve(
  parsed.values.root
  || process.cwd(),
);
exitCode = printResult(alignAppsDirectoryIndex(root));
process.exit(exitCode);
