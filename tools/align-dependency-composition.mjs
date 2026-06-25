#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  alignBootstrapCompositionImports,
  buildDependencyCompositionManifest,
  ensureAppRootComponentSpecPointer,
  ensureCoreCompositionScaffold,
  ensureMissingAppCorePackage,
  extractApplicationCode,
  findCorePackages,
  listClientAppRoots,
  readJson,
  syncCoreSdkDependencies,
  toPosix,
  writeJson,
} from './lib/dependency-composition.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');
const SKIP_REPOS = new Set(['sdkwork-specs']);

function usage() {
  return [
    'Usage: node tools/align-dependency-composition.mjs --workspace .. [--dry-run]',
    '',
    'Scaffolds specs/dependency.composition.json, core composition exports, and component pointers.',
  ].join('\n');
}

function collectPnpmPackages(appRoot) {
  const packages = [];
  const packagesDir = path.join(appRoot, 'packages');
  if (!fs.existsSync(packagesDir)) return packages;
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = path.join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;
    const packageJson = readJson(packageJsonPath);
    if (packageJson.name) packages.push(packageJson.name);
  }
  return packages;
}

function alignClientAppRoot(repoRoot, clientRoot, { dryRun = false } = {}) {
  const changes = [];
  const applicationCode = extractApplicationCode(clientRoot.appRootName);
  if (!applicationCode) return changes;

  changes.push(...ensureMissingAppCorePackage(clientRoot.appRoot, applicationCode, clientRoot.architecture, { dryRun }).map((item) => `${toPosix(path.relative(repoRoot, clientRoot.appRoot))}/${item}`));

  const cores = findCorePackages(
    clientRoot.appRoot,
    clientRoot.appRootName,
    applicationCode,
    clientRoot.architecture,
  );

  const manifestPath = path.join(clientRoot.appRoot, 'specs/dependency.composition.json');
  const manifest = buildDependencyCompositionManifest({
    applicationCode,
    architecture: clientRoot.architecture,
    cores,
    buildToolPackages: collectPnpmPackages(clientRoot.appRoot),
  });

  const existing = fs.existsSync(manifestPath) ? readJson(manifestPath) : null;
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  if (!existing || JSON.stringify(existing) !== JSON.stringify(manifest)) {
    if (!dryRun) writeJson(manifestPath, manifest);
    changes.push(toPosix(path.relative(repoRoot, manifestPath)));
  }

  changes.push(...ensureAppRootComponentSpecPointer(clientRoot.appRoot, { dryRun }).map((item) => toPosix(path.relative(repoRoot, path.join(clientRoot.appRoot, item)))));

  for (const core of cores) {
    changes.push(...syncCoreSdkDependencies(core, { dryRun }).map((item) => toPosix(path.relative(repoRoot, path.join(core.packageDir, item)))));

    for (const change of ensureCoreCompositionScaffold(core, { dryRun })) {
      changes.push(`${toPosix(path.relative(repoRoot, core.packageDir))}: ${change}`);
    }

    if (fs.existsSync(core.componentSpecPath)) {
      const coreSpec = readJson(core.componentSpecPath);
      coreSpec.contracts = coreSpec.contracts ?? {};
      const appManifestPointer = toPosix(path.relative(path.dirname(core.componentSpecPath), manifestPath));
      if (coreSpec.contracts.dependencyComposition !== appManifestPointer) {
        coreSpec.contracts.dependencyComposition = appManifestPointer;
        if (!dryRun) writeJson(core.componentSpecPath, coreSpec);
        changes.push(toPosix(path.relative(repoRoot, core.componentSpecPath)));
      }
    }
  }

  changes.push(...alignBootstrapCompositionImports(clientRoot.appRoot, cores, { dryRun }).map((item) => `${toPosix(path.relative(repoRoot, clientRoot.appRoot))}/${item}`));

  return changes;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      dryRun: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const workspace = path.resolve(values.workspace);
  const allChanges = [];

  for (const name of fs.readdirSync(workspace)) {
    if (!name.startsWith('sdkwork-') || SKIP_REPOS.has(name)) continue;
    const repoRoot = path.join(workspace, name);
    if (!fs.statSync(repoRoot).isDirectory()) continue;

    for (const clientRoot of listClientAppRoots(repoRoot)) {
      allChanges.push(...alignClientAppRoot(repoRoot, clientRoot, { dryRun: values.dryRun }));
    }
  }

  if (allChanges.length === 0) {
    console.log('dependency composition align: no changes');
    return;
  }

  console.log(`dependency composition align: ${allChanges.length} change(s)`);
  for (const change of allChanges.slice(0, 200)) console.log(`- ${change}`);
  if (allChanges.length > 200) console.log(`- ... ${allChanges.length - 200} more`);
}

main();
