/**
 * Merge per-family `.sdkwork-assembly.json` into `sdk-manifest.json` (SSOT).
 * See SDK_MANIFEST_SPEC.md and SDK_PACKAGE_NAMING_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';

import { listWorkspaceRepos } from './app-sdk-consumer-import-patterns.mjs';
import {
  resolveConsumerPackageName,
  resolveTransportPackageName,
} from './sdk-family-discovery.mjs';

const ASSEMBLY_OWNERSHIP_KEYS = [
  'workspace',
  'title',
  'apiVersion',
  'openapiVersion',
  'authoritySpec',
  'generationInputSpec',
  'openApiPath',
  'derivedSpecs',
  'sdkOwner',
  'apiAuthority',
  'discoverySurface',
  'sdkDependencies',
  'metadata',
  'standardProfile',
  'surface',
  'domain',
  'capability',
  'protoVersion',
  'rpcManifest',
  'httpFamilyMapping',
  'inspectionPolicy',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isScopedConsumerName(value) {
  return typeof value === 'string' && value.startsWith('@sdkwork/');
}

function normalizeTypescriptLanguageEntry(entry, sdkFamilyStem, consumerPackageName) {
  if (entry.language !== 'typescript') return entry;
  const consumer = entry.consumerPackageName
    ?? (isScopedConsumerName(entry.name) ? entry.name : consumerPackageName);
  const transport = entry.transportPackageName
    ?? resolveTransportPackageName(sdkFamilyStem);
  const next = { ...entry };
  next.consumerPackageName = consumer;
  next.transportPackageName = transport;
  if (isScopedConsumerName(next.name)) {
    delete next.name;
  }
  return next;
}

export function mergeAssemblyIntoManifest(manifest, assembly, sdkFamilyStem) {
  if (!assembly || typeof assembly !== 'object') return manifest;
  const next = { ...manifest };
  const consumerPackageName = next.packageName ?? resolveConsumerPackageName(sdkFamilyStem);

  for (const key of ASSEMBLY_OWNERSHIP_KEYS) {
    if (assembly[key] !== undefined) {
      next[key] = assembly[key];
    }
  }

  if (assembly.openApiPath && !next.generationInputSpec && !next.authoritySpec) {
    next.authoritySpec = assembly.openApiPath;
  }

  const catalogKeys = new Set([
    ...ASSEMBLY_OWNERSHIP_KEYS,
    'languages',
    'sdkDependencies',
    'schemaVersion',
    'sdkFamily',
    'sdkName',
    'packageName',
    'transportPackageName',
    'consumerPackageName',
  ]);
  const providerStandard = { ...(next.metadata?.providerStandard ?? {}) };
  for (const [key, value] of Object.entries(assembly)) {
    if (catalogKeys.has(key)) continue;
    if (next[key] !== undefined) continue;
    providerStandard[key] = value;
  }
  if (Object.keys(providerStandard).length > 0) {
    next.metadata = { ...(next.metadata ?? {}), providerStandard };
  }

  if (Array.isArray(assembly.languages) && !Array.isArray(next.languages)) {
    next.languages = assembly.languages.map((entry) =>
      normalizeTypescriptLanguageEntry(entry, sdkFamilyStem, consumerPackageName),
    );
  } else if (Array.isArray(assembly.languages) && Array.isArray(next.languages)) {
    next.languages = next.languages.map((entry, index) => {
      const source = assembly.languages[index] ?? assembly.languages.find((e) => e.language === entry.language);
      if (!source) return normalizeTypescriptLanguageEntry(entry, sdkFamilyStem, consumerPackageName);
      return normalizeTypescriptLanguageEntry(
        { ...source, ...entry },
        sdkFamilyStem,
        consumerPackageName,
      );
    });
  }

  if (Array.isArray(assembly.sdkDependencies) && !Array.isArray(next.sdkDependencies)) {
    next.sdkDependencies = assembly.sdkDependencies;
  }

  if (assembly.discoverySurface && !next.discoverySurface) {
    next.discoverySurface = assembly.discoverySurface;
  }

  next.schemaVersion = next.schemaVersion ?? 1;
  return next;
}

export function familyAssemblyPath(familyRoot) {
  return path.join(familyRoot, '.sdkwork-assembly.json');
}

export function isRepoLevelAssemblyPath(assemblyPath) {
  const base = path.basename(path.dirname(assemblyPath));
  return base === 'sdks';
}

export function mergeFamilyManifestFromAssembly(familyRoot, sdkFamilyStem, manifest) {
  const assemblyPath = familyAssemblyPath(familyRoot);
  if (!fs.existsSync(assemblyPath) || isRepoLevelAssemblyPath(assemblyPath)) {
    return { manifest, assemblyPath: null, merged: false };
  }
  const assembly = readJson(assemblyPath);
  const merged = mergeAssemblyIntoManifest(manifest, assembly, sdkFamilyStem);
  return { manifest: merged, assemblyPath, merged: true };
}

export function inferApiAuthority(sdkFamilyStem) {
  const sdkworkMatch = sdkFamilyStem.match(/^(sdkwork-[a-z0-9-]+)-(app|backend|internal)-sdk$/u);
  if (sdkworkMatch) return `${sdkworkMatch[1]}-${sdkworkMatch[2]}-api`;
  const clawMatch = sdkFamilyStem.match(/^(clawrouter)-(app|backend|open)-sdk$/u);
  if (clawMatch) return `${clawMatch[1]}-${clawMatch[2]}-api`;
  if (sdkFamilyStem.endsWith('-sdk')) {
    return `${sdkFamilyStem.slice(0, -4)}-api`;
  }
  return null;
}

export function inferSdkOwner(repoRoot, sdkFamilyStem) {
  const repoName = path.basename(repoRoot);
  if (repoName.startsWith('sdkwork-') || repoName.startsWith('clawrouter')) return repoName;
  const sdkworkStem = sdkFamilyStem.match(/^(sdkwork-[a-z0-9-]+)-/u)?.[1];
  if (sdkworkStem) return sdkworkStem;
  if (sdkFamilyStem.startsWith('clawrouter-')) return 'sdkwork-clawrouter';
  return null;
}

export function inferGenerationInputSpec(familyRoot) {
  const openapiDir = path.join(familyRoot, 'openapi');
  if (!fs.existsSync(openapiDir)) return null;
  const sdkgen = fs.readdirSync(openapiDir)
    .filter((entry) => /\.sdkgen\.(?:json|ya?ml)$/u.test(entry))
    .sort()[0];
  return sdkgen ? `openapi/${sdkgen}` : null;
}

export function inferManifestOwnership(familyRoot, sdkFamilyStem, manifest, repoRoot) {
  const next = { ...manifest };
  if (!next.sdkOwner) next.sdkOwner = inferSdkOwner(repoRoot, sdkFamilyStem);
  if (!next.apiAuthority) next.apiAuthority = inferApiAuthority(sdkFamilyStem);
  if (!next.generationInputSpec && !next.authoritySpec) {
    const inferred = inferGenerationInputSpec(familyRoot);
    if (inferred) next.generationInputSpec = inferred;
  }
  if (!Array.isArray(next.sdkDependencies)) next.sdkDependencies = [];
  return next;
}

export function manifestHasOwnership(manifest, { hasTransport = false } = {}) {
  const hasOwner = Boolean(manifest?.sdkOwner && manifest?.apiAuthority);
  const hasHttpInput = Boolean(
    manifest?.generationInputSpec
    || manifest?.authoritySpec
    || manifest?.openApiPath,
  );
  const hasRpcInput = Boolean(
    manifest?.rpcManifest
    || manifest?.discoverySurface?.protoRoot
    || manifest?.discoverySurface?.generatedProtocols?.includes('rpc'),
  );
  const hasProviderStandard = Boolean(
    manifest?.architecture
    || manifest?.metadata?.providerStandard
    || (Array.isArray(manifest?.languages) && manifest.languages.length > 0),
  );
  if (hasOwner && (hasHttpInput || hasRpcInput || hasProviderStandard)) return true;
  if (hasOwner && hasTransport) return true;
  return false;
}

export function retirePerFamilyAssembly(familyRoot, { dryRun = false } = {}) {
  const assemblyPath = familyAssemblyPath(familyRoot);
  if (!fs.existsSync(assemblyPath) || isRepoLevelAssemblyPath(assemblyPath)) {
    return null;
  }
  if (!dryRun) fs.unlinkSync(assemblyPath);
  return assemblyPath;
}

export function alignFamilyManifestFromAssembly(family, { retireAssembly = false, dryRun = false } = {}) {
  const manifestPath = family.manifestPath;
  let manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : { schemaVersion: 1 };

  const { manifest: merged, assemblyPath, merged: didMerge } = mergeFamilyManifestFromAssembly(
    family.familyRoot,
    family.sdkFamilyStem,
    manifest,
  );

  manifest = inferManifestOwnership(family.familyRoot, family.sdkFamilyStem, merged, family.repoRoot);

  if (!dryRun) writeJson(manifestPath, manifest);

  let retired = null;
  if (retireAssembly && assemblyPath && manifestHasOwnership(manifest)) {
    retired = retirePerFamilyAssembly(family.familyRoot, { dryRun });
  }

  return retired ?? (didMerge ? manifestPath : null);
}

function collectSdksRoots(repoRoot) {
  const roots = [];
  const repoSdks = path.join(repoRoot, 'sdks');
  if (fs.existsSync(repoSdks)) roots.push(repoSdks);
  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!app.isDirectory()) continue;
      const nested = path.join(appsDir, app.name, 'sdks');
      if (fs.existsSync(nested)) roots.push(nested);
    }
  }
  findNestedSdksDirectories(repoRoot, repoRoot, 0, roots);
  return [...new Set(roots)];
}

function findNestedSdksDirectories(repoRoot, dir, depth, roots) {
  if (depth > 10) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (['node_modules', '.git', 'target', 'dist', '.turbo', '.runtime'].includes(entry.name)) continue;
    const next = path.join(dir, entry.name);
    if (entry.name === 'sdks' && next !== path.join(repoRoot, 'sdks')) {
      roots.push(next);
    }
    findNestedSdksDirectories(repoRoot, next, depth + 1, roots);
  }
}

function enumerateFamilyAssemblies(sdksRoot, repoRoot, out, depth = 0) {
  if (depth > 8 || !fs.existsSync(sdksRoot)) return;
  for (const entry of fs.readdirSync(sdksRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const familyRoot = path.join(sdksRoot, entry.name);
    const assemblyPath = path.join(familyRoot, '.sdkwork-assembly.json');
    if (fs.existsSync(assemblyPath) && !isRepoLevelAssemblyPath(assemblyPath)) {
      out.push({
        repoRoot,
        familyRoot,
        sdkFamilyStem: entry.name,
        assemblyPath,
        manifestPath: path.join(familyRoot, 'sdk-manifest.json'),
      });
    }
    enumerateFamilyAssemblies(familyRoot, repoRoot, out, depth + 1);
  }
}

export function discoverPerFamilyAssemblyPaths(workspaceRoot) {
  const out = [];
  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    for (const sdksRoot of collectSdksRoots(repoRoot)) {
      enumerateFamilyAssemblies(sdksRoot, repoRoot, out);
    }
  }
  return out.sort((a, b) => a.assemblyPath.localeCompare(b.assemblyPath));
}

export function alignLegacyAssemblyFamily(record, { retireAssembly = true, dryRun = false } = {}) {
  const { repoRoot, familyRoot, sdkFamilyStem, manifestPath } = record;
  let manifest = fs.existsSync(manifestPath)
    ? readJson(manifestPath)
    : { schemaVersion: 1 };

  const { manifest: merged, assemblyPath, merged: didMerge } = mergeFamilyManifestFromAssembly(
    familyRoot,
    sdkFamilyStem,
    manifest,
  );
  manifest = inferManifestOwnership(familyRoot, sdkFamilyStem, merged, repoRoot);
  manifest.schemaVersion = manifest.schemaVersion ?? 1;
  manifest.sdkFamily = manifest.sdkFamily ?? sdkFamilyStem;
  manifest.sdkName = manifest.sdkName ?? sdkFamilyStem;
  manifest.packageName = manifest.packageName ?? resolveConsumerPackageName(sdkFamilyStem);
  manifest.transportPackageName = manifest.transportPackageName
    ?? resolveTransportPackageName(sdkFamilyStem);

  if (!dryRun) writeJson(manifestPath, manifest);

  let retired = null;
  if (retireAssembly && assemblyPath && manifestHasOwnership(manifest)) {
    retired = retirePerFamilyAssembly(familyRoot, { dryRun });
    if (retired && !dryRun && Array.isArray(manifest.languages)) {
      let languagesChanged = false;
      manifest.languages = manifest.languages.map((entry) => {
        if (!entry?.inspection?.requiredEvidence) return entry;
        const evidence = entry.inspection.requiredEvidence.map((item) =>
          item === '../.sdkwork-assembly.json' ? '../sdk-manifest.json' : item,
        );
        languagesChanged = true;
        return {
          ...entry,
          inspection: { ...entry.inspection, requiredEvidence: evidence },
        };
      });
      if (languagesChanged) writeJson(manifestPath, manifest);
    }
  }

  return {
    changed: didMerge ? manifestPath : null,
    retired,
    manifestPath,
  };
}

export function alignAllLegacyAssemblyFamilies(workspaceRoot, options = {}) {
  const changed = [];
  for (const record of discoverPerFamilyAssemblyPaths(workspaceRoot)) {
    const result = alignLegacyAssemblyFamily(record, options);
    if (result.changed) changed.push(result.changed);
    if (result.retired) changed.push(result.retired);
  }
  return [...new Set(changed)];
}

export function collectLegacyAssemblyViolations(workspaceRoot) {
  const violations = [];
  for (const record of discoverPerFamilyAssemblyPaths(workspaceRoot)) {
    violations.push({
      kind: 'legacy-per-family-assembly',
      file: record.assemblyPath,
      message: 'retire per-family .sdkwork-assembly.json; use sdk-manifest.json as SSOT (run check-sdk-standard --fix)',
    });
  }
  return violations;
}

export function loadDiscoverySurfaceFromFamilyMetadata(repoRoot, workspace) {
  const candidates = [
    path.join(repoRoot, 'sdks', workspace, 'sdk-manifest.json'),
    path.join(repoRoot, 'sdks', workspace, '.sdkwork-assembly.json'),
  ];

  for (const app of fs.existsSync(path.join(repoRoot, 'apps'))
    ? fs.readdirSync(path.join(repoRoot, 'apps'), { withFileTypes: true }).filter((e) => e.isDirectory())
    : []) {
    candidates.push(path.join(repoRoot, 'apps', app.name, 'sdks', workspace, 'sdk-manifest.json'));
    candidates.push(path.join(repoRoot, 'apps', app.name, 'sdks', workspace, '.sdkwork-assembly.json'));
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const doc = readJson(candidate);
    if (doc?.discoverySurface) return doc.discoverySurface;
  }
  return null;
}

export function loadDiscoverySurfaceForWorkspaceConsumer(repoRoot, workspace) {
  const domain = workspace.match(/^sdkwork-([^-]+)-(?:app|backend)-sdk$/u)?.[1]
    ?? workspace.match(/^sdkwork-([^-]+)-sdk$/u)?.[1];
  if (domain) {
    const siblingRoot = path.resolve(repoRoot, '..', `sdkwork-${domain}`);
    if (fs.existsSync(path.join(siblingRoot, 'specs', 'component.spec.json'))) {
      const discovery = loadDiscoverySurfaceFromFamilyMetadata(siblingRoot, workspace);
      if (discovery) return discovery;
    }
    if (domain === 'iam' || domain === 'appbase') {
      const iamRoot = path.resolve(repoRoot, '..', 'sdkwork-iam');
      if (fs.existsSync(path.join(iamRoot, 'specs', 'component.spec.json'))) {
        const discovery = loadDiscoverySurfaceFromFamilyMetadata(iamRoot, workspace);
        if (discovery) return discovery;
      }
    }
  }
  return loadDiscoverySurfaceFromFamilyMetadata(repoRoot, workspace);
}
