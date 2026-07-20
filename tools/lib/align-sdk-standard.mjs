/**
 * Align SDK families to SDK_PACKAGE_NAMING_SPEC.md (single consumer package model).
 */
import fs from 'node:fs';
import path from 'node:path';

import { listWorkspaceRepos } from './app-sdk-consumer-import-patterns.mjs';
import { parsePnpmWorkspacePackages } from './workspace-registry.mjs';
import { discoverAllSdkFamiliesIncludingApps, listTransportRootsInFamily } from './sdk-family-discovery.mjs';
import { materializeMissingComposedFacades, facadeBodyForConsumer } from './materialize-composed-sdk-facades.mjs';
import {
  collectParallelSdkRegistryViolations,
  inferManifestOwnership,
  manifestHasOwnership,
} from './sdk-manifest-standard.mjs';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function inferSdkType(family) {
  if (family.sdkFamilyStem.includes('-backend-') || family.sdkFamilyStem.endsWith('-backend-sdk')) return 'backend';
  if (family.sdkFamilyStem.includes('-internal-') || family.sdkFamilyStem.endsWith('-internal-sdk')) return 'internal';
  if (family.sdkFamilyStem.endsWith('-app-sdk')) return 'app';
  return 'open';
}

function cleanComposedPackageDependencies(family, pkg) {
  let changed = false;
  if (!pkg.dependencies) return false;
  for (const key of Object.keys(pkg.dependencies)) {
    const remove = key === family.transportPackageName
      || key.startsWith('@sdkwork-internal/')
      || /^@sdkwork\/[a-z0-9-]+-generated$/u.test(key)
      || key.endsWith('-generated-typescript');
    if (remove) {
      delete pkg.dependencies[key];
      changed = true;
    }
  }
  return changed;
}

function ensureComposedPackageJson(family) {
  const target = family.composedPackageJsonPath;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  let pkg;
  let changed = false;

  if (fs.existsSync(target)) {
    pkg = readJson(target);
  } else {
    pkg = {
      name: family.consumerPackageName,
      version: '0.1.0',
      description: `SDKWork ${family.sdkFamilyStem} composed consumer facade.`,
      type: 'module',
      private: true,
    };
    changed = true;
  }

  if (pkg.name !== family.consumerPackageName) {
    pkg.name = family.consumerPackageName;
    changed = true;
  }
  if (!pkg.main) {
    pkg.main = './src/index.ts';
    changed = true;
  }
  if (!pkg.module) {
    pkg.module = './src/index.ts';
    changed = true;
  }
  if (!pkg.types) {
    pkg.types = './src/index.ts';
    changed = true;
  }

  const nextExports = { ...(pkg.exports ?? {}) };
  if (!nextExports['.']) {
    nextExports['.'] = {
      types: './src/index.ts',
      import: './src/index.ts',
      default: './src/index.ts',
    };
    changed = true;
  }
  if (nextExports['./generated']) {
    delete nextExports['./generated'];
    changed = true;
  }
  if (JSON.stringify(pkg.exports ?? {}) !== JSON.stringify(nextExports)) {
    pkg.exports = nextExports;
    changed = true;
  }

  if (!pkg.dependencies?.['@sdkwork/sdk-common']) {
    pkg.dependencies = {
      ...(pkg.dependencies ?? {}),
      '@sdkwork/sdk-common': 'workspace:*',
    };
    changed = true;
  }

  if (cleanComposedPackageDependencies(family, pkg)) changed = true;

  if (changed) writeJson(target, pkg);
  return changed ? target : null;
}

function ensureComposedFacade(family) {
  const target = family.composedFacadePath;
  if (fs.existsSync(target)) return null;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, facadeBodyForConsumer(family.consumerPackageName), 'utf8');
  return target;
}

function ensureManifest(family) {
  const target = family.manifestPath;
  let manifest;
  let changed = false;

  if (fs.existsSync(target)) {
    manifest = readJson(target);
  } else {
    manifest = { schemaVersion: 1 };
    changed = true;
  }

  const assign = (key, value) => {
    if (manifest[key] !== value) {
      manifest[key] = value;
      changed = true;
    }
  };

  assign('sdkFamily', family.sdkFamilyStem);
  if (!manifest.sdkName) assign('sdkName', family.sdkFamilyStem);
  assign('packageName', family.consumerPackageName);
  assign('transportPackageName', family.transportPackageName);

  manifest.typescript = {
    composedRoot: family.composedRoot,
    composedEntry: family.composedEntry,
    transportRoot: family.transportRootRelative,
    transportEntry: family.transportEntry,
  };
  changed = true;

  manifest = inferManifestOwnership(family.familyRoot, family.sdkFamilyStem, manifest, family.repoRoot);
  changed = true;

  writeJson(target, manifest);
  return target;
}

function alignTransportPackageJsonForPath(family, transportPackageJsonPath) {
  const target = transportPackageJsonPath;
  if (!fs.existsSync(target)) return null;
  const pkg = readJson(target);
  let changed = false;

  if (pkg.name !== family.transportPackageName) {
    pkg.name = family.transportPackageName;
    changed = true;
  }
  if (pkg.private !== true) {
    pkg.private = true;
    changed = true;
  }
  if (pkg.sdkworkRole !== 'transport') {
    pkg.sdkworkRole = 'transport';
    changed = true;
  }
  const description = `Generator-owned TypeScript transport SDK for ${family.sdkFamilyStem}.`;
  if (pkg.description !== description) {
    pkg.description = description;
    changed = true;
  }

  if (changed) writeJson(target, pkg);
  return changed ? target : null;
}

function alignTransportPackageJson(family) {
  return alignTransportPackageJsonForPath(family, family.transportPackageJsonPath);
}

function alignTransportSdkJsonForPath(family, transportSdkJsonPath) {
  const target = transportSdkJsonPath;
  if (!fs.existsSync(target)) return null;
  const metadata = readJson(target);
  let changed = false;

  const assign = (key, value) => {
    if (metadata[key] !== value) {
      metadata[key] = value;
      changed = true;
    }
  };

  assign('name', family.sdkFamilyStem);
  assign('transportPackageName', family.transportPackageName);
  assign('consumerPackageName', family.consumerPackageName);
  if (metadata.packageName !== family.transportPackageName) {
    metadata.packageName = family.transportPackageName;
    changed = true;
  }

  if (changed) writeJson(target, metadata);
  return changed ? target : null;
}

function alignTransportSdkJson(family) {
  return alignTransportSdkJsonForPath(family, family.transportSdkJsonPath);
}

function alignAllFamilyTransports(family) {
  const changed = [];
  for (const transport of listTransportRootsInFamily(family.familyRoot, family.sdkFamilyStem)) {
    const file = alignTransportPackageJsonForPath(family, transport.transportPackageJsonPath);
    if (file) changed.push(file);
    const sdkJson = alignTransportSdkJsonForPath(family, transport.transportSdkJsonPath);
    if (sdkJson) changed.push(sdkJson);
  }
  return changed;
}

function collectFamilyTransportViolations(family) {
  const violations = [];
  for (const transport of listTransportRootsInFamily(family.familyRoot, family.sdkFamilyStem)) {
    if (!transport.isCanonical) {
      violations.push({
        kind: 'legacy-duplicate-typescript-root',
        file: transport.typescriptRoot,
        message: `remove legacy TypeScript root ${transport.typescriptRootName}; canonical root is ${family.sdkFamilyStem}-typescript`,
      });
    }
    const transportPkg = readJson(transport.transportPackageJsonPath);
    if (transportPkg.name !== family.transportPackageName) {
      violations.push({
        kind: 'transport-package-name',
        file: transport.transportPackageJsonPath,
        message: `${transportPkg.name} must be ${family.transportPackageName}`,
      });
    }
    if (String(transportPkg.name).startsWith('@sdkwork/')) {
      violations.push({
        kind: 'transport-scoped-name',
        file: transport.transportPackageJsonPath,
        message: 'transport package must not use @sdkwork scope',
      });
    }
  }
  return violations;
}

function workspaceEntryToComposed(entry) {
  if (entry.includes('generated/domains/server-openapi')) {
    return entry.replace(/\/generated\/domains\/server-openapi\/?$/u, '');
  }
  if (!entry.includes('generated/server-openapi')) return null;
  const composed = entry.replace(/\/generated\/server-openapi\/?$/u, '');
  if (composed.endsWith('-backend-sdk') || composed.endsWith('-app-sdk') || composed.endsWith('-sdk')) {
    const typescriptSuffix = composed.match(/(?:^|\/)(sdkwork-[a-z0-9-]+-sdk|clawrouter-[a-z0-9-]+-sdk)$/u)?.[1];
    if (typescriptSuffix && !composed.endsWith('-typescript')) {
      return `${composed}/${typescriptSuffix}-typescript`;
    }
  }
  return composed;
}

function alignPnpmWorkspace(repoRoot) {
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return null;

  const original = fs.readFileSync(workspacePath, 'utf8');
  const packages = parsePnpmWorkspacePackages(original);
  const next = [];
  const seen = new Set();

  for (const entry of packages) {
    if (entry.includes('generated/server-openapi')) {
      const composed = workspaceEntryToComposed(entry.replace(/\\/g, '/'));
      if (composed && !seen.has(composed)) {
        next.push(composed);
        seen.add(composed);
      }
      continue;
    }
    if (entry.includes('generated/domains/server-openapi')) continue;
    if (!seen.has(entry)) {
      next.push(entry);
      seen.add(entry);
    }
  }

  const rebuilt = rebuildPnpmWorkspaceYaml(original, next);
  if (rebuilt === original) return null;
  fs.writeFileSync(workspacePath, rebuilt, 'utf8');
  return workspacePath;
}

function rebuildPnpmWorkspaceYaml(original, packages) {
  const lines = original.split(/\r?\n/u);
  const output = [];
  let inPackages = false;
  let packagesReplaced = false;

  for (const line of lines) {
    if (/^packages:\s*$/u.test(line)) {
      output.push(line);
      inPackages = true;
      continue;
    }
    if (inPackages && /^\s*-\s/u.test(line)) {
      if (!packagesReplaced) {
        for (const pkg of packages) {
          output.push(`  - "${pkg}"`);
        }
        packagesReplaced = true;
      }
      continue;
    }
    if (inPackages && /^[A-Za-z0-9_./-]+:\s*$/u.test(line) && !line.startsWith(' ')) {
      inPackages = false;
    }
    if (!(inPackages && /^\s*-\s/u.test(line))) {
      output.push(line);
    }
  }

  return `${output.join('\n').replace(/\n+$/u, '')}\n`;
}

export function collectSdkStandardViolations(workspaceRoot) {
  const violations = [];
  const families = discoverAllSdkFamiliesIncludingApps(workspaceRoot);

  for (const family of families) {
    if (!fs.existsSync(family.composedFacadePath)) {
      violations.push({
        kind: 'missing-composed-facade',
        file: family.composedFacadePath,
        message: `missing composed facade for ${family.consumerPackageName}`,
      });
    }
    if (!fs.existsSync(family.composedPackageJsonPath)) {
      violations.push({
        kind: 'missing-composed-package',
        file: family.composedPackageJsonPath,
        message: `missing composed package.json for ${family.consumerPackageName}`,
      });
    } else {
      const pkg = readJson(family.composedPackageJsonPath);
      if (pkg.name !== family.consumerPackageName) {
        violations.push({
          kind: 'composed-package-name',
          file: family.composedPackageJsonPath,
          message: `${pkg.name} must be ${family.consumerPackageName}`,
        });
      }
      if (pkg.exports?.['./generated']) {
        violations.push({
          kind: 'forbidden-generated-export',
          file: family.composedPackageJsonPath,
          message: 'consumer package must not export ./generated',
        });
      }
    }

    violations.push(...collectFamilyTransportViolations(family));

    if (fs.existsSync(family.manifestPath)) {
      const manifest = readJson(family.manifestPath);
      if (manifest.sdkFamily !== family.sdkFamilyStem) {
        violations.push({
          kind: 'manifest-sdk-family',
          file: family.manifestPath,
          message: `${manifest.sdkFamily} must be ${family.sdkFamilyStem}`,
        });
      }
      if (manifest.sdkName !== family.sdkFamilyStem) {
        violations.push({
          kind: 'manifest-sdk-name',
          file: family.manifestPath,
          message: `${manifest.sdkName} must be ${family.sdkFamilyStem}`,
        });
      }
      if (manifest.packageName !== family.consumerPackageName) {
        violations.push({
          kind: 'manifest-consumer-name',
          file: family.manifestPath,
          message: `${manifest.packageName} must be ${family.consumerPackageName}`,
        });
      }
      if (manifest.transportPackageName !== family.transportPackageName) {
        violations.push({
          kind: 'manifest-transport-name',
          file: family.manifestPath,
          message: `${manifest.transportPackageName} must be ${family.transportPackageName}`,
        });
      }
      for (const [field, expected] of Object.entries({
        composedRoot: family.composedRoot,
        composedEntry: family.composedEntry,
        transportRoot: family.transportRootRelative,
        transportEntry: family.transportEntry,
      })) {
        if (manifest.typescript?.[field] !== expected) {
          violations.push({
            kind: `manifest-typescript-${field.replace(/[A-Z]/gu, (token) => `-${token.toLowerCase()}`)}`,
            file: family.manifestPath,
            message: `${manifest.typescript?.[field]} must be ${expected}`,
          });
        }
      }
      if (!manifestHasOwnership(manifest, { hasTransport: fs.existsSync(family.transportPackageJsonPath) })) {
        const hasOpenApiInput = fs.existsSync(path.join(family.familyRoot, 'openapi'))
          && fs.readdirSync(path.join(family.familyRoot, 'openapi')).some((f) => /\.sdkgen\.(?:json|ya?ml)$/u.test(f));
        if (hasOpenApiInput || fs.existsSync(family.transportPackageJsonPath)) {
          violations.push({
            kind: 'missing-manifest-ownership',
            file: family.manifestPath,
            message: 'manifest must include sdkOwner, apiAuthority, and generationInputSpec or authoritySpec',
          });
        }
      }
    } else {
      violations.push({
        kind: 'missing-manifest',
        file: family.manifestPath,
        message: 'missing sdk-manifest.json',
      });
    }
  }

  violations.push(...collectParallelSdkRegistryViolations(workspaceRoot));

  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
    if (!fs.existsSync(workspacePath)) continue;
    for (const entry of parsePnpmWorkspacePackages(fs.readFileSync(workspacePath, 'utf8'))) {
      if (entry.includes('generated/server-openapi') || entry.includes('generated/domains/server-openapi')) {
        violations.push({
          kind: 'forbidden-workspace-transport',
          file: workspacePath,
          message: `remove workspace transport entry ${entry}`,
        });
      }
    }
  }

  return violations;
}

export function alignSdkStandard(workspaceRoot) {
  const changed = [];
  const families = discoverAllSdkFamiliesIncludingApps(workspaceRoot);

  for (const family of families) {
    for (const file of [
      ensureManifest(family),
      ensureComposedPackageJson(family),
      ensureComposedFacade(family),
      ...alignAllFamilyTransports(family),
    ]) {
      if (file) changed.push(file);
    }
  }

  changed.push(...materializeMissingComposedFacades(workspaceRoot));

  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    const file = alignPnpmWorkspace(repoRoot);
    if (file) changed.push(file);
  }

  return [...new Set(changed)];
}

export { inferSdkType };
