#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { validateApiAssemblyIntegrationClosure } from './lib/api-assembly-integration-closure.mjs';
import { collectWorkspaceValidationIssues } from './lib/workspace-check-runner.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: SPECS_ROOT },
    workspace: { type: 'string' },
    'strict-standalone-hosting': { type: 'boolean', default: false },
    'strict-selected-standalone-parity': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help) {
  console.log('Usage: node tools/check-api-assembly-integration-closure.mjs [--root <repo> | --workspace <root>] [--strict-standalone-hosting] [--strict-selected-standalone-parity]');
  process.exit(0);
}

const issues = values.workspace
  ? collectWorkspaceValidationIssues(
    path.resolve(values.workspace),
    (root) => validateApiAssemblyIntegrationClosure(root, {
      strictStandaloneHosting: values['strict-standalone-hosting'],
      strictSelectedStandaloneParity: values['strict-selected-standalone-parity'],
    }),
  )
  : validateApiAssemblyIntegrationClosure(path.resolve(values.root), {
    strictStandaloneHosting: values['strict-standalone-hosting'],
    strictSelectedStandaloneParity: values['strict-selected-standalone-parity'],
  });

if (issues.length > 0) {
  console.error('API assembly integration closure check failed:');
  for (const issue of issues.slice(0, 200)) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('API assembly integration closure check passed');
