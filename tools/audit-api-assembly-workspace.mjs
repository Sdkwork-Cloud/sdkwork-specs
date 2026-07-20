#!/usr/bin/env node
/**
 * Workspace audit for API assembly alignment.
 *
 * Authority:
 * - API_ASSEMBLY_SPEC.md sections 3 and 10
 * - TEST_SPEC.md (API assembly checks)
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { validateApiAssembly } from './validate-api-assembly.mjs';

function usage() {
  return [
    'Usage: node tools/audit-api-assembly-workspace.mjs --workspace <dir> [--prefix sdkwork-] [--strict]',
    '',
    'Reports API assembly compliance for every application root and any repository that owns route crates.',
    'Fails on assembly errors; prints missing gateway_mount warnings unless --strict.',
  ].join('\n');
}

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    prefix: { type: 'string', default: 'sdkwork-' },
    strict: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const workspaceRoot = path.resolve(
  parsed.values.workspace
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
);
const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
const failures = [];
const warnings = [];
let checked = 0;
let skipped = 0;

for (const repoRoot of repositories) {
  checked += 1;
  const repoName = path.basename(repoRoot);
  let result;
  try {
    result = validateApiAssembly(repoRoot, { strict: parsed.values.strict });
  } catch (error) {
    result = {
      ok: false,
      errors: [`validation failed without completing: ${error.message}`],
      warnings: [],
    };
  }

  if (result.skipped) {
    skipped += 1;
    continue;
  }

  if (result.errors.length === 0 && result.warnings.length === 0) {
    console.log(`ok   ${repoName}`);
    continue;
  }

  if (result.errors.length === 0) {
    console.log(`warn ${repoName} (${result.warnings.length} warnings)`);
    for (const warning of result.warnings) {
      console.log(`  ~ ${warning}`);
      warnings.push(`${repoName}: ${warning}`);
    }
    continue;
  }

  console.log(`fail ${repoName} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
  for (const issue of result.errors) {
    console.log(`  - ${issue}`);
    failures.push(`${repoName}: ${issue}`);
  }
  for (const warning of result.warnings) {
    console.log(`  ~ ${warning}`);
    warnings.push(`${repoName}: ${warning}`);
  }
}

console.log(`\nRepositories checked: ${checked}`);
console.log(`Repositories skipped (non-application, no route crates): ${skipped}`);
console.log(`Errors: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (failures.length > 0 || (parsed.values.strict && warnings.length > 0)) {
  console.error('\nSee API_ASSEMBLY_SPEC.md sections 3 and 10.');
  process.exit(1);
}
