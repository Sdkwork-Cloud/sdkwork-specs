#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  CREDENTIAL_MODES,
  findCorePackages,
  isCompositionExemptRepo,
  listClientAppRoots,
  normalizeSdkDependencies,
  readJson,
  toPosix,
} from './lib/app-composition.mjs';

const EXCLUDED_PACKAGE_PATTERNS = [
  /^@sdkwork\/auth-/u,
  /^@sdkwork\/sdk-common$/u,
  /^@sdkwork\/utils$/u,
  /^@sdkwork\/iam-contracts$/u,
  /^@sdkwork\/iam-react$/u,
  /^@sdkwork\/iam-runtime$/u,
  /^@sdkwork-internal\//u,
  /-pc-/u,
  /-h5-/u,
  /-console-/u,
  /-admin-(?!core)/u,
  /-flutter-/u,
  /-mini-program-/u,
  /^sdkwork-[a-z0-9-]+-pc-/u,
  /^sdkwork-[a-z0-9-]+-h5-/u,
];

function parseArgs(argv) {
  const args = { root: process.cwd(), write: false, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--write') args.write = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function surfaceFromWorkspace(workspace) {
  if (/-backend-sdk$/u.test(workspace)) return 'backend-api';
  if (/-app-sdk$/u.test(workspace)) return 'app-api';
  return 'open-api';
}

function credentialModeForSurface(surface) {
  if (surface === 'backend-api') return 'authenticated-backend-admin';
  if (surface === 'app-api') return 'authenticated-app-api';
  return 'protected-open-api-flexible';
}

function packageNameToWorkspace(packageName) {
  const patterns = [
    [/^@sdkwork\/iam-app-sdk$/u, 'sdkwork-iam-app-sdk'],
    [/^@sdkwork\/iam-backend-sdk$/u, 'sdkwork-iam-backend-sdk'],
    [/^@sdkwork\/([a-z0-9-]+)-app-sdk$/u, (match) => `sdkwork-${match[1]}-app-sdk`],
    [/^@sdkwork\/([a-z0-9-]+)-backend-sdk$/u, (match) => `sdkwork-${match[1]}-backend-sdk`],
    [/^@sdkwork\/([a-z0-9-]+)-sdk$/u, (match) => `sdkwork-${match[1]}-sdk`],
    [/^@sdkwork\/([a-z0-9-]+)-sdk-typescript$/u, (match) => `sdkwork-${match[1]}-sdk-typescript`],
    [/^sdkwork-([a-z0-9-]+)-app-sdk-generated-typescript$/u, (match) => `sdkwork-${match[1]}-app-sdk`],
    [/^sdkwork-([a-z0-9-]+)-backend-sdk-generated-typescript$/u, (match) => `sdkwork-${match[1]}-backend-sdk`],
    [/^sdkwork-([a-z0-9-]+)-sdk-generated-typescript$/u, (match) => `sdkwork-${match[1]}-sdk`],
  ];

  for (const [pattern, workspace] of patterns) {
    const match = packageName.match(pattern);
    if (!match) continue;
    return typeof workspace === 'function' ? workspace(match) : workspace;
  }
  return null;
}

function isExcludedPackage(packageName) {
  return EXCLUDED_PACKAGE_PATTERNS.some((pattern) => pattern.test(packageName));
}

function inferOwnAppSdkWorkspace(repoRoot) {
  const repoName = path.basename(repoRoot);
  const domain = repoName.replace(/^sdkwork-/u, '');
  const candidates = [
    `sdkwork-${domain}-app-sdk`,
    `${domain}-app-sdk`,
    `sdkwork-${domain}-sdk`,
    `${domain}-open-sdk`,
    `${domain}-app-sdk`,
  ];
  for (const workspace of candidates) {
    if (fs.existsSync(path.join(repoRoot, 'sdks', workspace))) {
      return workspace;
    }
  }

  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sdksDir = path.join(appsDir, entry.name, 'sdks');
      if (!fs.existsSync(sdksDir)) continue;
      for (const sdkEntry of fs.readdirSync(sdksDir, { withFileTypes: true })) {
        if (!sdkEntry.isDirectory()) continue;
        const name = sdkEntry.name;
        if (/^sdkwork-[a-z0-9-]+-(?:app|backend)-sdk$/u.test(name)) return name;
        if (/^sdkwork-[a-z0-9-]+-sdk-typescript$/u.test(name)) return name;
      }
    }
  }

  for (const workspace of inferSdkWorkspacesFromRouteManifest(repoRoot)) {
    return workspace;
  }

  if (listClientAppRoots(repoRoot).length > 0) {
    return `sdkwork-${domain}-app-sdk`;
  }

  return null;
}

function inferSdkWorkspacesFromRouteManifest(repoRoot) {
  const repoSpec = readJsonIfExists(path.join(repoRoot, 'specs/component.spec.json'));
  const manifestPath = repoSpec?.contracts?.routeManifest;
  if (!manifestPath || typeof manifestPath !== 'string') return [];

  const fileName = path.basename(manifestPath);
  const patterns = [
    /^sdkwork-([a-z0-9-]+)-standalone-gateway\.route-manifest\.json$/u,
    /^sdkwork-routes-([a-z0-9-]+)-app-api\.route-manifest\.json$/u,
  ];
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) return [`sdkwork-${match[1]}-app-sdk`];
  }
  return [];
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function filterWorkspacesForCoreSurface(workspaces, coreSurface) {
  return workspaces.filter((workspace) => {
    const surface = surfaceFromWorkspace(workspace);
    if (coreSurface === 'backend-admin' && surface !== 'backend-api') return false;
    if (coreSurface !== 'backend-admin' && surface === 'backend-api') return false;
    return true;
  });
}

function workspaceFromLooseIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return null;
  if (identifier.startsWith('sdkwork-')) return identifier;
  return packageNameToWorkspace(identifier);
}

function inferSdkWorkspacesFromText(text, coreSurface) {
  const workspaces = new Set();
  for (const match of text.matchAll(/(?:packageName|family|workspace|sdkFamily):\s*["']([^"']+)["']/gu)) {
    const workspace = workspaceFromLooseIdentifier(match[1]);
    if (!workspace) continue;
    for (const item of filterWorkspacesForCoreSurface([workspace], coreSurface)) {
      workspaces.add(item);
    }
  }
  return [...workspaces].sort();
}

function inferSdkWorkspacesFromSdkInventory(packageDir, coreSurface) {
  const inventoryPath = path.join(packageDir, 'src/composition/sdk-inventory.ts');
  const workspaces = new Set();
  if (fs.existsSync(inventoryPath)) {
    for (const workspace of inferSdkWorkspacesFromText(fs.readFileSync(inventoryPath, 'utf8'), coreSurface)) {
      workspaces.add(workspace);
    }
  }

  const indexPath = path.join(packageDir, 'src/index.ts');
  if (fs.existsSync(indexPath)) {
    for (const workspace of inferSdkWorkspacesFromText(fs.readFileSync(indexPath, 'utf8'), coreSurface)) {
      workspaces.add(workspace);
    }
  }

  return [...workspaces].sort();
}

function inferSdkWorkspacesFromRepoComponentSpec(repoRoot, coreSurface) {
  const repoSpec = readJsonIfExists(path.join(repoRoot, 'specs/component.spec.json'));
  if (!repoSpec) return [];

  const workspaces = new Set();
  for (const dep of normalizeSdkDependencies(repoSpec)) {
    for (const workspace of filterWorkspacesForCoreSurface([dep.workspace], coreSurface)) {
      workspaces.add(workspace);
    }
  }

  for (const client of repoSpec.contracts?.sdkClients ?? []) {
    const workspace = workspaceFromLooseIdentifier(
      typeof client === 'string' ? client : client.packageName ?? client.workspace ?? client.sdkFamily,
    );
    if (!workspace) continue;
    for (const item of filterWorkspacesForCoreSurface([workspace], coreSurface)) {
      workspaces.add(item);
    }
  }

  for (const workspace of inferSdkWorkspacesFromRouteManifest(repoRoot)) {
    for (const item of filterWorkspacesForCoreSurface([workspace], coreSurface)) {
      workspaces.add(item);
    }
  }

  return [...workspaces].sort();
}

function bootstrapMinimalComponentSpec(core, repoRoot, options = {}) {
  const repoName = path.basename(repoRoot);
  const domain = repoName.replace(/^sdkwork-/u, '');
  const packageJson = core.packageJson ?? readJsonIfExists(path.join(core.packageDir, 'package.json'));
  const componentName = packageJson?.name ?? core.componentName;
  const relRoot = toPosix(path.relative(repoRoot, core.packageDir));

  const spec = {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: componentName,
      type: 'typescript-package',
      root: relRoot,
      domain,
      capability: core.surface === 'backend-admin' ? 'admin-core' : 'core',
      surface: core.surface === 'backend-admin' ? 'backend-admin' : core.surface === 'console' ? 'console' : 'app',
      languages: ['typescript'],
      generated: false,
    },
    contracts: {
      sdkDependencies: [],
      dependencyApiExports: [],
      dependencyApiSurfaces: [],
    },
  };

  if (options.compositionExempt) {
    spec.composition = { consumerIntegrationsExempt: true };
  }

  return spec;
}

const IAM_TRIGGER_PACKAGES = new Set([
  '@sdkwork/appbase-pc-react',
  '@sdkwork/iam-react',
  '@sdkwork/iam-runtime',
]);

function inferSdkWorkspacesFromPackageJson(packageJson, coreSurface) {
  const workspaces = new Set();
  const dependencyNames = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ];

  for (const packageName of dependencyNames) {
    if (isExcludedPackage(packageName)) continue;
    const workspace = packageNameToWorkspace(packageName);
    if (!workspace) continue;
    const surface = surfaceFromWorkspace(workspace);
    if (coreSurface === 'backend-admin' && surface !== 'backend-api') continue;
    if (coreSurface !== 'backend-admin' && surface === 'backend-api') continue;
    workspaces.add(workspace);
  }

  return [...workspaces].sort();
}

function inferSdkWorkspacesFromAppPackages(appRoot, coreSurface) {
  const packagesDir = path.join(appRoot, 'packages');
  if (!fs.existsSync(packagesDir)) return [];

  const workspaces = new Set();
  let requiresIam = false;
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageJsonPath = path.join(packagesDir, entry.name, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;
    const packageJson = readJson(packageJsonPath);
    for (const workspace of inferSdkWorkspacesFromPackageJson(packageJson, coreSurface)) {
      workspaces.add(workspace);
    }
    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.peerDependencies ?? {}),
    ];
    if (dependencyNames.some((name) => IAM_TRIGGER_PACKAGES.has(name))) {
      requiresIam = true;
    }
  }

  if (requiresIam && coreSurface !== 'backend-admin') {
    workspaces.add('sdkwork-iam-app-sdk');
  }

  return [...workspaces].sort();
}

function normalizeExistingSdkDependencies(componentSpec) {
  return normalizeSdkDependencies(componentSpec).map((item) => ({
    workspace: item.workspace,
    surface: item.surface ?? surfaceFromWorkspace(item.workspace),
    credentialMode: item.credentialMode ?? credentialModeForSurface(item.surface ?? surfaceFromWorkspace(item.workspace)),
  }));
}

function mergeSdkDependencies(existing, inferred) {
  const merged = [...existing];
  const seen = new Set(existing.map((entry) => entry.workspace));
  for (const workspace of inferred) {
    if (seen.has(workspace)) continue;
    const surface = surfaceFromWorkspace(workspace);
    merged.push({
      workspace,
      surface,
      credentialMode: credentialModeForSurface(surface),
    });
    seen.add(workspace);
  }
  return merged.sort((a, b) => a.workspace.localeCompare(b.workspace));
}

export function alignCoreSdkDependencies(repoRoot, options = {}) {
  const changes = [];
  const ownAppSdk = inferOwnAppSdkWorkspace(repoRoot);
  const compositionExempt = isCompositionExemptRepo(repoRoot);

  for (const clientRoot of listClientAppRoots(repoRoot)) {
    for (const core of findCorePackages(clientRoot.appRoot)) {
      const componentSpecPath = path.join(core.packageDir, 'specs/component.spec.json');
      const packageJsonPath = path.join(core.packageDir, 'package.json');
      if (!fs.existsSync(packageJsonPath)) continue;

      const packageJson = readJson(packageJsonPath);
      let bootstrapped = false;
      let componentSpec = readJsonIfExists(componentSpecPath);
      if (!componentSpec) {
        componentSpec = bootstrapMinimalComponentSpec(
          { ...core, packageJson },
          repoRoot,
          { compositionExempt },
        );
        bootstrapped = true;
      }

      const existing = normalizeExistingSdkDependencies(componentSpec);
      let inferred = [
        ...inferSdkWorkspacesFromPackageJson(packageJson, core.surface),
        ...inferSdkWorkspacesFromSdkInventory(core.packageDir, core.surface),
        ...inferSdkWorkspacesFromRepoComponentSpec(repoRoot, core.surface),
        ...inferSdkWorkspacesFromAppPackages(clientRoot.appRoot, core.surface),
      ];
      inferred = [...new Set(inferred)].sort();

      if (ownAppSdk && core.surface !== 'backend-admin' && !compositionExempt) {
        const ownSurface = surfaceFromWorkspace(ownAppSdk);
        if (core.surface !== 'backend-admin' || ownSurface === 'backend-api') {
          inferred = [...new Set([ownAppSdk, ...inferred])];
        }
      }

      const merged = compositionExempt
        ? []
        : mergeSdkDependencies(existing, inferred);
      const compositionBlock = compositionExempt
        ? { consumerIntegrationsExempt: true }
        : componentSpec.composition;
      const compositionChanged = compositionExempt
        && componentSpec.composition?.consumerIntegrationsExempt !== true;
      const depsChanged = merged.length !== existing.length
        || !merged.every((entry, index) => entry.workspace === existing[index]?.workspace);

      if (!bootstrapped && !depsChanged && !compositionChanged) {
        continue;
      }

      for (const entry of merged) {
        if (!CREDENTIAL_MODES.has(entry.credentialMode)) {
          throw new Error(`invalid credentialMode ${entry.credentialMode} for ${entry.workspace}`);
        }
      }

      const nextSpec = {
        ...componentSpec,
        ...(compositionBlock ? { composition: compositionBlock } : {}),
        contracts: {
          ...componentSpec.contracts,
          sdkDependencies: merged,
        },
      };

      const relPath = toPosix(path.relative(repoRoot, componentSpecPath));
      changes.push({
        path: componentSpecPath,
        relPath,
        corePackage: core.componentName,
        before: existing.length,
        after: merged.length,
        bootstrapped,
        added: merged.filter((entry) => !existing.some((item) => item.workspace === entry.workspace)).map((entry) => entry.workspace),
      });

      if (options.write) {
        fs.mkdirSync(path.dirname(componentSpecPath), { recursive: true });
        fs.writeFileSync(componentSpecPath, `${JSON.stringify(nextSpec, null, 2)}\n`);
      }
    }
  }

  return changes;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node tools/align-composition-sdk-dependencies.mjs --root <repo> [--write] [--dry-run]`);
    process.exit(0);
  }

  const changes = alignCoreSdkDependencies(args.root, { write: args.write && !args.dryRun });
  if (changes.length === 0) {
    console.log(`No sdkDependencies alignment changes for ${path.basename(args.root)}`);
    return;
  }

  for (const change of changes) {
    const prefix = change.bootstrapped ? '[bootstrap] ' : '';
    console.log(`${prefix}${change.relPath}: ${change.before} -> ${change.after} (+${change.added.join(', ') || 'normalized'})`);
  }

  if (args.dryRun && !args.write) {
    console.log('Dry run only; re-run with --write to apply.');
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
