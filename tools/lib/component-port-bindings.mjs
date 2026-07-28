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

function componentRoot(record) {
  return path.dirname(path.dirname(record.specPath));
}

function cargoIdentity(cargo) {
  let section = '';
  let packageName = null;
  let libName = null;
  for (const rawLine of cargo.split(/\r?\n/u)) {
    const line = rawLine.trim();
    const sectionMatch = /^\[([^\]]+)\]$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const name = /^name\s*=\s*"([^"]+)"/u.exec(line)?.[1];
    if (!name) continue;
    if (section === 'package') packageName = name;
    if (section === 'lib') libName = name;
  }
  return { packageName, libName };
}

function rustCrateNames(record) {
  if (!(record.spec.component?.languages ?? []).includes('rust')) return new Set();
  const cargoPath = path.join(componentRoot(record), 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return new Set();

  const { packageName, libName } = cargoIdentity(fs.readFileSync(cargoPath, 'utf8'));
  return new Set(
    [libName, packageName, record.spec.component?.name]
      .filter((value) => typeof value === 'string' && !value.startsWith('@'))
      .map((value) => value.replaceAll('-', '_')),
  );
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
    if (
      fieldName === 'providedPorts'
      && entry.export
      && !contracts.publicExports?.includes(entry.export)
    ) {
      issues.push(`${label}: contracts.${fieldName}[${index}].export must reference contracts.publicExports`);
    }
  }

  return issues;
}

function validateRustPublicExports(record) {
  const issues = [];
  const crateNames = rustCrateNames(record);
  if (crateNames.size === 0) return issues;

  const label = componentLabel(record);
  for (const [index, value] of (record.spec.contracts?.publicExports ?? []).entries()) {
    if (typeof value !== 'string') continue;
    const cratePath = /^(sdkwork_[a-z0-9_]*)::/u.exec(value)?.[1];
    if (cratePath && !crateNames.has(cratePath)) {
      issues.push(
        `${label}: contracts.publicExports[${index}] declares dependency export ${value}; `
        + 'publicExports may only name exports of the current component (declare dependency exports in requiredPorts)',
      );
    }
  }
  return issues;
}

function providerIndex(records) {
  const index = new Map();
  for (const record of records) {
    const names = new Set([
      record.spec.component?.name,
      ...rustCrateNames(record),
    ]);
    for (const name of names) {
      if (typeof name !== 'string' || !name) continue;
      index.set(name, record);
      index.set(name.replaceAll('_', '-'), record);
    }
  }
  return index;
}

function inferredProviderName(record, port) {
  if (typeof port.provider === 'string' && port.provider) return port.provider;
  const surface = (record.spec.contracts?.dependencyApiSurfaces ?? []).find(
    (candidate) => isObject(candidate)
      && surfaceExecutableExport(candidate) === port.export
      && typeof candidate.cargoDependency === 'string',
  );
  if (surface) return surface.cargoDependency;
  return /^([a-z][a-z0-9_]*)::/u.exec(port.export ?? '')?.[1] ?? null;
}

function providerOffersPort(provider, requiredPort) {
  const contracts = provider.spec.contracts ?? {};
  if ((contracts.publicExports ?? []).includes(requiredPort.export)) return true;
  const requiredCrate = /^([a-z][a-z0-9_]*)::/u.exec(requiredPort.export)?.[1];
  if (
    requiredCrate
    && rustCrateNames(provider).has(requiredCrate)
    && (contracts.publicExports ?? []).some((value) => value === '.' || value === 'crate-root')
  ) {
    return true;
  }
  return (contracts.providedPorts ?? []).some((providedPort) => (
    isObject(providedPort)
    && (
      providedPort.export === requiredPort.export
      || providedPort.target === requiredPort.export
    )
  ));
}

function validateRequiredPortProviders(record, providers) {
  const issues = [];
  const label = componentLabel(record);
  for (const [index, port] of (record.spec.contracts?.requiredPorts ?? []).entries()) {
    if (!isObject(port) || typeof port.export !== 'string') continue;
    if (!/^([a-z][a-z0-9_]*)::/u.test(port.export)) continue;
    const providerName = inferredProviderName(record, port);
    if (!providerName) continue;
    const provider = providers.get(providerName)
      ?? providers.get(providerName.replaceAll('_', '-'));
    if (!provider || provider === record) continue;
    if (!providerOffersPort(provider, port)) {
      issues.push(
        `${label}: contracts.requiredPorts[${index}] requests ${port.export} from ${providerName}, `
        + `but ${componentLabel(provider)} does not expose it through publicExports/providedPorts`,
      );
    }
  }
  return issues;
}

function isSameOriginSurface(surface) {
  const mode = surface?.runtimeMode ?? surface?.mode ?? surface?.mountMode;
  return mode === 'same-origin-mounted'
    || mode === 'same-origin-embedded'
    || mode === 'same-origin'
    || mode === 'embedded';
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
    } else if (!(contracts.requiredPorts ?? []).some((port) => (
      isObject(port) && port.export === executableExport
    ))) {
      issues.push(`${label}: contracts.dependencyApiSurfaces[${index}] executable public export must have a matching requiredPorts entry`);
    }

    if (!Array.isArray(surface.profileCoverage) || !surface.profileCoverage.includes('standalone')) {
      issues.push(`${label}: contracts.dependencyApiSurfaces[${index}] same-origin surface requires standalone profileCoverage`);
    }
    if (surface.requiredBaseUrlKey) {
      issues.push(`${label}: contracts.dependencyApiSurfaces[${index}] same-origin surface must not require an external base URL key`);
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
  const records = listComponentSpecs(repoRoot);
  const providerRecords = [
    ...records,
    ...(options.providerRecords ?? []),
    ...(options.providerRoots ?? []).flatMap((root) => listComponentSpecs(root)),
  ];
  const providers = providerIndex(providerRecords);
  for (const record of records) {
    issues.push(...validateLayerRole(record, { strict }));
    issues.push(...validatePortList(record, 'providedPorts', { strict }));
    issues.push(...validatePortList(record, 'requiredPorts', { strict }));
    issues.push(...validateRustPublicExports(record));
    issues.push(...validateRequiredPortProviders(record, providers));
    issues.push(...validateDependencyApiSurfaces(record));
  }
  return issues;
}

export function listComponentPortBindingSpecs(repoRoot) {
  return listComponentSpecs(repoRoot);
}
