#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from 'node:util';

import {
  ensureCanonDirReadmes,
  migrateLegacyCanonPaths,
} from './migrate-legacy-canon-paths-lib.mjs';
import { validateRepositoryDocsStandard } from './check-repository-docs-standard.mjs';

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log('Usage: node tools/migrate-legacy-canon-paths.mjs --root <repo>');
  process.exit(0);
}

const root = path.resolve(parsed.values.root || process.cwd());
const migrated = migrateLegacyCanonPaths(root);
const created = ensureCanonDirReadmes(root);

console.log(`migrated legacy Canon paths: ${root}`);
for (const item of [...migrated, ...created.map((file) => `created ${file}`)]) {
  console.log(`+ ${item}`);
}

const validation = validateRepositoryDocsStandard(root, { profile: 'auto' });
if (validation.issues.length > 0) {
  console.error('migration completed but repository is not yet compliant:');
  for (const issue of validation.issues) {
    console.error(`- ${issue}`);
  }
  process.exit(2);
}

console.log(`repository docs standard ok after migration (profile=${validation.profile})`);
