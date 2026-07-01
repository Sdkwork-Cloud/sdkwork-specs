#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  partitionIssues,
  scanRepositoryPackagesLayout,
  summarizeRepositoryPackagesLayout,
} from './lib/packages-layout-patterns.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { mode: 'enforce', target: process.cwd() };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      args.scope = 'root';
      args.target = path.resolve(argv[++index]);
    } else if (arg === '--workspace') {
      args.scope = 'workspace';
      args.target = path.resolve(argv[++index]);
    } else if (arg === '--mode') {
      args.mode = argv[++index];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  if (!args.scope) {
    args.scope = 'root';
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node tools/check-workspace-packages-layout.mjs --root <repository-root> [--mode enforce|migration|audit]',
    '  node tools/check-workspace-packages-layout.mjs --workspace <multi-repo-checkout-root> [--mode enforce|migration|audit]',
    '',
    'Modes:',
    '  enforce    fail on application-repository violations (default)',
    '  migration  warn on legacy-application debt, fail on canonical application repositories',
    '  audit      report only, exit 0',
  ].join('\n');
}

function listWorkspaceRepositories(workspaceRoot) {
  return fs.readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((repoRoot) => fs.existsSync(path.join(repoRoot, 'package.json')) || fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml')));
}

function printAuditSummary(summaries) {
  const totals = summaries.reduce((acc, summary) => {
    acc.repositories += 1;
    acc.errors += summary.errors.length;
    acc.warnings += summary.warnings.length;
    if (summary.issueCount === 0) {
      acc.clean += 1;
    }
    acc.byKind[summary.repositoryKind] = (acc.byKind[summary.repositoryKind] ?? 0) + 1;
    return acc;
  }, { repositories: 0, clean: 0, errors: 0, warnings: 0, byKind: {} });

  console.log('packages layout audit summary');
  console.log(`- repositories: ${totals.repositories}`);
  console.log(`- clean: ${totals.clean}`);
  console.log(`- errors: ${totals.errors}`);
  console.log(`- warnings: ${totals.warnings}`);
  console.log('- repository-kind:');
  for (const [kind, count] of Object.entries(totals.byKind).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  - ${kind}: ${count}`);
  }

  for (const summary of summaries.filter((entry) => entry.issueCount > 0).sort((a, b) => b.issueCount - a.issueCount)) {
    console.log(`\n[${path.basename(summary.repoRoot)}] kind=${summary.repositoryKind} issues=${summary.issueCount}`);
    for (const issue of [...summary.errors, ...summary.warnings, ...summary.infos]) {
      const level = issue.severity ?? 'error';
      console.log(`  - ${level} ${issue.kind}: ${issue.path} — ${issue.detail}`);
    }
  }
}

function fail(message, details = []) {
  console.error(`packages layout failed: ${message}`);
  for (const detail of details) {
    const level = detail.severity ?? 'error';
    console.error(`- ${level} ${detail.kind}: ${detail.path} — ${detail.detail}`);
  }
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!['enforce', 'migration', 'audit'].includes(args.mode)) {
    fail(`unsupported mode ${args.mode}`);
  }

  const specPath = path.join(SPECS_ROOT, 'SDKWORK_WORKSPACE_SPEC.md');
  if (!fs.existsSync(specPath)) {
    fail('missing SDKWORK_WORKSPACE_SPEC.md');
  }

  const repoRoots = args.scope === 'workspace'
    ? listWorkspaceRepositories(args.target)
    : [args.target];

  const summaries = repoRoots.map((repoRoot) => summarizeRepositoryPackagesLayout(repoRoot, { mode: args.mode }));

  if (args.mode === 'audit') {
    printAuditSummary(summaries);
    process.exit(0);
  }

  const allIssues = [];
  for (const summary of summaries) {
    allIssues.push(
      ...scanRepositoryPackagesLayout(summary.repoRoot, { mode: args.mode }).map((issue) => ({
        ...issue,
        path: `[${path.basename(summary.repoRoot)}] ${issue.path}`,
      })),
    );
  }

  const { errors, warnings } = partitionIssues(allIssues);

  if (warnings.length > 0) {
    console.warn(`packages layout warnings (${warnings.length}):`);
    for (const warning of warnings) {
      console.warn(`- warn ${warning.kind}: ${warning.path} — ${warning.detail}`);
    }
  }

  if (errors.length > 0) {
    fail(`found ${errors.length} issue(s)`, errors);
  }

  console.log(`packages layout passed (${repoRoots.length} repository root(s), mode=${args.mode})`);
}

main();
