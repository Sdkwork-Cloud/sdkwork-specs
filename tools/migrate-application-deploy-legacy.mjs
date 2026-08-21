#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';

import {
  migrateLegacyTopologyWorkspace,
  normalizeTopologyProfilePathsWorkspace,
} from './application-deploy-layout/migrate-legacy.mjs';

const { values } = parseArgs({
  options: {
    workspace: { type: 'string', default: path.resolve(process.cwd(), '..') },
    'dry-run': { type: 'boolean', default: false },
  },
});

const workspaceRoot = path.resolve(values.workspace);
const dryRun = values['dry-run'];

const migrated = migrateLegacyTopologyWorkspace(workspaceRoot, { dryRun });
const normalized = normalizeTopologyProfilePathsWorkspace(workspaceRoot, dryRun);
// Residual text rewrites (configs/topology refs, chat.toml, cloudrouter.toml)
// are handled by clean-application-deploy-residual.mjs.

let changed = 0;
for (const result of migrated) {
  if (result.changes.length === 0) continue;
  changed += 1;
  console.log(`${dryRun ? 'would migrate' : 'migrated'} ${result.appId}: ${result.changes.join(', ')}`);
}

for (const appId of normalized) {
  console.log(`${dryRun ? 'would normalize' : 'normalized'} ${appId}: profileFiles -> etc/topology`);
  changed += 1;
}

console.log(`\nmigrate-application-deploy-legacy: ${changed} repos ${dryRun ? 'would change' : 'changed'}`);
process.exit(0);
