#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import { alignWorkspace } from './application-deploy-layout/align.mjs';

const { values } = parseArgs({
  options: {
    workspace: { type: 'string', default: path.resolve(process.cwd(), '..') },
    'dry-run': { type: 'boolean', default: false },
    'no-bootstrap': { type: 'boolean', default: false },
  },
});

const workspaceRoot = path.resolve(values.workspace);
const dryRun = values['dry-run'];

const results = alignWorkspace(workspaceRoot, {
  dryRun,
  bootstrap: !values['no-bootstrap'],
});
let changed = 0;

for (const result of results) {
  if (result.written.length === 0) continue;
  changed += 1;
  console.log(`${dryRun ? 'would write' : 'wrote'} ${result.appId}: ${result.written.join(', ')}`);
}

console.log(`\nalign-application-deploy-layout: ${results.length} repos scanned, ${changed} ${dryRun ? 'would change' : 'changed'}`);
process.exit(0);
