#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';

import { bootstrapRepositoryDocs } from './bootstrap-repository-docs-lib.mjs';
import { validateRepositoryDocsStandard } from './check-repository-docs-standard.mjs';

function usage() {
  return [
    'Usage: node tools/bootstrap-repository-docs.mjs --root <repo> [--application-code <code>] [--owner <team>] [--force]',
    '',
    'Creates the standard docs/ skeleton and Canon templates from sdkwork-specs/templates/docs/.',
    'Does not overwrite existing Canon files unless --force is passed.',
  ].join('\n');
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    'application-code': { type: 'string' },
    owner: { type: 'string' },
    force: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const root = path.resolve(parsed.values.root || process.cwd());
const result = bootstrapRepositoryDocs(root, {
  force: parsed.values.force,
  applicationCode: parsed.values['application-code'],
  owner: parsed.values.owner,
});

console.log(`bootstrapped repository docs: ${root}`);
for (const file of result.created) {
  console.log(`+ ${file}`);
}

const validation = validateRepositoryDocsStandard(root, { profile: 'application' });
if (validation.issues.length > 0) {
  console.error('bootstrap completed but repository is not yet compliant:');
  for (const issue of validation.issues) {
    console.error(`- ${issue}`);
  }
  console.error('Update AGENTS.md and README.md to link the Canon documents, then re-run the checker.');
  process.exit(2);
}

console.log('repository docs standard ok after bootstrap');
