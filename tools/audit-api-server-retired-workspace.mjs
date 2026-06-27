#!/usr/bin/env node
/**
 * Fail when retired *-api-server listener crates or binaries remain.
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.4 (retired)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { readText } from './gateway-assembly-lib.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

const SKIP_DIRS = new Set(['node_modules', 'target', 'target-alt', '.git']);

function findRetiredApiServerCrates(repoRoot) {
  const issues = [];
  for (const base of ['crates', 'services']) {
    const baseDir = path.join(repoRoot, base);
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    for (const name of fs.readdirSync(baseDir)) {
      if (!name.includes('-api-server')) {
        continue;
      }
      if (name === 'sdkwork-api-cloud-gateway-api-server') {
        issues.push(`${base}/${name} (platform listener crate retired)`);
        continue;
      }
      if (name.endsWith('-api-server')) {
        issues.push(`${base}/${name}`);
      }
    }
  }
  return issues;
}

function walkForCargo(dir, repoRoot, issues) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) {
        continue;
      }
      walkForCargo(full, repoRoot, issues);
      continue;
    }
    if (name !== 'Cargo.toml') {
      continue;
    }
    const rel = path.relative(repoRoot, full);
    const cargo = readText(full);
    const bins = [...cargo.matchAll(/\[\[bin\]\][\s\S]*?name\s*=\s*"([^"]+)"/gu)].map((m) => m[1]);
    for (const bin of bins) {
      if (/(?:^|-)api-server$/u.test(bin) && !bin.includes('cloud-gateway')) {
        issues.push(`${rel} bin ${bin}`);
      }
      if (/(?:^|-)(?:app-api|backend-api|open-api)$/u.test(bin) && !bin.startsWith('sdkwork-routes-')) {
        issues.push(`${rel} split-surface bin ${bin}`);
      }
    }
    const pkgMatch = /^name\s*=\s*"(sdkwork-[^"]*-api-server)"/mu.exec(cargo);
    if (pkgMatch && pkgMatch[1] !== 'sdkwork-api-cloud-gateway-api-server') {
      issues.push(`package ${pkgMatch[1]} in ${rel}`);
    }
  }
}

function findRetiredBins(repoRoot) {
  const issues = [];
  for (const base of ['crates', 'services']) {
    const baseDir = path.join(repoRoot, base);
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    walkForCargo(baseDir, repoRoot, issues);
  }
  return issues;
}

function usage() {
  return 'Usage: node tools/audit-api-server-retired-workspace.mjs [--workspace <path>]';
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const workspace = path.resolve(values.workspace);
  let failures = 0;
  for (const repoRoot of listWorkspaceRepositories(workspace, { prefix: 'sdkwork-' })) {
    const crateIssues = findRetiredApiServerCrates(repoRoot);
    const binIssues = findRetiredBins(repoRoot);
    const all = [...new Set([...crateIssues, ...binIssues])];
    if (all.length === 0) {
      continue;
    }
    console.log(`fail ${path.basename(repoRoot)}`);
    for (const issue of all) {
      console.log(`  - ${issue}`);
    }
    failures += all.length;
  }
  console.log(`\nFailures: ${failures}`);
  if (failures > 0) {
    process.exit(1);
  }
}

main();
