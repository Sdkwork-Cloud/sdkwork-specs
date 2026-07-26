#!/usr/bin/env node
/**
 * Validates canonical dependency API prefix coverage in component specs.
 * See API_SPEC.md section 4.1.1 and COMPONENT_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'artifacts',
  'dist',
  'external',
  'generated',
  'node_modules',
  'target',
  'vendor',
]);
const SYNTHETIC_PREFIX = /^\/(?:__sdkwork|proxy|gateway|platform)(?:\/|$)/u;

function componentSpecFiles(root) {
  const files = [];
  function visit(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (entry.name === 'component.spec.json' && path.basename(current) === 'specs') {
        files.push(absolute);
      }
    }
  }
  visit(root);
  return files;
}

function duplicateValues(values) {
  const seen = new Set();
  return [...new Set(values.filter((value) => seen.has(value) || !seen.add(value)))];
}

function validateComponentSpec(file, root) {
  const issues = [];
  const relative = path.relative(root, file).replace(/\\/gu, '/');
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return [`${relative}: invalid JSON (${error.message})`];
  }

  const surfaces = Array.isArray(spec.apiSurfaces) ? spec.apiSurfaces : [];
  for (const surface of surfaces) {
    const prefix = surface?.prefix;
    if (typeof prefix === 'string' && SYNTHETIC_PREFIX.test(prefix)) {
      issues.push(`${relative}: apiSurfaces contains synthetic prefix ${prefix}`);
    }
  }

  const dependencies = Array.isArray(spec.dependencies) ? spec.dependencies : [];
  for (const dependency of dependencies) {
    const serviceId = dependency?.serviceId;
    const declared = Array.isArray(dependency?.apiPrefixes) ? dependency.apiPrefixes : null;
    if (!serviceId || declared === null) continue;

    const registered = surfaces
      .filter((surface) => surface?.dependencyServiceId === serviceId)
      .map((surface) => surface?.prefix)
      .filter((prefix) => typeof prefix === 'string');
    const declaredDuplicates = duplicateValues(declared);
    const registeredDuplicates = duplicateValues(registered);
    const declaredSet = new Set(declared);
    const registeredSet = new Set(registered);
    const missing = declared.filter((prefix) => !registeredSet.has(prefix));
    const unexpected = registered.filter((prefix) => !declaredSet.has(prefix));

    for (const prefix of declared) {
      if (typeof prefix !== 'string' || !prefix.startsWith('/')) {
        issues.push(`${relative}: ${serviceId} declares invalid apiPrefix ${JSON.stringify(prefix)}`);
      } else if (SYNTHETIC_PREFIX.test(prefix)) {
        issues.push(`${relative}: ${serviceId} declares synthetic apiPrefix ${prefix}`);
      }
    }
    if (declaredDuplicates.length > 0) {
      issues.push(`${relative}: ${serviceId} duplicates apiPrefixes ${declaredDuplicates.join(', ')}`);
    }
    if (registeredDuplicates.length > 0) {
      issues.push(`${relative}: ${serviceId} duplicates apiSurfaces ${registeredDuplicates.join(', ')}`);
    }
    if (missing.length > 0) {
      issues.push(`${relative}: ${serviceId} apiSurfaces missing ${missing.join(', ')}`);
    }
    if (unexpected.length > 0) {
      issues.push(`${relative}: ${serviceId} apiSurfaces not declared in apiPrefixes ${unexpected.join(', ')}`);
    }
  }
  return issues;
}

export function scanComponentApiSurfacePrefixes(root) {
  return componentSpecFiles(root).flatMap((file) => validateComponentSpec(file, root));
}

function scanWorkspace(workspace) {
  const issues = [];
  for (const entry of fs.readdirSync(workspace, { withFileTypes: true })) {
    if (!entry.isDirectory() || IGNORED_DIRECTORIES.has(entry.name)) continue;
    const root = path.join(workspace, entry.name);
    issues.push(...scanComponentApiSurfacePrefixes(root).map((issue) => `${entry.name}: ${issue}`));
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: SPECS_ROOT },
      workspace: { type: 'string' },
    },
  });
  const root = path.resolve(values.root);
  const issues = values.workspace
    ? scanWorkspace(path.resolve(values.workspace))
    : scanComponentApiSurfacePrefixes(root);
  if (issues.length > 0) {
    console.error('component API surface prefix check failed:');
    for (const issue of issues.slice(0, 200)) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log('component API surface prefix check passed');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
