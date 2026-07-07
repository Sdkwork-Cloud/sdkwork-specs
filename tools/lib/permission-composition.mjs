import fs from 'node:fs';
import path from 'node:path';
import {
  findCorePackages,
  listClientAppRoots,
  normalizeSdkDependencies,
  readJson,
  toPosix,
} from './app-composition.mjs';
import {
  openApiAuthorityEntries,
  walkOpenApiFiles,
} from './http-response-envelope-patterns.mjs';
import {
  openApiOperationEntriesFromText,
} from './openapi-operation-utils.mjs';

const NON_HTTP_CREDENTIAL_MODES = new Set(['local-native', 'test-fake']);

export function classifyPermissionComposition(repoRoot) {
  const issues = [];
  for (const clientRoot of listClientAppRoots(repoRoot)) {
    const relRoot = toPosix(path.relative(repoRoot, clientRoot.appRoot));
    const coreContexts = [];

    for (const core of findCorePackages(clientRoot.appRoot)) {
      const relCore = `${relRoot}/packages/${core.packageName}`;
      const httpDeps = normalizeSdkDependencies(core.componentSpec).filter(isHttpSdkDependency);
      if (httpDeps.length === 0) continue;

      const permissionComposition = core.componentSpec?.contracts?.permissionComposition;
      if (!permissionComposition || typeof permissionComposition !== 'object') {
        issues.push(
          `${relCore}: missing contracts.permissionComposition for HTTP sdkDependencies: ${httpDeps.map((dep) => dep.workspace).join(', ')}`,
        );
        continue;
      }

      const context = loadPermissionCompositionContext(repoRoot, clientRoot.appRoot, core, permissionComposition, relCore);
      issues.push(...context.issues);
      issues.push(...validateDependencyCatalogRefs(httpDeps, context, relCore));
      coreContexts.push(context);
    }

    if (coreContexts.length > 0) {
      issues.push(...validateOpenApiPermissionCodes(clientRoot.appRoot, repoRoot, coreContexts));
    }
  }
  return issues;
}

function loadPermissionCompositionContext(repoRoot, appRoot, core, permissionComposition, relCore) {
  const issues = [];
  const permissionCodes = new Set();
  const catalogs = [];

  if (permissionComposition.inheritanceMode !== 'module-catalog-with-overrides') {
    issues.push(`${relCore}: permissionComposition.inheritanceMode must be module-catalog-with-overrides`);
  }

  if (!Array.isArray(permissionComposition.moduleCatalogRefs)) {
    issues.push(`${relCore}: permissionComposition.moduleCatalogRefs must be an array`);
  }

  const consumerPolicy = permissionComposition.consumerPolicy ?? {};
  if (consumerPolicy.forbidLocalPermissionCatalogForDependencyDomains !== true) {
    issues.push(`${relCore}: permissionComposition.consumerPolicy.forbidLocalPermissionCatalogForDependencyDomains must be true`);
  }
  if (consumerPolicy.allowExplicitOverridesOnly !== true) {
    issues.push(`${relCore}: permissionComposition.consumerPolicy.allowExplicitOverridesOnly must be true`);
  }

  for (const ref of permissionComposition.moduleCatalogRefs ?? []) {
    const loaded = loadManifestRef(ref.manifestRef, repoRoot, appRoot, core.componentSpecPath);
    if (!loaded.manifest) {
      issues.push(`${relCore}: moduleCatalogRefs manifestRef does not resolve: ${ref.manifestRef ?? '<missing>'}`);
      continue;
    }
    const manifest = loaded.manifest;
    const catalog = {
      moduleId: ref.moduleId ?? manifest.moduleId,
      domain: manifest.domain,
      manifestRef: ref.manifestRef,
      manifestPath: loaded.path,
      inheritPermissions: ref.inheritPermissions === true,
    };
    catalogs.push(catalog);
    if (catalog.inheritPermissions) {
      for (const code of permissionCodesFromManifest(manifest)) {
        permissionCodes.add(code);
      }
    }
  }

  const applicationRef = permissionComposition.applicationModule?.manifestRef;
  if (applicationRef) {
    const loaded = loadManifestRef(applicationRef, repoRoot, appRoot, core.componentSpecPath);
    if (!loaded.manifest) {
      issues.push(`${relCore}: applicationModule.manifestRef does not resolve: ${applicationRef}`);
    } else {
      for (const code of permissionCodesFromManifest(loaded.manifest)) {
        permissionCodes.add(code);
      }
    }
  }

  return {
    core,
    relCore,
    permissionComposition,
    permissionCodes,
    catalogs,
    issues,
  };
}

function validateDependencyCatalogRefs(httpDeps, context, relCore) {
  const issues = [];
  const inheritableCatalogs = context.catalogs.filter((catalog) => catalog.inheritPermissions);
  for (const dep of httpDeps) {
    const candidates = dependencyCatalogCandidates(dep);
    const matched = inheritableCatalogs.some((catalog) => {
      return candidates.has(catalog.moduleId) || candidates.has(catalog.domain);
    });
    if (!matched) {
      issues.push(
        `${relCore}: sdkDependencies ${dep.workspace} must have a matching permissionComposition.moduleCatalogRefs[] entry with inheritPermissions=true`,
      );
    }
  }
  return issues;
}

function validateOpenApiPermissionCodes(appRoot, repoRoot, contexts) {
  const issues = [];
  const allKnownCodes = new Set();
  for (const context of contexts) {
    for (const code of context.permissionCodes) allKnownCodes.add(code);
  }

  for (const authority of openApiAuthorityEntries(walkOpenApiFiles(appRoot))) {
    const text = readText(authority.file);
    if (text == null) continue;
    const rel = toPosix(path.relative(repoRoot, authority.file));
    for (const entry of openApiOperationEntriesFromText(text).entries) {
      const code = entry.operation['x-sdkwork-permission'];
      if (!code) continue;
      if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/u.test(code)) {
        issues.push(`${rel}: invalid-openapi-permission - ${entry.method.toUpperCase()} ${entry.routePath} uses non-standard permission ${code}`);
        continue;
      }
      if (!allKnownCodes.has(code)) {
        issues.push(`${rel}: unknown-openapi-permission - ${entry.method.toUpperCase()} ${entry.routePath} references ${code}`);
      }
    }
  }
  return issues;
}

function isHttpSdkDependency(dep) {
  if (!dep?.workspace) return false;
  if (NON_HTTP_CREDENTIAL_MODES.has(dep.credentialMode)) return false;
  const surface = dep.surface ?? '';
  if (/^(app-api|backend-api|open-api)$/u.test(surface)) return true;
  return /(?:^|[-/])(?:app|backend|open)-sdk(?:$|\/)/u.test(dep.workspace)
    || /-sdk$/u.test(dep.workspace);
}

function dependencyCatalogCandidates(dep) {
  const candidates = new Set();
  for (const value of [dep.moduleId, dep.permissionModuleId, dep.domain]) {
    if (typeof value === 'string' && value.trim()) candidates.add(value.trim());
  }
  const workspace = String(dep.workspace ?? '')
    .replace(/^@sdkwork\//u, '')
    .replace(/\/.*$/u, '');
  const stripped = workspace
    .replace(/^sdkwork-/u, '')
    .replace(/-(?:app|backend|open)-sdk$/u, '')
    .replace(/-sdk$/u, '');
  if (stripped) candidates.add(stripped);
  return candidates;
}

function loadManifestRef(manifestRef, repoRoot, appRoot, componentSpecPath) {
  if (typeof manifestRef !== 'string' || manifestRef.trim().length === 0) {
    return { path: null, manifest: null };
  }
  const bases = [
    path.dirname(componentSpecPath),
    appRoot,
    repoRoot,
  ];
  for (const base of bases) {
    const candidate = path.resolve(base, manifestRef);
    if (!fs.existsSync(candidate)) continue;
    try {
      return { path: candidate, manifest: readJson(candidate) };
    } catch {
      return { path: candidate, manifest: null };
    }
  }
  return { path: null, manifest: null };
}

function permissionCodesFromManifest(manifest) {
  const catalog = manifest?.permissions?.catalog;
  if (!Array.isArray(catalog)) return [];
  return catalog
    .map((entry) => entry?.code)
    .filter((code) => typeof code === 'string' && code.trim().length > 0);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}
