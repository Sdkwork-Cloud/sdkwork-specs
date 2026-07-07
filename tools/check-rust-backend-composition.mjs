#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateRustBackendComposition,
} from './lib/rust-backend-composition.mjs';
import {
  collectWorkspaceValidationIssues,
} from './lib/workspace-check-runner.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node tools/check-rust-backend-composition.mjs [--root <repo>]',
    '  node tools/check-rust-backend-composition.mjs --workspace <sdkwork-space-root>',
    '',
    'Fails when Rust backend crate dependencies violate SDKWork service/repository/route/runtime boundaries.',
  ].join('\n');
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: SPECS_ROOT },
      workspace: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const issues = values.workspace
    ? collectWorkspaceValidationIssues(
      path.resolve(values.workspace),
      (repoRoot) => validateRustBackendComposition(repoRoot),
    )
    : validateRustBackendComposition(path.resolve(values.root));
  if (issues.length > 0) {
    console.error('rust backend composition check failed: violations found');
    for (const issue of issues.slice(0, 200)) {
      console.error(`- ${issue}`);
    }
    if (issues.length > 200) {
      console.error(`- ... and ${issues.length - 200} more`);
    }
    process.exit(1);
  }

  console.log('rust backend composition check passed');
}

main();
