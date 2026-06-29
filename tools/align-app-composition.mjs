#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { findCorePackages } from './lib/app-composition.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: node tools/align-app-composition.mjs --root <repo-path> [--dry-run]

Removes parallel dependency composition manifests and aligns component specs to APP_COMPOSITION_SPEC.md.`);
}

function walkFiles(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, files);
      continue;
    }
    if (predicate(full, entry.name)) files.push(full);
  }
  return files;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function writeJson(filePath, value, dryRun) {
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  if (dryRun) {
    console.log(`[dry-run] would write ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, rendered);
}

function writeText(filePath, text, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] would write ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, text);
}

function deleteFile(filePath, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] would delete ${filePath}`);
    return;
  }
  fs.unlinkSync(filePath);
}

function mapSdkClientToDependency(client) {
  const entry = { workspace: client.workspace };
  if (client.surface) entry.surface = client.surface;
  if (client.credentialMode) entry.credentialMode = client.credentialMode;
  return entry;
}

function normalizeSdkDependencyKey(entry) {
  if (typeof entry === 'string') return entry;
  return entry.workspace ?? '';
}

function findCoreSpecPath(appRoot, corePackageRef) {
  const cores = findCorePackages(appRoot);
  const match = cores.find(
    (core) =>
      core.componentName === corePackageRef
      || core.componentSpec?.component?.name === corePackageRef
      || `@sdkwork/${core.packageName.replace(/^sdkwork-/u, '')}` === corePackageRef,
  );
  return match?.componentSpecPath ?? null;
}

function migrateCompositionManifest(manifestPath, repoRoot, dryRun) {
  const manifest = readJson(manifestPath);
  const appRoot = path.dirname(path.dirname(manifestPath));
  let changes = 0;

  for (const surface of manifest.surfaces ?? []) {
    const coreSpecPath = findCoreSpecPath(appRoot, surface.corePackage);
    if (!coreSpecPath || !fs.existsSync(coreSpecPath)) {
      console.warn(`skip surface ${surface.surface}: core ${surface.corePackage} not found under ${path.relative(repoRoot, appRoot)}`);
      continue;
    }

    const spec = readJson(coreSpecPath);
    spec.contracts ??= {};
    const existing = new Set((spec.contracts.sdkDependencies ?? []).map(normalizeSdkDependencyKey));
    let added = false;

    for (const client of surface.sdkClients ?? []) {
      if (!client.workspace || existing.has(client.workspace)) continue;
      spec.contracts.sdkDependencies ??= [];
      spec.contracts.sdkDependencies.push(mapSdkClientToDependency(client));
      existing.add(client.workspace);
      added = true;
    }

    if (added) {
      writeJson(coreSpecPath, spec, dryRun);
      changes += 1;
      console.log(`migrated sdkDependencies to ${path.relative(repoRoot, coreSpecPath)}`);
    }
  }

  return changes;
}

function alignCompositionSourceImports(filePath, dryRun) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('dependency.composition.json') && !text.includes('DependencyCompositionManifestPath')) {
    return false;
  }
  const next = text
    .replace(/import\s+(\w+)\s+from\s+['"][^'"]*dependency\.composition\.json['"];?\n?/gu, '')
    .replace(/sdkwork\w*DependencyCompositionManifestPath/gu, 'sdkworkComponentSpecPath')
    .replaceAll('dependency.composition.json', 'component.spec.json');
  if (next === text) return false;
  writeText(filePath, next, dryRun);
  return true;
}

function alignCoreSdkDependencySurfaces(filePath, dryRun) {
  const spec = readJson(filePath);
  const deps = spec.contracts?.sdkDependencies;
  if (!Array.isArray(deps) || deps.length === 0) return false;

  const packageDir = path.dirname(path.dirname(filePath));
  const packageName = path.basename(packageDir);
  const isAdminCore = /-admin-core$|_admin_core$/u.test(packageName);
  if (!isAdminCore) return false;

  let changed = false;
  for (const entry of deps) {
    if (typeof entry !== 'object' || entry === null || entry.surface) continue;
    entry.surface = 'backend-api';
    entry.credentialMode ??= 'authenticated-backend-admin';
    changed = true;
  }

  if (changed) writeJson(filePath, spec, dryRun);
  return changed;
}

function alignComponentSpec(filePath, dryRun) {
  const spec = readJson(filePath);
  let changed = false;

  if (spec.contracts?.dependencyComposition) {
    delete spec.contracts.dependencyComposition;
    changed = true;
  }

  if (Array.isArray(spec.canonicalSpecs)) {
    for (const entry of spec.canonicalSpecs) {
      if (entry.file === 'APP_DEPENDENCY_COMPOSITION_SPEC.md') {
        entry.file = 'APP_COMPOSITION_SPEC.md';
        entry.path = entry.path.replace(
          'APP_DEPENDENCY_COMPOSITION_SPEC.md',
          'APP_COMPOSITION_SPEC.md',
        );
        entry.purpose = 'Native-authority application composition and core-package import entrypoints.';
        changed = true;
      }
    }
  }

  if (changed) writeJson(filePath, spec, dryRun);
  return changed;
}

function alignDependencyManifestTs(filePath, dryRun) {
  const rel = path.basename(path.dirname(path.dirname(filePath)));
  const isCorePackageSpec = fs.existsSync(path.join(path.dirname(path.dirname(filePath)), 'specs/component.spec.json'));
  const componentSpecPath = isCorePackageSpec
    ? '../../specs/component.spec.json'
    : '../../../specs/component.spec.json';

  const next = `export const sdkworkComponentSpecPath = "${componentSpecPath}" as const;\n`;
  const current = fs.readFileSync(filePath, 'utf8');
  if (current === next) return false;
  writeText(filePath, next, dryRun);
  return true;
}

function alignDependencyManifestDart(filePath, dryRun) {
  const next = "const sdkworkComponentSpecPath = '../../../specs/component.spec.json';\n";
  const current = fs.readFileSync(filePath, 'utf8');
  if (current === next) return false;
  writeText(filePath, next, dryRun);
  return true;
}

function alignCompositionIndexExport(filePath, dryRun) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('DependencyCompositionManifestPath')) return false;
  const next = text
    .replace(/sdkworkIamPcAdminDependencyCompositionManifestPath/gu, 'sdkworkComponentSpecPath')
    .replace(/sdkworkDependencyCompositionManifestPath/gu, 'sdkworkComponentSpecPath');
  if (next === text) return false;
  writeText(filePath, next, dryRun);
  return true;
}

function alignMarkdownText(filePath, dryRun) {
  const text = fs.readFileSync(filePath, 'utf8');
  if (!text.includes('dependency.composition.json') && !text.includes('APP_DEPENDENCY_COMPOSITION_SPEC')) {
    return false;
  }
  const next = text
    .replaceAll('specs/dependency.composition.json', 'specs/component.spec.json#contracts.sdkDependencies')
    .replaceAll('APP_DEPENDENCY_COMPOSITION_SPEC.md', 'APP_COMPOSITION_SPEC.md')
    .replace(/Dependency composition:.*\n/u, 'Composition authority: `specs/component.spec.json` and `*-core/specs/component.spec.json#contracts.sdkDependencies`\n');
  if (next === text) return false;
  writeText(filePath, next, dryRun);
  return true;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  const repoRoot = args.root;
  let changes = 0;

  const compositionManifests = walkFiles(repoRoot, (_full, name) => name === 'dependency.composition.json');
  for (const filePath of compositionManifests) {
    changes += migrateCompositionManifest(filePath, repoRoot, args.dryRun);
  }

  for (const filePath of compositionManifests) {
    deleteFile(filePath, args.dryRun);
    changes += 1;
    console.log(`removed ${path.relative(repoRoot, filePath)}`);
  }

  for (const filePath of walkFiles(repoRoot, (_full, name) => name === 'component.spec.json')) {
    if (alignComponentSpec(filePath, args.dryRun)) {
      changes += 1;
      console.log(`aligned ${path.relative(repoRoot, filePath)}`);
    }
    if (alignCoreSdkDependencySurfaces(filePath, args.dryRun)) {
      changes += 1;
      console.log(`fixed sdkDependencies surfaces in ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const filePath of walkFiles(repoRoot, (_full, name) => name === 'dependency-manifest.ts')) {
    if (alignDependencyManifestTs(filePath, args.dryRun)) {
      changes += 1;
      console.log(`aligned ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const filePath of walkFiles(repoRoot, (_full, name) => name === 'dependency_manifest.dart')) {
    if (alignDependencyManifestDart(filePath, args.dryRun)) {
      changes += 1;
      console.log(`aligned ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const filePath of walkFiles(
    repoRoot,
    (full, name) => name === 'index.ts' && full.includes(`${path.sep}composition${path.sep}`),
  )) {
    if (alignCompositionIndexExport(filePath, args.dryRun)) {
      changes += 1;
      console.log(`aligned ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const filePath of walkFiles(
    repoRoot,
    (full, name) =>
      (name.endsWith('.ts') || name.endsWith('.tsx'))
      && full.includes(`${path.sep}composition${path.sep}`),
  )) {
    if (alignCompositionSourceImports(filePath, args.dryRun)) {
      changes += 1;
      console.log(`aligned ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const filePath of walkFiles(repoRoot, (_full, name) => name === 'README.md' || name === 'AGENTS.md')) {
    if (alignMarkdownText(filePath, args.dryRun)) {
      changes += 1;
      console.log(`aligned ${path.relative(repoRoot, filePath)}`);
    }
  }

  for (const filePath of walkFiles(
    repoRoot,
    (full, name) => name === 'pnpm-workspace.yaml' && full.includes(`${path.sep}apps${path.sep}`),
  )) {
    if (fs.existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
      deleteFile(filePath, args.dryRun);
      changes += 1;
      console.log(`removed nested ${path.relative(repoRoot, filePath)}`);
    }
  }

  console.log(`align-app-composition complete (${changes} changes)`);
}

main();
