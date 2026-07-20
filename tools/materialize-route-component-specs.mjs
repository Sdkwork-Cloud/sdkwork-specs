#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { discoverRouteCrates, readText, resolveApplicationCode } from './api-assembly-lib.mjs';

const CANONICAL_SPECS = [
  ['CODE_STYLE_SPEC.md', 'Authored source structure and generated code boundaries.'],
  ['NAMING_SPEC.md', 'Canonical SDKWork naming rules.'],
  ['API_SPEC.md', 'OpenAPI authority and route manifest rules.'],
  ['WEB_FRAMEWORK_SPEC.md', 'Mandatory Web Framework integration for HTTP surfaces.'],
  ['WEB_BACKEND_SPEC.md', 'HTTP backend route boundary rules.'],
  ['SDK_WORKSPACE_GENERATION_SPEC.md', 'Route manifest and SDK generation ownership.'],
  ['RUST_CODE_SPEC.md', 'Rust crate rules.'],
  ['TEST_SPEC.md', 'Route contract and composition verification.'],
];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(readText(filePath).replace(/^\uFEFF/u, ''));
}

function titleCase(value) {
  return value.split('-').filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function packageVersion(root, memberDir) {
  const cargo = readText(path.join(root, memberDir, 'Cargo.toml'));
  return /^\s*version\s*=\s*"([^"]+)"/mu.exec(cargo)?.[1] ?? '0.1.0';
}

function repositoryDomain(root, applicationCode) {
  const rootSpec = readJson(path.join(root, 'specs', 'component.spec.json'));
  const declared = String(rootSpec?.component?.domain ?? '').trim();
  if (declared) return declared;

  const cratesRoot = path.join(root, 'crates');
  if (fs.existsSync(cratesRoot)) {
    for (const entry of fs.readdirSync(cratesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('sdkwork-routes-')) continue;
      const sibling = readJson(path.join(cratesRoot, entry.name, 'specs', 'component.spec.json'));
      const domain = String(sibling?.component?.domain ?? '').trim();
      if (domain) return domain;
    }
  }
  return applicationCode;
}

function publicRuntimeEntrypoints(root, memberDir) {
  const srcRoot = path.join(root, memberDir, 'src');
  if (!fs.existsSync(srcRoot)) return [];
  const names = new Set();
  for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== '.rs') continue;
    const source = readText(path.join(srcRoot, entry.name));
    for (const match of source.matchAll(/pub(?:\([^)]*\))?\s+(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/gu)) {
      if (/(?:router|routes|mount|manifest|wrap|serve|bootstrap)/u.test(match[1])) {
        names.add(match[1]);
      }
    }
  }
  return [...names].sort();
}

function capabilityFromPackage(packageName, surface) {
  return packageName
    .replace(/^sdkwork-routes-/u, '')
    .replace(new RegExp(`-${surface}$`, 'u'), '');
}

function renderRouteComponent(root, applicationCode, route) {
  const capability = capabilityFromPackage(route.packageName, route.surface);
  return {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: route.packageName,
      displayName: `SDKWork ${titleCase(capability)} ${titleCase(route.surface)} Routes`,
      version: packageVersion(root, route.memberDir),
      type: 'rust-route-crate',
      root: route.memberDir,
      domain: repositoryDomain(root, applicationCode),
      capability,
      surface: route.surface,
      languages: ['rust'],
      generated: false,
      manifests: ['Cargo.toml'],
    },
    canonicalSpecs: CANONICAL_SPECS.map(([file, purpose]) => ({
      file,
      path: `../../../sdkwork-specs/${file}`,
      purpose,
    })),
    contracts: {
      layerRole: 'backend-route',
      publicExports: ['.'],
      providedPorts: [],
      requiredPorts: [],
      runtimeEntrypoints: publicRuntimeEntrypoints(root, route.memberDir),
      routeManifest: `sdks/_route-manifests/${route.surface}/${route.packageName}.route-manifest.json`,
      sdkClients: [],
      sdkDependencies: [],
      dependencyApiExports: [],
      dependencyApiSurfaces: [],
      events: [],
      configKeys: [],
    },
    verification: {
      commands: [`cargo test -p ${route.packageName}`],
    },
  };
}

export function materializeRouteComponentSpecs(root, { write = false } = {}) {
  const resolved = path.resolve(root);
  if (path.basename(resolved) === 'sdkwork-api-cloud-gateway') {
    return { root: resolved, created: [], skipped: true };
  }
  const applicationCode = resolveApplicationCode(resolved);
  const created = [];
  for (const route of discoverRouteCrates(resolved, applicationCode)) {
    const target = path.join(resolved, route.componentRef);
    if (fs.existsSync(target)) continue;
    created.push(route.componentRef);
    if (!write) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(renderRouteComponent(resolved, applicationCode, route), null, 2)}\n`, 'utf8');
  }
  return { root: resolved, created, skipped: false };
}

function usage() {
  return 'Usage: node tools/materialize-route-component-specs.mjs (--root <application> | --workspace <workspace>) [--write]';
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      workspace: { type: 'string' },
      write: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || Boolean(values.root) === Boolean(values.workspace)) {
    console.log(usage());
    process.exitCode = values.help ? 0 : 2;
    return;
  }
  const roots = values.root
    ? [path.resolve(values.root)]
    : listWorkspaceRepositories(path.resolve(values.workspace), { prefix: 'sdkwork-' });
  let total = 0;
  for (const root of roots) {
    let result;
    try {
      result = materializeRouteComponentSpecs(root, { write: values.write });
    } catch (error) {
      console.error(`fail ${path.basename(root)}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
    if (result.skipped || result.created.length === 0) continue;
    total += result.created.length;
    console.log(`${values.write ? 'create' : 'would create'} ${path.basename(root)} (${result.created.length})`);
    for (const file of result.created) console.log(`  - ${file}`);
  }
  console.log(`\nRoute component specs ${values.write ? 'created' : 'planned'}: ${total}`);
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) main();
