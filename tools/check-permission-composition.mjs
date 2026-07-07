#!/usr/bin/env node
/**
 * Validates SDKWork application permission composition for modular SDK dependencies.
 * See APP_PERMISSION_COMPOSITION_SPEC.md and PERMISSION_STANDARD_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  classifyPermissionComposition,
} from './lib/permission-composition.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node tools/check-permission-composition.mjs [--root <specs-or-repo>]',
    '  node tools/check-permission-composition.mjs --workspace <sdkwork-space-root>',
    '',
    'Fails when sdkDependencies are not backed by inherited permission catalogs or OpenAPI permission codes do not resolve.',
  ].join('\n');
}

function fail(message, details = []) {
  console.error(`permission composition check failed: ${message}`);
  for (const detail of details.slice(0, 200)) {
    console.error(`- ${detail}`);
  }
  if (details.length > 200) {
    console.error(`- ... and ${details.length - 200} more`);
  }
  process.exit(1);
}

function scanRoot(root) {
  return classifyPermissionComposition(root);
}

function scanWorkspace(workspaceRoot) {
  const issues = [];
  if (!fs.existsSync(workspaceRoot)) return [`workspace root not found: ${workspaceRoot}`];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
    const repoRoot = path.join(workspaceRoot, entry.name);
    for (const issue of scanRoot(repoRoot)) {
      issues.push(`${entry.name}: ${issue}`);
    }
  }
  return issues;
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

  const root = path.resolve(values.root);
  const issues = values.workspace
    ? scanWorkspace(path.resolve(values.workspace))
    : scanRoot(root);

  if (issues.length > 0) {
    fail('permission composition violations found', issues);
  }
  console.log('permission composition check passed');
}

main();
