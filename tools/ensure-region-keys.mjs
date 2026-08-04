#!/usr/bin/env node

/**
 * Ensure region deployment keys across every sdkwork-space application that
 * declares a v5 topology spec.
 *
 * For each application root (directories named sdkwork-* under the workspace
 * root) with a `specs/topology.spec.json`, this tool injects the region
 * deployment dimension into every profile env file (`etc/topology/` or
 * `configs/topology/`):
 *
 *   SDKWORK_<APPLICATION_CODE>_REGION_CODE=global
 *   SDKWORK_DATABASE_SEED_LOCALE=zh-CN
 *
 * The region is orthogonal to the deployment profile (REGION_SPEC.md): the
 * profile file keeps the default `global` and deployments override it through
 * an explicit region layer. Existing keys are left untouched (idempotent).
 *
 * Usage:
 *   node tools/ensure-region-keys.mjs [--workspace <root>] [--dry-run] [--root <repo>...]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_WORKSPACE_ROOT = path.resolve(import.meta.dirname, '..', '..');

function parseArgs(argv) {
  const settings = {
    workspaceRoot: DEFAULT_WORKSPACE_ROOT,
    dryRun: false,
    roots: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      settings.workspaceRoot = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === '--dry-run') {
      settings.dryRun = true;
    } else if (arg === '--root') {
      settings.roots.push(path.resolve(argv[index + 1]));
      index += 1;
    }
  }
  return settings;
}

function applicationCode(spec) {
  return String(spec?.applicationCode ?? spec?.appId ?? 'APP').toUpperCase();
}

function regionKeys(applicationCode) {
  return [
    `SDKWORK_${applicationCode}_REGION_CODE=global`,
    'SDKWORK_DATABASE_SEED_LOCALE=zh-CN',
  ];
}

function profileRootsFor(repoRoot) {
  const candidates = ['etc/topology', 'configs/topology'];
  return candidates
    .map((relative) => path.join(repoRoot, relative))
    .filter((dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory());
}

function injectRegionKeys(envFilePath, keys, dryRun) {
  let content = fs.readFileSync(envFilePath, 'utf8');
  const missing = keys.filter((key) => !content.split('\n').some((line) => line.startsWith(key.split('=')[0])));
  if (missing.length === 0) {
    return 0;
  }
  const block = [
    '',
    '# Region deployment dimension (REGION_SPEC.md): orthogonal to deployment profile and environment.',
    ...keys,
    '',
  ].join('\n');
  const lines = content.split('\n');
  // Insert after the identity header block (first blank line).
  let insertAt = lines.length;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '') {
      insertAt = index + 1;
      break;
    }
  }
  lines.splice(insertAt, 0, block);
  const updated = lines.join('\n');
  if (!dryRun) {
    fs.writeFileSync(envFilePath, updated);
  }
  return missing.length;
}

function findTopologyApplications(workspaceRoot) {
  if (!fs.existsSync(workspaceRoot)) return [];
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspaceRoot, entry.name))
    .filter((repoRoot) =>
      fs.existsSync(path.join(repoRoot, 'specs', 'topology.spec.json')),
    );
}

function main() {
  const settings = parseArgs(process.argv.slice(2));
  const roots = settings.roots.length > 0
    ? settings.roots
    : findTopologyApplications(settings.workspaceRoot);
  const summary = { applications: 0, envFiles: 0, injectedKeys: 0, dryRun: settings.dryRun };
  for (const repoRoot of roots) {
    const specPath = path.join(repoRoot, 'specs', 'topology.spec.json');
    if (!fs.existsSync(specPath)) {
      console.log(`[skip] no topology spec: ${path.basename(repoRoot)}`);
      continue;
    }
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    const code = applicationCode(spec);
    const keys = regionKeys(code);
    const profileRoots = profileRootsFor(repoRoot);
    if (profileRoots.length === 0) {
      console.log(`[warn] no profile env dir: ${path.basename(repoRoot)}`);
      continue;
    }
    summary.applications += 1;
    for (const dir of profileRoots) {
      for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.env'))) {
        const envFilePath = path.join(dir, file);
        const injected = injectRegionKeys(envFilePath, keys, settings.dryRun);
        summary.envFiles += 1;
        summary.injectedKeys += injected;
        if (injected > 0) {
          console.log(
            `[${settings.dryRun ? 'plan' : 'updated'}] ${path.basename(repoRoot)}/${path.basename(dir)}/${file} +${injected} region keys`,
          );
        }
      }
    }
  }
  console.log(JSON.stringify(summary, null, 2));
}

main();
