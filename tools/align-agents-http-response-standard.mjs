#!/usr/bin/env node
/**
 * Inserts or refreshes the HTTP API Response Envelope section in AGENTS.md files.
 * See AGENTS_SPEC.md and API_SPEC.md section 4.5 and sections 14–16.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { upsertAgentsEnvelopeSection, walkAgentsFiles } from './lib/http-response-envelope-patterns.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: path.resolve(SPECS_ROOT, '..') },
      dryRun: { type: 'boolean', default: false },
    },
  });

  const workspace = path.resolve(values.workspace);
  const agentsFiles = walkAgentsFiles(workspace).filter((file) => !file.includes(`${path.sep}node_modules${path.sep}`));
  let updated = 0;
  for (const file of agentsFiles) {
    const before = fs.readFileSync(file, 'utf8');
    if (!before.includes('# Repository Guidelines') && !before.includes('## SDKWORK')) continue;
    const after = upsertAgentsEnvelopeSection(before);
    if (after === before) continue;
    if (!values.dryRun) fs.writeFileSync(file, after.endsWith('\n') ? after : `${after}\n`, 'utf8');
    updated += 1;
    console.log(values.dryRun ? `would update ${file}` : `updated ${file}`);
  }
  console.log(`${values.dryRun ? 'would update' : 'updated'} ${updated} AGENTS.md file(s)`);
}

main();
