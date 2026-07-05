/**
 * Discover TypeScript SDK families and resolve standard naming roles.
 * See SDK_PACKAGE_NAMING_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';

import { listWorkspaceRepos } from './app-sdk-consumer-import-patterns.mjs';

export function resolveConsumerPackageName(sdkFamilyStem) {
  const token = sdkFamilyStem.startsWith('sdkwork-')
    ? sdkFamilyStem.slice('sdkwork-'.length)
    : sdkFamilyStem;
  return `@sdkwork/${token}`;
}

export function resolveTransportPackageName(sdkFamilyStem) {
  return `${sdkFamilyStem}-generated-typescript`;
}

function findTypescriptRoot(familyRoot) {
  const familyStem = path.basename(familyRoot);
  const canonical = path.join(familyRoot, `${familyStem}-typescript`);
  if (fs.existsSync(canonical)) return canonical;

  for (const entry of fs.readdirSync(familyRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.endsWith('-typescript')) {
      return path.join(familyRoot, entry.name);
    }
  }
  return null;
}

/** All *-typescript roots under a family that contain generated/server-openapi transport. */
export function listTransportRootsInFamily(familyRoot, sdkFamilyStem) {
  const transports = [];
  if (!fs.existsSync(familyRoot)) return transports;

  for (const entry of fs.readdirSync(familyRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith('-typescript')) continue;
    const typescriptRoot = path.join(familyRoot, entry.name);
    const transportRoot = path.join(typescriptRoot, 'generated', 'server-openapi');
    if (!fs.existsSync(path.join(transportRoot, 'package.json'))) continue;
    transports.push({
      familyRoot,
      sdkFamilyStem,
      typescriptRoot,
      typescriptRootName: entry.name,
      transportRoot,
      transportRootRelative: path.relative(familyRoot, transportRoot).replace(/\\/g, '/'),
      isCanonical: entry.name === `${sdkFamilyStem}-typescript`,
      transportPackageJsonPath: path.join(transportRoot, 'package.json'),
      transportSdkJsonPath: path.join(transportRoot, 'sdkwork-sdk.json'),
    });
  }

  return transports.sort((a, b) => a.typescriptRootName.localeCompare(b.typescriptRootName));
}

function buildFamilyRecord(repoRoot, familyRoot, sdkFamilyStem, typescriptRoot, transportRoot) {
  const composedRoot = typescriptRoot
    ? path.relative(familyRoot, typescriptRoot).replace(/\\/g, '/')
    : '.';
  const relativeTransportRoot = path.relative(familyRoot, transportRoot).replace(/\\/g, '/');
  return {
    repoRoot,
    familyRoot,
    sdkFamilyStem,
    typescriptRoot: typescriptRoot ?? path.join(familyRoot, `${sdkFamilyStem}-typescript`),
    transportRoot,
    composedRoot,
    transportRootRelative: relativeTransportRoot,
    consumerPackageName: resolveConsumerPackageName(sdkFamilyStem),
    transportPackageName: resolveTransportPackageName(sdkFamilyStem),
    composedEntry: `${composedRoot}/src/index.ts`,
    transportEntry: `${relativeTransportRoot}/src/index.ts`,
    manifestPath: path.join(familyRoot, 'sdk-manifest.json'),
    composedPackageJsonPath: path.join(typescriptRoot ?? familyRoot, 'package.json'),
    transportPackageJsonPath: path.join(transportRoot, 'package.json'),
    transportSdkJsonPath: path.join(transportRoot, 'sdkwork-sdk.json'),
    composedFacadePath: path.join(typescriptRoot ?? familyRoot, 'src', 'index.ts'),
  };
}

function discoverFamilyAtRoot(repoRoot, familyRoot, sdkFamilyStem) {
  const typescriptRoot = findTypescriptRoot(familyRoot);
  if (typescriptRoot) {
    const transportRoot = path.join(typescriptRoot, 'generated', 'server-openapi');
    if (fs.existsSync(path.join(transportRoot, 'package.json'))) {
      return buildFamilyRecord(repoRoot, familyRoot, sdkFamilyStem, typescriptRoot, transportRoot);
    }
  }

  const legacyTransportRoot = path.join(familyRoot, 'generated', 'server-openapi');
  if (fs.existsSync(path.join(legacyTransportRoot, 'package.json'))) {
    const legacyTypescriptRoot = typescriptRoot ?? path.join(familyRoot, `${sdkFamilyStem}-typescript`);
    return buildFamilyRecord(repoRoot, familyRoot, sdkFamilyStem, legacyTypescriptRoot, legacyTransportRoot);
  }

  return null;
}

export function discoverSdkFamilies(repoRoot) {
  const families = [];
  const sdksDir = path.join(repoRoot, 'sdks');
  if (!fs.existsSync(sdksDir)) return families;

  for (const entry of fs.readdirSync(sdksDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const familyRoot = path.join(sdksDir, entry.name);
    const record = discoverFamilyAtRoot(repoRoot, familyRoot, entry.name);
    if (record) families.push(record);
  }

  return families.sort((a, b) => a.sdkFamilyStem.localeCompare(b.sdkFamilyStem));
}

export function discoverAllSdkFamilies(workspaceRoot) {
  const all = [];
  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    all.push(...discoverSdkFamilies(repoRoot));
  }
  return all;
}

export function discoverAppNestedSdkFamilies(repoRoot) {
  const families = [];
  const appsDir = path.join(repoRoot, 'apps');
  if (!fs.existsSync(appsDir)) return families;

  for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (!app.isDirectory()) continue;
    const sdksDir = path.join(appsDir, app.name, 'sdks');
    if (!fs.existsSync(sdksDir)) continue;
    for (const entry of fs.readdirSync(sdksDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const familyRoot = path.join(sdksDir, entry.name);
      const record = discoverFamilyAtRoot(repoRoot, familyRoot, entry.name);
      if (record) families.push(record);
    }
  }
  return families;
}

export function discoverAllSdkFamiliesIncludingApps(workspaceRoot) {
  const seen = new Set();
  const all = [];
  for (const family of [
    ...discoverAllSdkFamilies(workspaceRoot),
    ...listWorkspaceRepos(workspaceRoot).flatMap((repo) => discoverAppNestedSdkFamilies(repo)),
  ]) {
    const key = family.transportRoot;
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(family);
  }
  return all.sort((a, b) => a.transportRoot.localeCompare(b.transportRoot));
}
