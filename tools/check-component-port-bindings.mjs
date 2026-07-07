#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  validateComponentPortBindings,
} from './lib/component-port-bindings.mjs';
import {
  collectWorkspaceValidationIssues,
} from './lib/workspace-check-runner.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node tools/check-component-port-bindings.mjs [--root <repo>] [--strict]',
    '  node tools/check-component-port-bindings.mjs --workspace <sdkwork-space-root> [--strict]',
    '',
    'Fails when component specs declare invalid composable architecture layer roles, ports, or runtime entrypoints.',
  ].join('\n');
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: SPECS_ROOT },
      workspace: { type: 'string' },
      strict: { type: 'boolean', default: false },
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
      (repoRoot) => validateComponentPortBindings(repoRoot, { strict: values.strict }),
    )
    : validateComponentPortBindings(path.resolve(values.root), { strict: values.strict });
  if (issues.length > 0) {
    console.error('component port binding check failed: violations found');
    for (const issue of issues.slice(0, 200)) {
      console.error(`- ${issue}`);
    }
    if (issues.length > 200) {
      console.error(`- ... and ${issues.length - 200} more`);
    }
    process.exit(1);
  }

  console.log('component port binding check passed');
}

main();
