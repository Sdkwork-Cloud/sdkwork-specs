#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateAuthProfileSpecs,
  validateCredentialEntryRepository,
} from './lib/credential-entry-bootstrap-standard.mjs';
import { collectWorkspaceValidationIssues } from './lib/workspace-check-runner.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runCredentialEntryBootstrapCheck(argv = process.argv.slice(2)) {
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
        '  node tools/check-credential-entry-bootstrap-standard.mjs --root <repository-root>',
        '  node tools/check-credential-entry-bootstrap-standard.mjs --workspace <workspace-root>',
      ].join('\n'),
      issues: [],
    };
  }
  if (values.root && values.workspace) {
    return { issues: ['use either --root or --workspace, not both'] };
  }

  const issues = validateAuthProfileSpecs(SPECS_ROOT);
  if (values.workspace) {
    issues.push(...collectWorkspaceValidationIssues(
      path.resolve(values.workspace),
      validateCredentialEntryRepository,
    ));
  } else {
    issues.push(...validateCredentialEntryRepository(path.resolve(values.root ?? SPECS_ROOT)));
  }
  return { issues };
}

function main() {
  const result = runCredentialEntryBootstrapCheck();
  if (result.help) {
    console.log(result.help);
    return;
  }
  if (result.issues.length > 0) {
    console.error('credential-entry bootstrap standard check failed:');
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log('credential-entry bootstrap standard check passed');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
