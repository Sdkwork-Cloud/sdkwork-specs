#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { planWorkspaceMemberProtocolAlignment } from './lib/workspace-member-protocol.mjs';

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: '.' },
      write: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log('Usage: node tools/align-workspace-member-protocol.mjs --root <repository-root> [--write]');
    console.log('Without --write, reports SDKWork wildcard dependency changes without modifying files.');
    return;
  }

  const repoRoot = path.resolve(values.root);
  const changes = planWorkspaceMemberProtocolAlignment(repoRoot);
  for (const change of changes) {
    console.log(`${values.write ? 'updated' : 'would update'} ${change.path}`);
    for (const update of change.updates) console.log(`  - ${update}`);
    if (values.write) {
      fs.writeFileSync(change.packageJsonPath, `${JSON.stringify(change.packageJson, null, 2)}\n`);
    }
  }
  console.log(`Workspace member protocol actions: ${changes.reduce((total, change) => total + change.updates.length, 0)}`);
}

main();
