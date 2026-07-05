#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { alignInternalSdkDependencies, collectInternalSdkDependencyViolations } from './lib/align-sdk-internal-dependencies.mjs';
import { alignConsumerSdkAliasPaths } from './lib/align-consumer-sdk-alias-paths.mjs';
import { alignSdkStandard, collectSdkStandardViolations } from './lib/align-sdk-standard.mjs';
import { discoverAllSdkFamiliesIncludingApps } from './lib/sdk-family-discovery.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function runConsumerImportCheck(workspace, fix) {
  const args = [
    path.join(SPECS_ROOT, 'tools', 'check-app-sdk-consumer-imports.mjs'),
    '--workspace',
    workspace,
  ];
  if (fix) {
    args.push('--materialize-facades', '--align-alias-paths');
  }
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  return result.status ?? 1;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: path.resolve(SPECS_ROOT, '..') },
      fix: { type: 'boolean', default: false },
    },
  });

  const workspace = path.resolve(values.workspace);
  const families = discoverAllSdkFamiliesIncludingApps(workspace);
  console.log(`discovered ${families.length} TypeScript SDK familie(s)`);

  if (values.fix) {
    const depChanged = alignInternalSdkDependencies(workspace);
    for (const filePath of depChanged) console.log(`aligned dependency ${filePath}`);
    if (depChanged.length > 0) console.log(`aligned ${depChanged.length} dependency file(s)`);
    alignConsumerSdkAliasPaths(workspace);
    const changed = alignSdkStandard(workspace);
    for (const filePath of changed) console.log(`aligned ${filePath}`);
    console.log(`aligned ${changed.length} file(s)`);
  }

  const violations = [
    ...collectSdkStandardViolations(workspace),
    ...collectInternalSdkDependencyViolations(workspace),
  ];
  if (violations.length > 0) {
    console.error(`SDK standard checks failed (${violations.length} violation(s)):`);
    for (const violation of violations.slice(0, 100)) {
      console.error(`- ${violation.file}: [${violation.kind}] ${violation.message}`);
    }
    if (violations.length > 100) {
      console.error(`... and ${violations.length - 100} more`);
    }
    process.exit(1);
  }

  console.log('SDK package naming and layout checks passed');
  const consumerStatus = runConsumerImportCheck(workspace, values.fix);
  process.exit(consumerStatus);
}

main();
