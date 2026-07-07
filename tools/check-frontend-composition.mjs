#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateFrontendComposition,
} from './lib/frontend-composition.mjs';
import {
  collectWorkspaceValidationIssues,
} from './lib/workspace-check-runner.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node tools/check-frontend-composition.mjs [--root <repo>]',
    '  node tools/check-frontend-composition.mjs --workspace <sdkwork-space-root>',
    '',
    'Fails when frontend package composition violates SDKWork core/feature/host boundaries.',
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
      (repoRoot) => validateFrontendComposition(repoRoot),
    )
    : validateFrontendComposition(path.resolve(values.root));
  if (issues.length > 0) {
    console.error('frontend composition check failed: violations found');
    for (const issue of issues.slice(0, 200)) {
      console.error(`- ${issue}`);
    }
    if (issues.length > 200) {
      console.error(`- ... and ${issues.length - 200} more`);
    }
    process.exit(1);
  }

  console.log('frontend composition check passed');
}

main();
