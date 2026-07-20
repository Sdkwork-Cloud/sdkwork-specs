import fs from 'node:fs';
import path from 'node:path';
import { readJson, toPosix } from './app-composition.mjs';

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
]);

const ALLOWED_LAYER_ROLES = new Set([
  'contract',
  'frontend-core',
  'frontend-shell',
  'frontend-feature',
  'frontend-commons',
  'frontend-host',
  'backend-route',
  'backend-service',
  'backend-domain',
  'backend-repository',
  'backend-provider',
  'runtime-api-server',
  'runtime-service-host',
  'runtime-composition',
  'runtime-gateway',
  'runtime-native-host',
  'sdk-facade',
  'sdk-generated',
  'tooling',
]);

const FRONTEND_TYPES = new Set([
  'react-package',
  'frontend-core',
  'frontend-package',
  'frontend-feature',
  'ui-package',
]);

const EXECUTABLE_ENTRYPOINT_RE = /(?:build_|create_|mount_|router|controller|service|host|adapter|gateway_mount|package\.json#scripts\.)/u;
const METADATA_ENTRYPOINT_RE = /(?:route-manifest|openapi|\.openapi\.|manifest\.json|paths\.rs|README\.md)$/u;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasAuthoredSource(componentSpec) {
  return componentSpec?.component?.generated !== true;
}

function componentLabel(record) {
  return `${record.relativePath}: ${record.spec.component?.name ?? '(unnamed component)'}`;
}

function isFrontendComponent(componentSpec) {
  const type = componentSpec?.component?.type;
  const languages = componentSpec?.component?.languages ?? [];
  const layerRole = componentSpec?.contracts?.layerRole;
  return FRONTEND_TYPES.has(type)
    || String(type ?? '').includes('frontend')
    || String(type ?? '').includes('react')
    || String(layerRole ?? '').startsWith('frontend-')
    || languages.includes('typescript') && String(type ?? '').includes('package');
}

function listComponentSpecs(repoRoot) {
  const records = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.name !== 'component.spec.json') continue;
      const specPath = path.join(dir, entry.name);
      records.push({
        specPath,
        relativePath: toPosix(path.relative(repoRoot, specPath)),
        spec: readJson(specPath),
      });
    }
  };
  walk(repoRoot);
  return records.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function validateLayerRole(record, options) {
  const issues = [];
  const layerRole = record.spec.contracts?.layerRole;
  const label = componentLabel(record);

  if (layerRole === undefined || layerRole === null || layerRole === '') {
    if (options.strict && hasAuthoredSource(record.spec)) {
      issues.push(`${label}: contracts.layerRole is required in strict composable architecture mode`);
    }
    return issues;
  }

  if (typeof layerRole !== 'string') {
    issues.push(`${label}: contracts.layerRole must be a string`);
    return issues;
  }

  if (!ALLOWED_LAYER_ROLES.has(layerRole)) {
    issues.push(`${label}: contracts.layerRole ${JSON.stringify(layerRole)} is not an allowed composable layer role`);
  }
  return issues;
}

function validatePortList(record, fieldName, options) {
  const issues = [];
  const contracts = record.spec.contracts ?? {};
  const label = componentLabel(record);
  const value = contracts[fieldName];

  if (value === undefined) {
    if (options.strict && isFrontendComponent(record.spec)) {
      issues.push(`${label}: contracts.${fieldName} must be declared as [] when no ports are ${fieldName === 'providedPorts' ? 'provided' : 'required'}`);
    }
    return issues;
  }

  if (!Array.isArray(value)) {
    issues.push(`${label}: contracts.${fieldName} must be an array`);
    return issues;
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry === 'string') continue;
    if (!isObject(entry)) {
      issues.push(`${label}: contracts.${fieldName}[${index}] must be a string or object`);
      continue;
    }
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      issues.push(`${label}: contracts.${fieldName}[${index}].name is required`);
    }
    if (typeof entry.export !== 'string' || entry.export.length === 0) {
      issues.push(`${label}: contracts.${fieldName}[${index}].export is required`);
    }
    if (entry.export && !contracts.publicExports?.includes(entry.export)) {
      issues.push(`${label}: contracts.${fieldName}[${index}].export must reference contracts.publicExports`);
    }
  }

  return issues;
}

function isSameOriginSurface(surface) {
  const mode = surface?.runtimeMode ?? surface?.mode ?? surface?.mountMode;
  return mode === 'same-origin-mounted'
    || mode === 'same-origin-embedded'
    || mode === 'embedded'
    || surface?.sameOriginAllowed === true;
}

function surfaceExecutableExport(surface) {
  return surface?.embeddedExecutableExport
    ?? surface?.executablePublicExport
    ?? surface?.routerExport
    ?? surface?.controllerExport
    ?? surface?.serviceExport
    ?? null;
}

function validateDependencyApiSurfaces(record) {
  const issues = [];
  const contracts = record.spec.contracts ?? {};
  const label = componentLabel(record);
  const surfaces = contracts.dependencyApiSurfaces;
  if (surfaces === undefined) return issues;
  if (!Array.isArray(surfaces)) {
    issues.push(`${label}: contracts.dependencyApiSurfaces must be an array`);
    return issues;
  }

  for (const [index, surface] of surfaces.entries()) {
    if (!isObject(surface)) {
      issues.push(`${label}: contracts.dependencyApiSurfaces[${index}] must be an object`);
      continue;
    }
    if (!isSameOriginSurface(surface)) continue;

    const executableExport = surfaceExecutableExport(surface);
    if (!executableExport) {
      issues.push(`${label}: contracts.dependencyApiSurfaces[${index}] same-origin surface requires an executable public export`);
    }

    const runtimeEntrypoints = contracts.runtimeEntrypoints ?? [];
    if (!Array.isArray(runtimeEntrypoints) || runtimeEntrypoints.length === 0) {
      issues.push(`${label}: contracts.runtimeEntrypoints must include executable entrypoints for same-origin dependency surfaces`);
      continue;
    }

    const hasExecutableEntrypoint = runtimeEntrypoints.some((entry) => {
      const text = String(entry);
      return EXECUTABLE_ENTRYPOINT_RE.test(text) && !METADATA_ENTRYPOINT_RE.test(text);
    });
    if (!hasExecutableEntrypoint) {
      issues.push(`${label}: contracts.runtimeEntrypoints route metadata is not executable runtime coverage for same-origin dependency surfaces`);
    }
  }

  return issues;
}

export function validateComponentPortBindings(repoRoot, options = {}) {
  const strict = options.strict ?? false;
  const issues = [];
  for (const record of listComponentSpecs(repoRoot)) {
    issues.push(...validateLayerRole(record, { strict }));
    issues.push(...validatePortList(record, 'providedPorts', { strict }));
    issues.push(...validatePortList(record, 'requiredPorts', { strict }));
    issues.push(...validateDependencyApiSurfaces(record));
  }
  return issues;
}

export function listComponentPortBindingSpecs(repoRoot) {
  return listComponentSpecs(repoRoot);
}
