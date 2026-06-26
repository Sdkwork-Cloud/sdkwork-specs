#!/usr/bin/env node
/**
 * Workspace gateway dependency-management alignment report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { auditGatewayAlignmentRepo } from './audit-gateway-alignment-repo.mjs';

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    prefix: { type: 'string', default: 'sdkwork-' },
    json: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});

if (parsed.values.help) {
  console.log('Usage: node tools/audit-gateway-alignment-workspace.mjs --workspace <dir> [--json]');
  process.exit(0);
}

const workspaceRoot = path.resolve(
  parsed.values.workspace
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
);
const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: parsed.values.prefix });
const reports = [];
let perfect = 0;
let warn = 0;
let fail = 0;
let skip = 0;

for (const repoRoot of repositories) {
  const report = auditGatewayAlignmentRepo(repoRoot);
  report.repo = path.basename(repoRoot);
  reports.push(report);
  if (report.score === 'perfect') {
    perfect += 1;
    console.log(`perfect ${report.repo}`);
  } else if (report.score === 'warn') {
    warn += 1;
    console.log(`warn   ${report.repo} (${report.warnings.length} warnings)`);
    for (const warning of report.warnings) {
      console.log(`  ~ ${warning}`);
    }
  } else if (report.score === 'fail') {
    fail += 1;
    console.log(`fail   ${report.repo} (${report.issues.length} issues, ${report.warnings.length} warnings)`);
    for (const issue of report.issues) {
      console.log(`  - ${issue}`);
    }
    for (const warning of report.warnings) {
      console.log(`  ~ ${warning}`);
    }
  } else {
    skip += 1;
  }
}

console.log(`\nRepositories: ${repositories.length}`);
console.log(`Perfect: ${perfect}`);
console.log(`Warn: ${warn}`);
console.log(`Fail: ${fail}`);
console.log(`Skipped (no route crates): ${skip}`);

if (parsed.values.json) {
  const outPath = path.join(workspaceRoot, 'sdkwork-specs', 'tools', '.gateway-alignment-report.json');
  fs.writeFileSync(outPath, `${JSON.stringify(reports, null, 2)}\n`, 'utf8');
  console.log(`JSON report: ${outPath}`);
}

if (fail > 0) {
  process.exit(1);
}
