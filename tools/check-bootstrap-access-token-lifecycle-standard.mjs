#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import {
  collectWorkspaceBootstrapLifecycleIssues,
  validateIamBootstrapAuthProfileSpec,
  validateRepositoryBootstrapLifecycle,
  validateWorkspaceBootstrapInfrastructure,
} from './lib/bootstrap-access-token-lifecycle-standard.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runBootstrapAccessTokenLifecycleCheck(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: 'string' },
      workspace: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    return {
      help: [
        'Usage:',
        '  node tools/check-bootstrap-access-token-lifecycle-standard.mjs --root <repository-root>',
        '  node tools/check-bootstrap-access-token-lifecycle-standard.mjs --workspace <workspace-root>',
      ].join('\n'),
      issues: [],
    };
  }
  if (values.root && values.workspace) {
    return { issues: ['use either --root or --workspace, not both'] };
  }

  if (values.workspace) {
    return {
      issues: collectWorkspaceBootstrapLifecycleIssues(path.resolve(values.workspace)),
    };
  }

  const root = path.resolve(values.root ?? process.cwd());
  const workspaceRoot = path.resolve(root, '..');
  return {
    issues: [
      ...validateIamBootstrapAuthProfileSpec(SPECS_ROOT),
      ...validateWorkspaceBootstrapInfrastructure(workspaceRoot),
      ...validateRepositoryBootstrapLifecycle(root),
    ],
  };
}

function main() {
  const result = runBootstrapAccessTokenLifecycleCheck();
  if (result.help) {
    console.log(result.help);
    return;
  }
  if (result.issues.length > 0) {
    console.error('bootstrap access-token lifecycle standard check failed:');
    for (const issue of result.issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('bootstrap access-token lifecycle standard check passed');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
