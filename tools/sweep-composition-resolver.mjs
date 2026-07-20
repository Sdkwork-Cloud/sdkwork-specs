#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { alignCoreSdkDependencies } from './align-composition-sdk-dependencies.mjs';
import { listClientAppRoots } from './lib/app-composition.mjs';
import {
  resolveComposition,
  validateCompositionResolution,
} from './lib/composition-resolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPECS_ROOT = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    workspace: path.resolve(SPECS_ROOT, '..'),
    write: false,
    align: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--workspace') args.workspace = path.resolve(argv[++i]);
    else if (arg === '--write') args.write = true;
    else if (arg === '--align') args.align = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function isGitRepo(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

function listWorkspaceRepos(workspaceRoot) {
  const repos = [];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (entry.name === 'sdkwork-specs') continue;
    const repoRoot = path.join(workspaceRoot, entry.name);
    if (!isGitRepo(repoRoot)) continue;
    repos.push({ name: entry.name, root: repoRoot });
  }
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}

function auditRepo(repo, options) {
  const clientRoots = listClientAppRoots(repo.root);
  if (clientRoots.length === 0) {
    return {
      repo: repo.name,
      status: 'skip',
      reason: 'no client app root with core package',
      clientRoots: 0,
      issues: [],
      integrationCount: 0,
      requiresPlatformApiSurface: false,
    };
  }

  if (options.align && options.write) {
    alignCoreSdkDependencies(repo.root, { write: true });
  }

  const resolution = resolveComposition(repo.root);
  const issues = [
    ...resolution.issues,
    ...validateCompositionResolution(resolution),
  ];

  if (options.write && resolution.integrations.length > 0) {
    const outDir = path.join(repo.root, 'generated');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'composition.resolved.json'),
      `${JSON.stringify(resolution, null, 2)}\n`,
    );
  }

  return {
    repo: repo.name,
    status: issues.length > 0 ? 'fail' : 'pass',
    reason: issues.length > 0 ? issues[0] : 'ok',
    clientRoots: clientRoots.length,
    issues,
    integrationCount: resolution.integrations.length,
    requiresPlatformApiSurface: resolution.requiresPlatformApiSurface,
    externalPlatform: resolution.integrations.filter((entry) => entry.forbidApplicationSameOriginFallback).length,
    permissions: resolution.permissions.inheritedManifests.length,
  };
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(`Usage: node tools/sweep-composition-resolver.mjs [--workspace <path>] [--write] [--align]

Audit every git repository under the workspace for composition resolver alignment.
Use --align --write to auto-populate core sdkDependencies from package.json before auditing.`);
  process.exit(0);
}

const repos = listWorkspaceRepos(args.workspace);
const results = repos.map((repo) => auditRepo(repo, args));

const passed = results.filter((entry) => entry.status === 'pass');
const failed = results.filter((entry) => entry.status === 'fail');
const skipped = results.filter((entry) => entry.status === 'skip');

console.log(`Composition resolver workspace sweep: ${repos.length} git repositories`);
console.log(`  pass: ${passed.length}`);
console.log(`  fail: ${failed.length}`);
console.log(`  skip: ${skipped.length} (no client app)`);
console.log('');

for (const entry of results.filter((item) => item.status !== 'skip')) {
  const flags = [
    `integrations=${entry.integrationCount}`,
    entry.requiresPlatformApiSurface ? 'platform-api-surface=required' : 'platform-api-surface=no',
    `permissions=${entry.permissions}`,
  ].join(', ');
  console.log(`${entry.status === 'pass' ? 'OK' : 'FAIL'} ${entry.repo} (${flags})`);
  for (const issue of entry.issues) {
    console.log(`  - ${issue}`);
  }
}

if (failed.length > 0) {
  process.exit(1);
}
