#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { migrateProviderSessionIdentity } from './lib/provider-session-identity.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { values } = parseArgs({
  options: {
    workspace: { type: 'string', default: path.resolve(SPECS_ROOT, '..') },
    write: { type: 'boolean', default: false },
  },
});

const workspace = path.resolve(values.workspace);
const changes = migrateProviderSessionIdentity(workspace, { write: values.write });
for (const change of changes) {
  const source = path.relative(workspace, change.filePath);
  const target = path.relative(workspace, change.targetPath);
  const action = change.filePath === change.targetPath ? source : `${source} -> ${target}`;
  console.log(`${values.write ? 'updated' : 'would update'} ${action}`);
}
console.log(`${values.write ? 'updated' : 'would update'} ${changes.length} authored file(s)`);
console.log('Generated SDK output is intentionally excluded; regenerate it from canonical OpenAPI sources.');
