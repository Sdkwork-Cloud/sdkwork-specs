#!/usr/bin/env node
/**
 * Synchronizes derived route-manifest operationIds with repository OpenAPI authorities.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  openApiAuthorityEntries,
  walkOpenApiFiles,
} from './lib/http-response-envelope-patterns.mjs';
import { openApiOperationEntriesFromText } from './lib/openapi-operation-utils.mjs';
import { normalizeRoutePath } from './lib/route-registry.mjs';

function routeKey(surface, method, routePath) {
  return [surface, String(method).toUpperCase(), normalizeRoutePath(routePath)].join('\0');
}

function authorityIndex(repoRoot) {
  const candidates = new Map();
  for (const authority of openApiAuthorityEntries(walkOpenApiFiles(repoRoot))) {
    const parsed = openApiOperationEntriesFromText(fs.readFileSync(authority.file, 'utf8'));
    for (const entry of parsed.entries) {
      if (!entry.operation.operationId) {
        continue;
      }
      const key = routeKey(authority.surface, entry.method, entry.routePath);
      const operationIds = candidates.get(key) ?? new Set();
      operationIds.add(entry.operation.operationId);
      candidates.set(key, operationIds);
    }
  }
  return candidates;
}

function routeManifestFiles(repoRoot) {
  const root = path.join(repoRoot, 'sdks', '_route-manifests');
  if (!fs.existsSync(root)) {
    return [];
  }
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (/\.route-manifest\.json$/u.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };
  visit(root);
  return files;
}

function alignRepository(repoRoot, dryRun) {
  const index = authorityIndex(repoRoot);
  const ambiguities = [];
  let changedFiles = 0;
  let changes = 0;
  for (const file of routeManifestFiles(repoRoot)) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
    const routes = Array.isArray(manifest.routes) ? manifest.routes : [];
    let fileChanges = 0;
    for (const route of routes) {
      const surface = route.apiSurface ?? route.surface ?? manifest.surface ?? manifest.apiSurface;
      const operationIds = index.get(routeKey(surface, route.method, route.path ?? route.fullPath));
      if (!operationIds || operationIds.size === 0) {
        continue;
      }
      if (operationIds.size > 1) {
        ambiguities.push(
          `${path.relative(repoRoot, file)} ${route.method} ${route.path ?? route.fullPath}: ${[...operationIds].join(', ')}`,
        );
        continue;
      }
      const [operationId] = operationIds;
      if (route.operationId === operationId) {
        continue;
      }
      route.operationId = operationId;
      fileChanges += 1;
    }
    if (fileChanges > 0) {
      changedFiles += 1;
      changes += fileChanges;
      const relativeFile = path.relative(repoRoot, file).replace(/\\/gu, '/');
      console.log(`${dryRun ? 'would align' : 'aligned'} ${path.basename(repoRoot)}/${relativeFile} (${fileChanges} changes)`);
      if (!dryRun) {
        fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      }
    }
  }
  return { changedFiles, changes, ambiguities };
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values.workspace) {
    console.log('Usage: node tools/align-route-manifest-operation-ids-workspace.mjs --workspace <sdkwork-space-root> [--dry-run]');
    process.exit(values.workspace ? 0 : 1);
  }

  const workspaceRoot = path.resolve(values.workspace);
  let changedFiles = 0;
  let changes = 0;
  const ambiguities = [];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const result = alignRepository(path.join(workspaceRoot, entry.name), values['dry-run']);
    changedFiles += result.changedFiles;
    changes += result.changes;
    ambiguities.push(...result.ambiguities.map((item) => `${entry.name}/${item}`));
  }
  if (ambiguities.length > 0) {
    console.error('route manifest operationId alignment failed: ambiguous OpenAPI authority mappings');
    for (const ambiguity of ambiguities) {
      console.error(`- ${ambiguity}`);
    }
    process.exit(1);
  }
  console.log(`${values['dry-run'] ? 'would align' : 'aligned'} ${changedFiles} files (${changes} changes)`);
}

main();
