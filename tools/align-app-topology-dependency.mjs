#!/usr/bin/env node
/** Align topology applications with the declared @sdkwork/app-topology workspace dependency. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

import {
  isSiblingPackageEntry,
  parsePnpmWorkspaceCatalog,
  parsePnpmWorkspacePackages,
  readJsonIfExists,
  uniquePackages,
} from './lib/workspace-registry.mjs';
import { rewriteLegacySiblingEntry } from './lib/workspace-federation-path-patterns.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function normalizeCatalog(catalog) {
  return Object.fromEntries(Object.entries(catalog ?? {}).map(([key, value]) => {
    const text = String(value);
    if (text.startsWith('"') && text.endsWith('"')) {
      try {
        return [key, JSON.parse(text)];
      } catch {
        return [key, text];
      }
    }
    return [key, text];
  }));
}

function normalizeSiblingPackages(entries, repoRoot) {
  return entries.map((entry) => rewriteLegacySiblingEntry(entry, repoRoot) ?? entry);
}

export function planTopologyDependencyAlignment(repoRoot, specsRoot = SPECS_ROOT) {
  const packagePath = path.join(repoRoot, 'package.json');
  const topologyPath = path.join(repoRoot, 'specs', 'topology.spec.json');
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(packagePath) || !fs.existsSync(topologyPath)) return null;
  const topology = readJsonIfExists(topologyPath);
  if (topology?.schemaVersion !== 5) return null;
  const manifest = readJsonIfExists(packagePath);
  const repoName = path.basename(repoRoot);
  const consumerPath = path.join(specsRoot, 'workspace', 'consumers', `${repoName}.json`);
  const consumer = readJsonIfExists(consumerPath) ?? { pnpm: { packages: [] }, catalog: {} };
  const workspaceText = fs.existsSync(workspacePath) ? fs.readFileSync(workspacePath, 'utf8') : '';
  const currentSiblingPackages = parsePnpmWorkspacePackages(workspaceText).filter(isSiblingPackageEntry);
  const currentCatalog = parsePnpmWorkspaceCatalog(workspaceText);
  const packages = uniquePackages(normalizeSiblingPackages([
    '../sdkwork-app-topology',
    ...(consumer.pnpm?.packages ?? []),
    ...currentSiblingPackages,
  ], repoRoot));
  const nextConsumer = {
    pnpm: { packages },
    catalog: { ...normalizeCatalog(currentCatalog), ...normalizeCatalog(consumer.catalog) },
  };
  const nextManifest = structuredClone(manifest);
  const dependencySection = nextManifest.dependencies ? 'dependencies' : 'devDependencies';
  nextManifest[dependencySection] ??= {};
  nextManifest[dependencySection]['@sdkwork/app-topology'] = 'workspace:*';
  const actions = [];
  if (!isDeepStrictEqual(manifest, nextManifest)) actions.push('declare @sdkwork/app-topology workspace dependency');
  if (!isDeepStrictEqual(consumer, nextConsumer)) actions.push('align workspace consumer authority');
  return { actions, consumerPath, manifest: nextManifest, packagePath, consumer: nextConsumer };
}

function main() {
  const { values } = parseArgs({ options: {
    workspace: { type: 'string', default: DEFAULT_WORKSPACE },
    repo: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  } });
  const workspace = path.resolve(values.workspace);
  const repos = values.repo
    ? [path.join(workspace, values.repo)]
    : fs.readdirSync(workspace, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(workspace, entry.name));
  let total = 0;
  for (const repoRoot of repos) {
    const plan = planTopologyDependencyAlignment(repoRoot);
    if (!plan || plan.actions.length === 0) continue;
    console.log(`\n${path.basename(repoRoot)}${values['dry-run'] ? ' (dry-run)' : ''}:`);
    for (const action of plan.actions) console.log(`  - ${action}`);
    total += plan.actions.length;
    if (!values['dry-run']) {
      writeJson(plan.packagePath, plan.manifest);
      writeJson(plan.consumerPath, plan.consumer);
    }
  }
  console.log(`\nTotal topology dependency actions: ${total}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
