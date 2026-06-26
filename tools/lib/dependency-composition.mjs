#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST_KIND = 'sdkwork.dependency.composition';
export const MANIFEST_SCHEMA_VERSION = 1;

export const CLIENT_ARCHITECTURES = [
  { suffix: '-pc', id: 'pc', coreRole: 'pc-core', corePattern: /-pc-core$/ },
  { suffix: '-h5', id: 'h5', coreRole: 'h5-core', corePattern: /-h5-core$/ },
  { suffix: '-flutter-mobile', id: 'flutter-mobile', coreRole: 'flutter_mobile_core', corePattern: /_flutter_mobile_core$/ },
  { suffix: '-mini-program', id: 'mp', coreRole: 'mp-core', corePattern: /-mp-core$/ },
  { suffix: '-android-mobile', id: 'android-mobile', coreRole: 'android-mobile-core', corePattern: /-android-mobile-core$/ },
  { suffix: '-ios-mobile', id: 'ios-mobile', coreRole: 'ios-mobile-core', corePattern: /-ios-mobile-core$/ },
  { suffix: '-harmony-mobile', id: 'harmony-mobile', coreRole: 'harmony-mobile-core', corePattern: /-harmony-mobile-core$/ },
];

export const SURFACE_SUFFIXES = [
  { surface: 'app', pattern: /-core$/ },
  { surface: 'console', pattern: /-console-core$/ },
  { surface: 'backend-admin', pattern: /-admin-core$/ },
];

export const REQUIRED_SPEC_SECTIONS = [
  'Four-Layer Dependency Model',
  'Dual Entry Architecture',
  'Semantic Dependency Manifest',
  'Core Package Public Export Surface',
  'Frontend And Backend Dependency Chains',
  'Verification',
];

export const CREDENTIAL_MODES = new Set([
  'authenticated-app-api',
  'authenticated-backend-admin',
  'protected-open-api-api-key',
  'protected-open-api-oauth',
  'protected-open-api-flexible',
  'public-open-api',
  'local-native',
  'test-fake',
]);

export const CORE_EXPORT_SUBPATHS = ['.', './sdk', './modules', './host', './session', './composition'];

export function toPosix(filePath) {
  return filePath.replaceAll(path.sep, '/');
}

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
  return JSON.parse(raw);
}

export function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function hasHeading(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^##\\s+(?:\\d+(?:\\.\\d+)*\\.\\s+)?${escaped}\\s*$`, 'imu').test(text);
}

export function detectClientArchitecture(appRootName) {
  for (const entry of CLIENT_ARCHITECTURES) {
    if (appRootName.endsWith(entry.suffix)) {
      return entry;
    }
  }
  return null;
}

export function extractApplicationCode(appRootName) {
  for (const entry of CLIENT_ARCHITECTURES) {
    if (appRootName.endsWith(entry.suffix)) {
      return appRootName.slice('sdkwork-'.length, appRootName.length - entry.suffix.length);
    }
  }
  return null;
}

export function listClientAppRoots(repoRoot) {
  const roots = [];
  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const arch = detectClientArchitecture(entry.name);
      if (!arch) continue;
      const appRoot = path.join(appsDir, entry.name);
      if (fs.existsSync(path.join(appRoot, 'sdkwork.app.config.json'))) {
        roots.push({ appRoot, appRootName: entry.name, architecture: arch });
      }
    }
  }

  const repoName = path.basename(repoRoot);
  const arch = detectClientArchitecture(repoName);
  if (arch && fs.existsSync(path.join(repoRoot, 'sdkwork.app.config.json'))) {
    roots.push({ appRoot: repoRoot, appRootName: repoName, architecture: arch });
  }

  return roots;
}

export function isCorePackageDirectory(name) {
  if (/-(?:console-core|admin-core)$/.test(name)) return true;
  if (/_flutter_mobile_(?:console_core|admin_core|core)$/.test(name)) return true;
  if (/-core$/.test(name) && !/-host-core$/.test(name)) return true;
  return false;
}

export function findCorePackages(appRoot, appRootName, applicationCode, architecture) {
  const packagesDir = path.join(appRoot, 'packages');
  if (!fs.existsSync(packagesDir)) return [];

  const cores = [];
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!isCorePackageDirectory(entry.name)) continue;
    const packageDir = path.join(packagesDir, entry.name);
    const componentSpecPath = path.join(packageDir, 'specs/component.spec.json');
    const packageJsonPath = path.join(packageDir, 'package.json');
    const packageJson = fs.existsSync(packageJsonPath) ? readJson(packageJsonPath) : null;
    const componentSpec = fs.existsSync(componentSpecPath)
      ? readJson(componentSpecPath)
      : {
          component: {
            name: packageJson?.name ?? entry.name,
          },
          contracts: {
            sdkDependencies: [],
            dependencyApiExports: [],
            dependencyApiSurfaces: [],
          },
        };
    const name = componentSpec.component?.name ?? packageJson?.name ?? entry.name;
    let surface = 'app';
    if (/-console-core$/.test(entry.name) || /_console_core$/.test(entry.name)) surface = 'console';
    else if (/-admin-core$/.test(entry.name) || /_admin_core$/.test(entry.name)) surface = 'backend-admin';

    cores.push({
      surface,
      packageDir,
      packageName: entry.name,
      componentName: name,
      componentSpec,
      componentSpecPath,
      packageJson,
      packageJsonPath,
      hasComponentSpec: fs.existsSync(componentSpecPath),
    });
  }

  return cores.sort((a, b) => a.surface.localeCompare(b.surface));
}

export function normalizeSdkDependencies(componentSpec) {
  const deps = componentSpec?.contracts?.sdkDependencies ?? [];
  return deps.map((item) => (typeof item === 'string' ? item : item.workspace)).filter(Boolean);
}

export function isSharedDependencyWorkspace(workspace) {
  return workspace.includes('appbase')
    || workspace.includes('iam-')
    || workspace.includes('drive')
    || workspace.includes('im-');
}

export function inferSdkClientsFromDependencies(sdkDependencies, surface) {
  return sdkDependencies.map((workspace) => {
    const isAppbase = workspace.includes('appbase');
    const isBackend = workspace.includes('backend');
    const isOpen = workspace.includes('-sdk') && !workspace.includes('-app-sdk') && !workspace.includes('-backend-sdk');
    let apiSurface = 'app-api';
    let credentialMode = 'authenticated-app-api';
    if (surface === 'backend-admin' || isBackend) {
      apiSurface = 'backend-api';
      credentialMode = 'authenticated-backend-admin';
    } else if (isOpen) {
      apiSurface = 'open-api';
      credentialMode = 'protected-open-api-flexible';
    }

    const id = isAppbase
      ? (isBackend ? 'appbaseBackend' : 'appbaseApp')
      : workspace.replace(/^sdkwork-/, '').replace(/-app-sdk$/, 'App').replace(/-backend-sdk$/, 'Backend').replace(/-sdk$/, 'Open').replace(/-/g, '');

    const isDependency = isSharedDependencyWorkspace(workspace);

    return {
      id,
      workspace,
      surface: apiSurface,
      credentialMode,
      role: isDependency ? 'dependency' : 'application-owned',
      ...(isDependency ? { sdkDependencyRef: workspace } : {}),
    };
  });
}

export function readCoreIndexSource(core) {
  if (!core?.packageDir) return null;
  for (const relativePath of ['src/index.ts', 'lib/index.ts']) {
    const filePath = path.join(core.packageDir, relativePath);
    if (fs.existsSync(filePath)) return readText(filePath);
  }
  return null;
}

export function extractSdkFamiliesFromCoreSource(sourceText) {
  if (!sourceText) return [];
  const families = new Set();
  const familyRe = /family:\s*"([^"]+)"/gu;
  let match = familyRe.exec(sourceText);
  while (match) {
    if (match[1].startsWith('sdkwork-')) families.add(match[1]);
    match = familyRe.exec(sourceText);
  }
  return [...families];
}

export function extractListSdkInventoryExports(sourceText) {
  if (!sourceText) {
    return { listFunctions: [], constNames: [], types: [] };
  }

  const listFunctions = [];
  const listFnRe = /export function (listSdkwork\w+(?:AppSdkFamilies|BackendAdminSdkFamilies|ConsoleSdkFamilies))\s*\(/gu;
  let match = listFnRe.exec(sourceText);
  while (match) {
    listFunctions.push(match[1]);
    match = listFnRe.exec(sourceText);
  }

  const constNames = [];
  const constRe = /export const (sdkwork\w+(?:AppSdkFamilies|BackendAdminSdkFamilies|ConsoleSdkFamilies))\s*=/gu;
  match = constRe.exec(sourceText);
  while (match) {
    constNames.push(match[1]);
    match = constRe.exec(sourceText);
  }

  const types = [];
  const typeRe = /export (?:type|interface) (Sdkwork\w+SdkFamilyInventoryItem)/gu;
  match = typeRe.exec(sourceText);
  while (match) {
    types.push(match[1]);
    match = typeRe.exec(sourceText);
  }

  return { listFunctions, constNames, types };
}

export function resolveSdkDependenciesForCore(core) {
  const fromSpec = normalizeSdkDependencies(core.componentSpec);
  const fromIndex = extractSdkFamiliesFromCoreSource(readCoreIndexSource(core));
  return [...new Set([...fromSpec, ...fromIndex])].sort();
}

export function isGenericSdkInventoryStub(content) {
  return /listSdkworkCoreSdkInventory/u.test(content) && /return\s+\[\]\s+as\s+const/u.test(content);
}

export function buildSdkInventorySource(inventoryExports) {
  if (inventoryExports.listFunctions.length === 0) {
    return 'export function listSdkworkCoreSdkInventory() {\n  return [] as const;\n}\n';
  }

  const symbols = [
    ...inventoryExports.listFunctions,
    ...inventoryExports.constNames,
    ...inventoryExports.types.map((name) => `type ${name}`),
  ];
  return `export {\n  ${symbols.join(',\n  ')},\n} from "../index.js";\n`;
}

export function normalizeCorePackageIdentity(value) {
  return String(value ?? '')
    .replace(/^@sdkwork\//, '')
    .replace(/-/g, '_')
    .toLowerCase();
}

export function corePackagesMatch(left, right) {
  if (!left || !right) return false;
  if (left === right) return true;
  return normalizeCorePackageIdentity(left) === normalizeCorePackageIdentity(right);
}

export function expectedCorePackageDirectoryName(applicationCode, architectureId) {
  if (architectureId === 'flutter-mobile') {
    return `sdkwork_${applicationCode}_flutter_mobile_core`;
  }
  if (architectureId === 'mp') {
    return `sdkwork-${applicationCode}-mp-core`;
  }
  return `sdkwork-${applicationCode}-${architectureId}-core`;
}

export function ensureMissingAppCorePackage(appRoot, applicationCode, architecture, { dryRun = false } = {}) {
  const packageDirName = expectedCorePackageDirectoryName(applicationCode, architecture.id);
  const packageDir = path.join(appRoot, 'packages', packageDirName);
  if (fs.existsSync(packageDir)) return [];

  const changes = [];
  const isFlutter = architecture.id === 'flutter-mobile';
  const packageName = isFlutter ? packageDirName : `@sdkwork/${applicationCode}-${architecture.id === 'mp' ? 'mp' : architecture.id}-core`;

  if (!dryRun) {
    fs.mkdirSync(path.join(packageDir, 'specs'), { recursive: true });
    if (isFlutter) {
      fs.mkdirSync(path.join(packageDir, 'lib'), { recursive: true });
      fs.writeFileSync(path.join(packageDir, 'pubspec.yaml'), [
        'name: ' + packageDirName,
        'publish_to: "none"',
        'environment:',
        '  sdk: ">=3.8.0 <4.0.0"',
        '',
      ].join('\n'));
      fs.writeFileSync(path.join(packageDir, 'lib', `${packageDirName}.dart`), 'library;\n');
    } else {
      fs.mkdirSync(path.join(packageDir, 'src'), { recursive: true });
      writeJson(path.join(packageDir, 'package.json'), {
        name: packageName,
        private: true,
        version: '0.1.0',
        type: 'module',
        exports: {
          '.': './src/index.ts',
        },
      });
      fs.writeFileSync(path.join(packageDir, 'src', 'index.ts'), 'export {};\n');
    }
    writeJson(path.join(packageDir, 'specs', 'component.spec.json'), {
      schemaVersion: 1,
      kind: 'sdkwork.component.spec',
      component: {
        name: packageName,
        type: isFlutter ? 'dart-package' : 'typescript-package',
        root: toPosix(path.relative(path.dirname(appRoot), packageDir)),
        domain: applicationCode,
        capability: 'core',
        surface: 'app',
        languages: isFlutter ? ['dart'] : ['typescript'],
        generated: false,
      },
      contracts: {
        sdkDependencies: [],
        dependencyApiExports: [],
        dependencyApiSurfaces: [],
      },
    });
  }

  changes.push(toPosix(path.relative(appRoot, packageDir)));
  return changes;
}

export function buildDependencyCompositionManifest({
  applicationCode,
  architecture,
  cores,
  buildToolPackages = [],
}) {
  const surfaceMap = new Map();
  for (const core of cores) {
    surfaceMap.set(core.surface, {
      surface: core.surface,
      corePackage: core.componentName,
      sdkClients: inferSdkClientsFromDependencies(resolveSdkDependenciesForCore(core), core.surface),
      reusableModules: [],
      hostAdapters: [],
      dependencyApiExports: core.componentSpec?.contracts?.dependencyApiExports ?? [],
      dependencyApiSurfaces: core.componentSpec?.contracts?.dependencyApiSurfaces ?? [],
    });
  }
  const surfaces = [...surfaceMap.values()];

  if (surfaces.length === 0) {
    const corePackage = architecture.id === 'flutter-mobile'
      ? expectedCorePackageDirectoryName(applicationCode, architecture.id)
      : `@sdkwork/${applicationCode}-${architecture.id === 'mp' ? 'mp' : architecture.id}-core`;
    surfaces.push({
      surface: 'app',
      corePackage,
      sdkClients: [],
      reusableModules: [],
      hostAdapters: [],
      dependencyApiExports: [],
      dependencyApiSurfaces: [],
    });
  }

  const workspacePackages = [...new Set([
    ...cores.map((core) => core.componentName),
    ...buildToolPackages,
  ])];

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    kind: MANIFEST_KIND,
    applicationCode,
    clientArchitecture: architecture.id,
    surfaces,
    buildToolEntries: {
      pnpm: {
        workspacePackages,
      },
    },
  };
}

export function validateManifestSchema(manifest, relPath = 'dependency.composition.json') {
  const issues = [];
  if (manifest?.kind !== MANIFEST_KIND) {
    issues.push(`${relPath}: kind must be ${MANIFEST_KIND}`);
  }
  if (manifest?.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    issues.push(`${relPath}: schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`);
  }
  if (!manifest?.applicationCode) issues.push(`${relPath}: applicationCode is required`);
  if (!manifest?.clientArchitecture) issues.push(`${relPath}: clientArchitecture is required`);
  if (!Array.isArray(manifest?.surfaces) || manifest.surfaces.length === 0) {
    issues.push(`${relPath}: surfaces[] must be a non-empty array`);
  }
  if (!manifest?.buildToolEntries || typeof manifest.buildToolEntries !== 'object') {
    issues.push(`${relPath}: buildToolEntries is required`);
  }

  for (const surfaceEntry of manifest?.surfaces ?? []) {
    const prefix = `${relPath}: surfaces.${surfaceEntry?.surface ?? 'unknown'}`;
    if (!surfaceEntry?.surface) issues.push(`${prefix}: surface is required`);
    if (!surfaceEntry?.corePackage) issues.push(`${prefix}: corePackage is required`);
    for (const field of ['sdkClients', 'reusableModules', 'hostAdapters', 'dependencyApiExports', 'dependencyApiSurfaces']) {
      if (!Array.isArray(surfaceEntry?.[field])) issues.push(`${prefix}: ${field} must be an array`);
    }
    for (const sdkClient of surfaceEntry?.sdkClients ?? []) {
      if (!sdkClient?.id) issues.push(`${prefix}: sdkClients[].id is required`);
      if (!sdkClient?.workspace) issues.push(`${prefix}: sdkClients[].workspace is required`);
      if (!sdkClient?.credentialMode || !CREDENTIAL_MODES.has(sdkClient.credentialMode)) {
        issues.push(`${prefix}: sdkClients.${sdkClient?.id ?? 'unknown'} credentialMode is invalid`);
      }
      if (sdkClient?.surface === 'backend-api' && surfaceEntry.surface !== 'backend-admin') {
        issues.push(`${prefix}: backend-api SDK ${sdkClient.id} must not appear outside backend-admin surface`);
      }
    }
  }

  return issues;
}

export function validateManifestAlignment(manifest, appRoot, relPrefix) {
  const issues = [];
  const cores = findCorePackages(
    appRoot,
    path.basename(appRoot),
    manifest.applicationCode,
    CLIENT_ARCHITECTURES.find((entry) => entry.id === manifest.clientArchitecture) ?? { id: manifest.clientArchitecture },
  );

  for (const surfaceEntry of manifest.surfaces ?? []) {
    const core = cores.find((item) =>
      item.surface === surfaceEntry.surface
      && (corePackagesMatch(item.componentName, surfaceEntry.corePackage)
        || corePackagesMatch(item.packageName, surfaceEntry.corePackage)));
    if (!core) {
      issues.push(`${relPrefix}: missing core package ${surfaceEntry.corePackage} for surface ${surfaceEntry.surface}`);
      continue;
    }

    const declaredDeps = new Set(resolveSdkDependenciesForCore(core));
    for (const sdkClient of surfaceEntry.sdkClients ?? []) {
      if (sdkClient.role === 'dependency' && declaredDeps.size > 0 && !declaredDeps.has(sdkClient.workspace)) {
        issues.push(`${relPrefix}: sdkClients.${sdkClient.id} workspace ${sdkClient.workspace} missing from core component sdkDependencies`);
      }
    }
    for (const dep of declaredDeps) {
      if (!(surfaceEntry.sdkClients ?? []).some((item) => item.workspace === dep)) {
        issues.push(`${relPrefix}: core sdkDependencies ${dep} missing from dependency.composition.json surface ${surfaceEntry.surface}`);
      }
    }
  }

  return issues;
}

export function validateCoreCompositionLayout(core, relPrefix) {
  const issues = [];
  const srcRoot = fs.existsSync(path.join(core.packageDir, 'src'))
    ? path.join(core.packageDir, 'src')
    : path.join(core.packageDir, 'lib');
  const compositionDir = path.join(srcRoot, 'composition');
  const altCompositionDir = path.join(core.packageDir, 'lib/composition');
  const hasComposition = fs.existsSync(compositionDir) || fs.existsSync(altCompositionDir);
  if (!hasComposition) {
    issues.push(`${relPrefix}: core package ${core.componentName} missing src/composition/ or lib/composition/`);
  }

  if (fs.existsSync(path.join(core.packageDir, 'pubspec.yaml'))) {
    return issues;
  }

  if (core.packageJson?.exports && typeof core.packageJson.exports === 'object') {
    for (const subpath of CORE_EXPORT_SUBPATHS) {
      if (!(subpath in core.packageJson.exports)) {
        issues.push(`${relPrefix}: core package ${core.componentName} missing package.json exports[${JSON.stringify(subpath)}]`);
      }
    }
  } else if (!fs.existsSync(path.join(core.packageDir, 'package.json'))) {
    issues.push(`${relPrefix}: core package ${core.componentName} missing package.json or pubspec.yaml export metadata`);
  }

  return issues;
}

export function validateSdkInventoryComposition(core, relPrefix) {
  const issues = [];
  if (fs.existsSync(path.join(core.packageDir, 'pubspec.yaml'))) return issues;

  const indexSource = readCoreIndexSource(core);
  const inventoryPath = path.join(core.packageDir, 'src/composition/sdk-inventory.ts');
  if (!indexSource || !fs.existsSync(inventoryPath)) return issues;

  const inventoryExports = extractListSdkInventoryExports(indexSource);
  if (inventoryExports.listFunctions.length === 0) return issues;

  const inventorySource = readText(inventoryPath);
  if (isGenericSdkInventoryStub(inventorySource)) {
    issues.push(`${relPrefix}: sdk-inventory.ts is still a stub but core index exports ${inventoryExports.listFunctions.join(', ')}`);
    return issues;
  }

  for (const fn of inventoryExports.listFunctions) {
    if (!inventorySource.includes(fn)) {
      issues.push(`${relPrefix}: sdk-inventory.ts must re-export ${fn} from core index`);
    }
  }

  return issues;
}

export function validateBootstrapCompositionImports(appRoot, cores, relPrefix) {
  const issues = [];
  const bootstrapDir = path.join(appRoot, 'src/bootstrap');
  if (!fs.existsSync(bootstrapDir)) return issues;

  const coreNames = cores.map((core) => core.componentName);
  for (const fileName of fs.readdirSync(bootstrapDir)) {
    if (!fileName.endsWith('.ts')) continue;
    const filePath = path.join(bootstrapDir, fileName);
    const source = readText(filePath);
    if (!/listSdkwork/u.test(source)) continue;

    for (const packageName of coreNames) {
      const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const badImportRe = new RegExp(
        `import\\s*\\{[^}]*listSdkwork[^}]*\\}\\s*from\\s*["']${escaped}["']`,
        'u',
      );
      if (badImportRe.test(source)) {
        issues.push(`${relPrefix}/src/bootstrap/${fileName}: listSdkwork* inventory imports must use ${packageName}/composition`);
      }
    }
  }

  return issues;
}

export function alignBootstrapCompositionImports(appRoot, cores, { dryRun = false } = {}) {
  const changes = [];
  const bootstrapDir = path.join(appRoot, 'src/bootstrap');
  if (!fs.existsSync(bootstrapDir)) return changes;

  const coreNames = cores.map((core) => core.componentName);
  for (const fileName of fs.readdirSync(bootstrapDir)) {
    if (!fileName.endsWith('.ts')) continue;
    const filePath = path.join(bootstrapDir, fileName);
    let source = readText(filePath);
    const original = source;

    for (const packageName of coreNames) {
      const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      const importRe = new RegExp(
        `(import\\s*\\{[^}]*listSdkwork[^}]*\\}\\s*from\\s*["'])${escaped}(["'])`,
        'gu',
      );
      source = source.replace(importRe, `$1${packageName}/composition$2`);
    }

    if (source !== original) {
      if (!dryRun) fs.writeFileSync(filePath, source);
      changes.push(toPosix(path.relative(appRoot, filePath)));
    }
  }

  return changes;
}

export function syncCoreSdkDependencies(core, { dryRun = false } = {}) {
  if (!fs.existsSync(core.componentSpecPath)) return [];

  const merged = resolveSdkDependenciesForCore(core);
  const current = normalizeSdkDependencies(core.componentSpec).sort();
  if (merged.join('|') === current.sort().join('|')) return [];

  const spec = readJson(core.componentSpecPath);
  spec.contracts = spec.contracts ?? {};
  spec.contracts.sdkDependencies = merged;
  if (!dryRun) writeJson(core.componentSpecPath, spec);
  return [toPosix(path.relative(core.packageDir, core.componentSpecPath))];
}

export function ensureSdkInventoryComposition(core, { dryRun = false } = {}) {
  const changes = [];
  if (fs.existsSync(path.join(core.packageDir, 'pubspec.yaml'))) return changes;

  const indexSource = readCoreIndexSource(core);
  const inventoryExports = extractListSdkInventoryExports(indexSource);
  const inventoryPath = path.join(core.packageDir, 'src/composition/sdk-inventory.ts');
  const desired = buildSdkInventorySource(inventoryExports);

  if (!fs.existsSync(inventoryPath)) {
    if (!dryRun) {
      fs.mkdirSync(path.dirname(inventoryPath), { recursive: true });
      fs.writeFileSync(inventoryPath, desired);
    }
    changes.push(toPosix(path.relative(core.packageDir, inventoryPath)));
    return changes;
  }

  const current = readText(inventoryPath);
  if (inventoryExports.listFunctions.length > 0 && (isGenericSdkInventoryStub(current) || current !== desired)) {
    if (!dryRun) fs.writeFileSync(inventoryPath, desired);
    changes.push(toPosix(path.relative(core.packageDir, inventoryPath)));
  }

  return changes;
}

export function ensureCoreCompositionScaffold(core, { dryRun = false } = {}) {
  const changes = [];
  const isFlutter = fs.existsSync(path.join(core.packageDir, 'pubspec.yaml'));
  const srcRoot = fs.existsSync(path.join(core.packageDir, 'src'))
    ? path.join(core.packageDir, 'src')
    : path.join(core.packageDir, 'lib');
  const compositionDir = path.join(srcRoot, 'composition');
  const packageJsonPath = core.packageJsonPath ?? path.join(core.packageDir, 'package.json');

  if (!isFlutter && !fs.existsSync(packageJsonPath)) {
    if (!dryRun) {
      fs.mkdirSync(path.join(core.packageDir, 'src'), { recursive: true });
      if (!fs.existsSync(path.join(core.packageDir, 'src', 'index.ts'))) {
        fs.writeFileSync(path.join(core.packageDir, 'src', 'index.ts'), 'export {};\n');
      }
      writeJson(packageJsonPath, {
        name: core.componentName,
        private: true,
        version: '0.1.0',
        type: 'module',
        exports: {
          '.': './src/index.ts',
        },
      });
    }
    changes.push(toPosix(path.relative(core.packageDir, packageJsonPath)));
  }

  if (isFlutter) {
    if (!dryRun && fs.existsSync(compositionDir)) {
      for (const entry of fs.readdirSync(compositionDir)) {
        if (entry.endsWith('.ts')) {
          fs.unlinkSync(path.join(compositionDir, entry));
          changes.push(`${toPosix(path.relative(core.packageDir, path.join(compositionDir, entry)))} (removed)`);
        }
      }
    }
    const files = {
      'dependency_manifest.dart': 'const sdkworkDependencyCompositionManifestPath = "../../../specs/dependency.composition.json";\n',
      'sdk_inventory.dart': 'List<dynamic> listSdkworkCoreSdkInventory() => const [];\n',
      'module_registry.dart': 'Map<String, dynamic> createSdkworkCoreModuleRegistry() => const {};\n',
      'host_registry.dart': 'Map<String, dynamic> createSdkworkCoreHostRegistry() => const {};\n',
      'composition.dart': 'export "dependency_manifest.dart";\nexport "sdk_inventory.dart";\nexport "module_registry.dart";\nexport "host_registry.dart";\n',
    };
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(compositionDir, name);
      if (fs.existsSync(filePath)) continue;
      if (!dryRun) {
        fs.mkdirSync(compositionDir, { recursive: true });
        fs.writeFileSync(filePath, content);
      }
      changes.push(toPosix(path.relative(core.packageDir, filePath)));
    }
    return changes;
  }

  const files = {
    'dependency-manifest.ts': `export const sdkworkDependencyCompositionManifestPath = "../../../specs/dependency.composition.json" as const;\n`,
    'sdk-inventory.ts': `export function listSdkworkCoreSdkInventory() {\n  return [] as const;\n}\n`,
    'module-registry.ts': `export function createSdkworkCoreModuleRegistry() {\n  return {} as const;\n}\n`,
    'host-registry.ts': `export function createSdkworkCoreHostRegistry() {\n  return {} as const;\n}\n`,
    'index.ts': `export * from "./dependency-manifest.js";\nexport * from "./sdk-inventory.js";\nexport * from "./module-registry.js";\nexport * from "./host-registry.js";\n`,
  };

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(compositionDir, name);
    if (fs.existsSync(filePath)) continue;
    if (!dryRun) {
      fs.mkdirSync(compositionDir, { recursive: true });
      fs.writeFileSync(filePath, content);
    }
    changes.push(toPosix(path.relative(core.packageDir, filePath)));
  }

  if (fs.existsSync(packageJsonPath)) {
    const pkg = readJson(packageJsonPath);
    pkg.exports = pkg.exports ?? {};
    const exportBase = fs.existsSync(path.join(core.packageDir, 'src')) ? './src' : './lib';
    const mapping = {
      '.': `${exportBase}/index.ts`,
      './sdk': `${exportBase}/sdk/index.ts`,
      './modules': `${exportBase}/modules/index.ts`,
      './host': `${exportBase}/host/index.ts`,
      './session': `${exportBase}/session/index.ts`,
      './composition': `${exportBase}/composition/index.ts`,
    };
    for (const [subpath, target] of Object.entries(mapping)) {
      if (pkg.exports[subpath]) continue;
      const absTarget = path.join(core.packageDir, target);
      if (!fs.existsSync(absTarget) && subpath !== '.' && subpath !== './composition') {
        if (!dryRun) {
          fs.mkdirSync(path.dirname(absTarget), { recursive: true });
          fs.writeFileSync(absTarget, 'export {};\n');
        }
        changes.push(toPosix(path.relative(core.packageDir, absTarget)));
      }
      if (!dryRun) pkg.exports[subpath] = { types: target, import: target, default: target };
      changes.push(`${core.componentName} exports[${subpath}]`);
    }
    if (!dryRun) writeJson(packageJsonPath, pkg);
  }

  changes.push(...ensureSdkInventoryComposition(core, { dryRun }));

  return changes;
}

const FORBIDDEN_CAPABILITY_SDK_IMPORT_PATTERNS = [
  /^sdkwork-[^/]+-generated-/u,
  /^@sdkwork\/iam-app-sdk/u,
  /^@sdkwork\/iam-backend-sdk/u,
];

export function isRuntimeIntegrationPackageDirectory(name) {
  return /-commons$/u.test(name);
}

export function isCapabilityPackageDirectory(name) {
  if (isCorePackageDirectory(name)) return false;
  if (/-(?:shell|host)$/.test(name)) return false;
  if (isRuntimeIntegrationPackageDirectory(name)) return false;
  return true;
}

export function isForbiddenCapabilitySdkImport(moduleSpecifier) {
  return FORBIDDEN_CAPABILITY_SDK_IMPORT_PATTERNS.some((pattern) => pattern.test(moduleSpecifier));
}

function listTypeScriptSourceFiles(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      files.push(...listTypeScriptSourceFiles(entryPath));
      continue;
    }
    if (/\.(?:ts|tsx)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(entryPath);
    }
  }
  return files;
}

export function extractImportSpecifiers(sourceText) {
  const specifiers = [];
  const importRe = /import\s+(?:type\s+)?(?:\{[^}]*\}|[^"';\s]+)\s+from\s+["']([^"']+)["']/gu;
  let match = importRe.exec(sourceText);
  while (match) {
    specifiers.push(match[1]);
    match = importRe.exec(sourceText);
  }
  return specifiers;
}

export function validateCapabilitySdkImportBoundary(appRoot, relPrefix) {
  const issues = [];
  const packagesDir = path.join(appRoot, 'packages');
  if (!fs.existsSync(packagesDir)) return issues;

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isCapabilityPackageDirectory(entry.name)) continue;
    const packageDir = path.join(packagesDir, entry.name);
    const srcDir = fs.existsSync(path.join(packageDir, 'src'))
      ? path.join(packageDir, 'src')
      : path.join(packageDir, 'lib');
    for (const filePath of listTypeScriptSourceFiles(srcDir)) {
      const source = readText(filePath);
      for (const specifier of extractImportSpecifiers(source)) {
        if (!isForbiddenCapabilitySdkImport(specifier)) continue;
        issues.push(`${relPrefix}/packages/${entry.name}/${toPosix(path.relative(packageDir, filePath))}: capability package must not import generated SDK module ${specifier}`);
      }
    }
  }

  return issues;
}

export function ensureAppRootComponentSpecPointer(appRoot, { dryRun = false } = {}) {
  const componentSpecPath = path.join(appRoot, 'specs/component.spec.json');
  if (!fs.existsSync(componentSpecPath)) return [];
  const spec = readJson(componentSpecPath);
  spec.contracts = spec.contracts ?? {};
  if (spec.contracts.dependencyComposition === 'specs/dependency.composition.json') return [];
  spec.contracts.dependencyComposition = 'specs/dependency.composition.json';
  if (!dryRun) writeJson(componentSpecPath, spec);
  return ['specs/component.spec.json contracts.dependencyComposition'];
}
