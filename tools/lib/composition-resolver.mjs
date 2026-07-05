#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import {
  findCorePackages,
  isCompositionConsumerExempt,
  isCompositionExemptRepo,
  listClientAppRoots,
  normalizeSdkDependencies,
  readJson,
  toPosix,
} from './app-composition.mjs';
import { loadDiscoverySurfaceForWorkspaceConsumer } from './sdk-manifest-assembly.mjs';

const APP_API_PREFIX = '/app/v3/api';
const BACKEND_API_PREFIX = '/backend/v3/api';

const PLATFORM_GATEWAY_DOMAINS = new Set(['iam', 'appbase']);

export const RUNTIME_MODES = new Set([
  'same-origin-embedded',
  'external-via-platform-gateway',
  'external-via-declared-upstream',
]);

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function domainFromSdkWorkspace(workspace) {
  const match = String(workspace).match(/^sdkwork-([^-]+)-(?:app|backend)-sdk$/u);
  if (match) return match[1];
  const openMatch = String(workspace).match(/^sdkwork-([^-]+)-sdk$/u);
  if (openMatch) return openMatch[1];
  return null;
}

function surfaceFromWorkspace(workspace) {
  if (/-backend-sdk$/u.test(workspace)) return 'backend-api';
  if (/-app-sdk$/u.test(workspace)) return 'app-api';
  return 'open-api';
}

function defaultCredentialMode(surface) {
  if (surface === 'backend-api') return 'authenticated-backend-admin';
  if (surface === 'app-api') return 'authenticated-app-api';
  return 'protected-open-api-flexible';
}

function defaultPrefix(surface, assemblyDiscovery) {
  if (assemblyDiscovery?.apiPrefix) return assemblyDiscovery.apiPrefix;
  if (surface === 'backend-api') return BACKEND_API_PREFIX;
  if (surface === 'app-api') return APP_API_PREFIX;
  return null;
}

function defaultConnectivityPlane(domain, surface) {
  if (domain && PLATFORM_GATEWAY_DOMAINS.has(domain) && surface !== 'open-api') {
    return 'platform';
  }
  return 'application';
}

function findSiblingRepoRoot(repoRoot, domain) {
  const candidate = path.resolve(repoRoot, '..', `sdkwork-${domain}`);
  if (fs.existsSync(path.join(candidate, 'specs', 'component.spec.json'))) {
    return candidate;
  }
  if (domain === 'iam' || domain === 'appbase') {
    const iamRoot = path.resolve(repoRoot, '..', 'sdkwork-iam');
    if (fs.existsSync(path.join(iamRoot, 'specs', 'component.spec.json'))) {
      return iamRoot;
    }
  }
  return null;
}

function loadAssemblyDiscovery(repoRoot, workspace) {
  return loadDiscoverySurfaceForWorkspaceConsumer(repoRoot, workspace);
}

function loadDependencyIntegration(repoRoot, workspace) {
  const domain = domainFromSdkWorkspace(workspace);
  if (!domain) return null;
  const siblingRoot = findSiblingRepoRoot(repoRoot, domain);
  if (!siblingRoot) return null;
  const componentSpec = readJsonIfExists(path.join(siblingRoot, 'specs', 'component.spec.json'));
  return componentSpec?.integration ?? null;
}

function loadLegacyDependencySurface(repoRoot, workspace) {
  const manifestPath = path.join(repoRoot, 'specs', 'dependency-api-surfaces.json');
  const manifest = readJsonIfExists(manifestPath);
  if (!manifest?.dependencies) return null;
  return manifest.dependencies.find((entry) => entry.workspace === workspace) ?? null;
}

function resolvePermissionManifestRef(repoRoot, workspace, dependencyIntegration) {
  if (dependencyIntegration?.permissionManifest) {
    const domain = domainFromSdkWorkspace(workspace);
    const siblingRoot = domain ? findSiblingRepoRoot(repoRoot, domain) : null;
    if (siblingRoot) {
      return toPosix(path.relative(repoRoot, path.join(siblingRoot, dependencyIntegration.permissionManifest)));
    }
    return dependencyIntegration.permissionManifest;
  }

  const domain = domainFromSdkWorkspace(workspace);
  if (!domain) return null;
  const siblingRoot = findSiblingRepoRoot(repoRoot, domain);
  if (!siblingRoot) return null;

  const candidates = [
    path.join(siblingRoot, 'specs', 'iam.module.manifest.json'),
    path.join(siblingRoot, 'iam', 'modules', 'iam-kernel', 'iam.module.manifest.json'),
    path.join(siblingRoot, 'iam', 'modules', domain, 'iam.module.manifest.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return toPosix(path.relative(repoRoot, candidate));
    }
  }
  return null;
}

function mapLegacyRuntimeMode(legacySurface) {
  const runtime = legacySurface?.runtimeIntegration;
  if (!runtime) return null;
  if (runtime.mode === 'same-origin-mounted') return 'same-origin-embedded';
  if (runtime.mode === 'external-service') return 'external-via-platform-gateway';
  return null;
}

function resolveRuntimeMode({
  dependencyIntegration,
  legacySurface,
  connectivityPlane,
}) {
  const override = dependencyIntegration?.defaultRuntimeMode;
  if (override === 'platform-gateway') return 'external-via-platform-gateway';
  if (override === 'same-origin-embedded') return 'same-origin-embedded';

  const legacyMode = mapLegacyRuntimeMode(legacySurface);
  if (legacyMode) {
    const mountStatus = legacySurface?.runtimeIntegration?.mountCoverage?.status;
    if (legacyMode === 'same-origin-embedded' && mountStatus !== 'verified') {
      return 'external-via-platform-gateway';
    }
    return legacyMode;
  }

  if (connectivityPlane === 'platform') return 'external-via-platform-gateway';
  return 'same-origin-embedded';
}

function baseUrlEnvKey(workspace) {
  const domain = domainFromSdkWorkspace(workspace);
  const surface = surfaceFromWorkspace(workspace);
  if (!domain) return null;
  const domainKey = domain === 'iam' ? 'APPBASE' : domain.toUpperCase().replace(/-/g, '_');
  if (surface === 'backend-api') return `VITE_SDKWORK_${domainKey}_BACKEND_API_BASE_URL`;
  if (surface === 'app-api') return `VITE_SDKWORK_${domainKey}_APP_API_BASE_URL`;
  return `VITE_SDKWORK_${domainKey}_OPEN_API_BASE_URL`;
}

function collectConsumerSdkDependencies(repoRoot) {
  const entries = [];
  for (const clientRoot of listClientAppRoots(repoRoot)) {
    for (const core of findCorePackages(clientRoot.appRoot)) {
      for (const dep of normalizeSdkDependencies(core.componentSpec)) {
        entries.push({
          ...dep,
          corePackage: core.componentName,
          coreSurface: core.surface,
          source: toPosix(path.relative(repoRoot, core.componentSpecPath)),
        });
      }
    }
  }

  const repoComponent = readJsonIfExists(path.join(repoRoot, 'specs', 'component.spec.json'));
  if (repoComponent) {
    for (const dep of normalizeSdkDependencies(repoComponent)) {
      entries.push({
        ...dep,
        corePackage: repoComponent.component?.name ?? 'repository-root',
        coreSurface: 'repository',
        source: 'specs/component.spec.json',
      });
    }
  }

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.workspace}:${entry.corePackage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function loadCompositionOverrides(repoRoot) {
  const overrides = {};
  for (const clientRoot of listClientAppRoots(repoRoot)) {
    for (const core of findCorePackages(clientRoot.appRoot)) {
      const composition = core.componentSpec?.contracts?.composition;
      if (!composition?.overrides) continue;
      overrides[core.componentName] = composition.overrides;
    }
  }
  const repoComponent = readJsonIfExists(path.join(repoRoot, 'specs', 'component.spec.json'));
  if (repoComponent?.contracts?.composition?.overrides) {
    overrides['repository-root'] = repoComponent.contracts.composition.overrides;
  }
  return overrides;
}

function findIntegrationOverride(overridesByCore, workspace) {
  for (const overrides of Object.values(overridesByCore)) {
    const integration = overrides?.integrations?.[workspace];
    if (integration) return integration;
  }
  return null;
}

export function resolveComposition(repoRoot, options = {}) {
  const issues = [];
  const integrations = [];
  const inheritedManifests = [];
  const env = {};
  let requiresPlatformGatewayProcess = false;

  const sdkDependencies = collectConsumerSdkDependencies(repoRoot);
  const overridesByCore = loadCompositionOverrides(repoRoot);

  for (const dep of sdkDependencies) {
    const workspace = dep.workspace;
    const assemblyDiscovery = loadAssemblyDiscovery(repoRoot, workspace);
    const dependencyIntegration = loadDependencyIntegration(repoRoot, workspace);
    const legacySurface = loadLegacyDependencySurface(repoRoot, workspace);
    const integrationOverride = findIntegrationOverride(overridesByCore, workspace);

    const surface = dep.surface ?? surfaceFromWorkspace(workspace);
    const domain = domainFromSdkWorkspace(workspace);
    const apiPrefix = defaultPrefix(surface, assemblyDiscovery);
    const connectivityPlane = dependencyIntegration?.defaultConnectivityPlane
      ?? defaultConnectivityPlane(domain, surface);
    const runtimeMode = integrationOverride?.runtimeMode
      ?? resolveRuntimeMode({ dependencyIntegration, legacySurface, connectivityPlane });
    const permissionManifestRef = resolvePermissionManifestRef(
      repoRoot,
      workspace,
      dependencyIntegration,
    );

    if (permissionManifestRef) {
      inheritedManifests.push({
        workspace,
        manifestRef: permissionManifestRef,
        inheritPermissions: true,
      });
    }

    const envKey = baseUrlEnvKey(workspace);
    const mountStatus = legacySurface?.runtimeIntegration?.mountCoverage?.status ?? null;
    const forbidProductSameOriginFallback = runtimeMode === 'external-via-platform-gateway'
      && connectivityPlane === 'platform'
      && mountStatus === 'not-mounted';

    if (runtimeMode === 'external-via-platform-gateway') {
      requiresPlatformGatewayProcess = true;
    }

    if (forbidProductSameOriginFallback) {
      integrations.push({
        workspace,
        surface,
        apiPrefix,
        connectivityPlane,
        runtimeMode,
        mountStatus,
        envKey,
        forbidProductSameOriginFallback: true,
        corePackage: dep.corePackage,
        source: dep.source,
      });
      continue;
    }

    integrations.push({
      workspace,
      surface,
      apiPrefix,
      connectivityPlane,
      runtimeMode,
      mountStatus,
      envKey,
      forbidProductSameOriginFallback: false,
      corePackage: dep.corePackage,
      source: dep.source,
    });

    if (integrationOverride?.baseUrl && envKey) {
      env[envKey] = integrationOverride.baseUrl;
    }
  }

  const compositionExempt = isCompositionExemptRepo(repoRoot)
    || listClientAppRoots(repoRoot).some((clientRoot) =>
      findCorePackages(clientRoot.appRoot).some((core) =>
        isCompositionConsumerExempt(core.componentSpec),
      ),
    );

  if (sdkDependencies.length === 0 && !compositionExempt) {
    issues.push('no sdkDependencies found in consumer core component.spec.json files');
  }

  for (const integration of integrations) {
    if (integration.forbidProductSameOriginFallback && !integration.envKey) {
      issues.push(`${integration.workspace}: external platform dependency missing env key convention`);
    }
  }

  return {
    schemaVersion: 1,
    kind: 'sdkwork.composition.resolved',
    repository: path.basename(repoRoot),
    integrations,
    permissions: {
      inheritanceMode: 'module-catalog-with-overrides',
      inheritedManifests,
    },
    env,
    requiresPlatformGatewayProcess,
    issues,
    meta: {
      resolver: 'sdkwork-specs/tools/lib/composition-resolver.mjs',
      credentialModes: Object.fromEntries(
        sdkDependencies.map((dep) => [
          dep.workspace,
          dep.credentialMode ?? defaultCredentialMode(dep.surface ?? surfaceFromWorkspace(dep.workspace)),
        ]),
      ),
    },
  };
}

export function validateCompositionResolution(resolution, {
  observedEnv = {},
  productAppApiBaseUrl,
} = {}) {
  const issues = [];

  for (const integration of resolution.integrations ?? []) {
    if (!integration.forbidProductSameOriginFallback || !integration.envKey) continue;
    const observed = observedEnv[integration.envKey];
    if (!observed) continue;
    if (productAppApiBaseUrl && observed === productAppApiBaseUrl) {
      issues.push(
        `${integration.envKey} must not fall back to product same-origin base URL (${productAppApiBaseUrl}); use platform.api-gateway for ${integration.workspace}`,
      );
    }
    if (observed === '/app/v3/api' && integration.connectivityPlane === 'platform') {
      issues.push(
        `${integration.envKey} must not use product relative same-origin path for platform dependency ${integration.workspace}`,
      );
    }
  }

  return issues;
}

export function deriveFoundationEnvFromResolution(resolution, {
  platformGatewayOrigin,
  productAppApiBaseUrl,
  productBackendApiBaseUrl,
}) {
  const env = { ...(resolution.env ?? {}) };

  for (const integration of resolution.integrations ?? []) {
    if (!integration.envKey || env[integration.envKey]) continue;

    if (integration.runtimeMode === 'external-via-platform-gateway') {
      const prefix = integration.apiPrefix ?? APP_API_PREFIX;
      env[integration.envKey] = `${String(platformGatewayOrigin).replace(/\/+$/u, '')}${prefix}`;
      continue;
    }

    if (integration.surface === 'backend-api') {
      env[integration.envKey] = productBackendApiBaseUrl;
      continue;
    }

    env[integration.envKey] = productAppApiBaseUrl;
  }

  return env;
}
