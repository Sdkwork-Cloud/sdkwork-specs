#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { discoverRouteCrates, readText, resolveApplicationCode } from './api-assembly-lib.mjs';
import { bootstrapApiAssemblyRepo } from './bootstrap-api-assembly-repo.mjs';

function isDescriptorOnly(root, route) {
  const srcRoot = path.join(root, route.memberDir, 'src');
  if (!fs.existsSync(srcRoot)) return false;
  const source = fs.readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.rs')
    .map((entry) => readText(path.join(srcRoot, entry.name)))
    .join('\n');
  const emptyMount = /pub\s+fn\s+gateway_mount\s*\(\s*\)\s*->\s*(?:axum::)?Router\s*\{\s*(?:axum::)?Router::new\(\)\s*\}/u.test(source);
  const executableRoutes = /\.route\s*\(|\.nest\s*\(|route_service\s*\(/u.test(source);
  const executableBuilder = /pub\s+(?:async\s+)?fn\s+(?:build|create)_[a-zA-Z0-9_]*router/u.test(source);
  return emptyMount && !executableRoutes && !executableBuilder;
}

function removeCargoReferences(root, route, write) {
  const packageNames = new Set([route.packageName, route.libName]);
  let changed = 0;
  const cargoFiles = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (new Set(['.git', 'node_modules', 'target', 'generated', 'external', 'vendor']).has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'Cargo.toml') cargoFiles.push(full);
    }
  }
  walk(root);
  for (const file of cargoFiles) {
    if (file.startsWith(path.join(root, route.memberDir))) continue;
    const before = readText(file);
    const lines = before.split(/\r?\n/u).filter((line) => {
      if (line.includes(`"${route.memberDir}"`)) return false;
      const key = /^\s*([a-zA-Z0-9_-]+)(?:\.workspace)?\s*=/u.exec(line)?.[1];
      return !key || !packageNames.has(key);
    });
    const after = `${lines.join('\n').replace(/\n{3,}/gu, '\n\n').trimEnd()}\n`;
    if (after === before) continue;
    changed += 1;
    if (write) fs.writeFileSync(file, after, 'utf8');
  }
  return changed;
}

function removeRouteManifestProjection(root, route, write) {
  const target = path.join(root, 'sdks', '_route-manifests', route.surface, `${route.packageName}.route-manifest.json`);
  if (!fs.existsSync(target)) return false;
  if (write) fs.rmSync(target);
  return true;
}

export function cleanupDescriptorOnlyRouteCrates(root, { write = false } = {}) {
  const resolved = path.resolve(root);
  if (path.basename(resolved) === 'sdkwork-api-cloud-gateway') return { root: resolved, removed: [] };
  const applicationCode = resolveApplicationCode(resolved);
  const removed = [];
  for (const route of discoverRouteCrates(resolved, applicationCode)) {
    if (!isDescriptorOnly(resolved, route)) continue;
    const cratePath = path.resolve(resolved, route.memberDir);
    const cratesRoot = path.resolve(resolved, 'crates');
    if (!cratePath.startsWith(`${cratesRoot}${path.sep}`)) throw new Error(`refusing removal outside crates/: ${cratePath}`);
    const cargoFilesChanged = removeCargoReferences(resolved, route, write);
    const manifestRemoved = removeRouteManifestProjection(resolved, route, write);
    if (write) fs.rmSync(cratePath, { recursive: true, force: false });
    removed.push({ packageName: route.packageName, memberDir: route.memberDir, cargoFilesChanged, manifestRemoved });
  }
  if (write && removed.length > 0) bootstrapApiAssemblyRepo(resolved);
  return { root: resolved, applicationCode, removed };
}

function usage() {
  return 'Usage: node tools/cleanup-descriptor-only-route-crates.mjs (--root <repo> | --workspace <workspace>) [--write]';
}

function main() {
  const { values } = parseArgs({ options: {
    root: { type: 'string' }, workspace: { type: 'string' }, write: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false },
  } });
  if (values.help || Boolean(values.root) === Boolean(values.workspace)) {
    console.log(usage()); process.exitCode = values.help ? 0 : 2; return;
  }
  const roots = values.root ? [path.resolve(values.root)] : listWorkspaceRepositories(path.resolve(values.workspace), { prefix: 'sdkwork-' });
  let count = 0;
  for (const root of roots) {
    const result = cleanupDescriptorOnlyRouteCrates(root, { write: values.write });
    if (result.removed.length === 0) continue;
    count += result.removed.length;
    console.log(`${values.write ? 'remove' : 'would remove'} ${path.basename(root)}`);
    for (const item of result.removed) console.log(`  - ${item.memberDir}`);
  }
  console.log(`\nDescriptor-only route crates ${values.write ? 'removed' : 'planned'}: ${count}`);
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) main();
