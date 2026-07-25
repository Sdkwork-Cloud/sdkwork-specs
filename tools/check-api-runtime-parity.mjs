#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import {
  discoverApiRuntimeParityEvidence,
  validateApiRuntimeParityFile,
} from './lib/api-runtime-parity.mjs';

export function runApiRuntimeParityCheck(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      evidence: { type: 'string', multiple: true },
      root: { type: 'string' },
      workspace: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    return {
      help: [
        'Usage:',
        '  node tools/check-api-runtime-parity.mjs --evidence <evidence.json>',
        '  node tools/check-api-runtime-parity.mjs --root <repository-root>',
        '  node tools/check-api-runtime-parity.mjs --workspace <workspace-root>',
      ].join('\n'),
      issues: [],
    };
  }
  const selectedModes = [values.evidence?.length, values.root, values.workspace].filter(Boolean);
  if (selectedModes.length !== 1) {
    return { issues: ['select exactly one of --evidence, --root, or --workspace'] };
  }
  const files = values.evidence?.map((file) => path.resolve(file))
    ?? discoverApiRuntimeParityEvidence(path.resolve(values.root ?? values.workspace));
  if (files.length === 0) {
    return { issues: ['no api-runtime-parity.*.evidence.json files were found'] };
  }
  return { issues: files.flatMap(validateApiRuntimeParityFile), files };
}

function main() {
  const result = runApiRuntimeParityCheck();
  if (result.help) {
    console.log(result.help);
    return;
  }
  if (result.issues.length > 0) {
    console.error('API runtime parity check failed:');
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log(`API runtime parity check passed (${result.files.length} evidence file(s))`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
