#!/usr/bin/env node
/**
 * Validates SDKWork route registry uniqueness across OpenAPI authorities and route manifests.
 * See APPLICATION_GATEWAY_SPEC.md section 5.7.3 and TEST_SPEC.md section 2.1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  classifyRouteRegistry,
} from './lib/route-registry.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function usage() {
  return [
    'Usage:',
    '  node tools/check-route-path-collisions.mjs [--root <specs-or-repo>]',
    '  node tools/check-route-path-collisions.mjs --workspace <sdkwork-space-root>',
    '',
    'Fails when two executable route declarations on the same surface/listener share the same normalized method/path.',
  ].join('\n');
}

function fail(message, details = []) {
  console.error(`route path collision check failed: ${message}`);
  for (const detail of details.slice(0, 200)) {
    console.error(`- ${detail}`);
  }
  if (details.length > 200) {
    console.error(`- ... and ${details.length - 200} more`);
  }
  process.exit(1);
}

function scanRoot(root) {
  return classifyRouteRegistry(root).map((issue) => `${issue.kind} - ${issue.detail}`);
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
    fail('duplicate route paths found', issues);
  }
  console.log('route path collision check passed');
}

main();
