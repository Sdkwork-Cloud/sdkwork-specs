#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { assemblyCrateDir, readText, resolveApplicationCode } from './api-assembly-lib.mjs';
import { bootstrapApiAssemblyRepo } from './bootstrap-api-assembly-repo.mjs';

const SKIP_DIRS = new Set([
  '.git', '.runtime', 'artifacts', 'dist', 'external', 'generated', 'node_modules',
  'target', 'target-alt', 'target-verify', 'vendor',
]);
const TEXT_EXTENSIONS = new Set([
  '.cfg', '.css', '.env', '.html', '.ini', '.js', '.json', '.md', '.mjs', '.ps1',
  '.rs', '.sh', '.sql', '.toml', '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);

function assertOwnedCratePath(repoRoot, target) {
  const cratesRoot = path.resolve(repoRoot, 'crates');
  const resolved = path.resolve(target);
  if (!resolved.startsWith(`${cratesRoot}${path.sep}`)) {
    throw new Error(`refusing mutation outside ${cratesRoot}: ${resolved}`);
  }
}

function walkTextFiles(root, files = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(full, files);
    } else if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && entry.name !== 'migrate-application-gateway-hosting.mjs') {
      if (fs.statSync(full).size <= 2 * 1024 * 1024) files.push(full);
    }
  }
  return files;
}

function replaceRepositoryText(repoRoot, replacements, write) {
  const changed = [];
  for (const file of walkTextFiles(repoRoot)) {
    const before = fs.readFileSync(file, 'utf8');
    let after = before;
    for (const [from, to] of replacements) after = after.split(from).join(to);
    if (after === before) continue;
    changed.push(path.relative(repoRoot, file).replaceAll('\\', '/'));
    if (write) fs.writeFileSync(file, after, 'utf8');
  }
  return changed;
}

function findLegacyStandalone(root, applicationCode) {
  const cratesRoot = path.join(root, 'crates');
  if (!fs.existsSync(cratesRoot)) return null;
  const exact = path.join(cratesRoot, `sdkwork-${applicationCode}-standalone-gateway`);
  if (fs.existsSync(exact)) return exact;
  const candidates = fs.readdirSync(cratesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^sdkwork-(?!api-)[a-z0-9-]+-standalone-gateway$/u.test(name));
  return candidates.length === 1 ? path.join(cratesRoot, candidates[0]) : null;
}

function updateComponentIdentity(componentPath, fields, write) {
  if (!fs.existsSync(componentPath)) return false;
  const value = JSON.parse(readText(componentPath).replace(/^\uFEFF/u, ''));
  value.component ??= {};
  Object.assign(value.component, fields);
  value.contracts ??= {};
  value.contracts.layerRole = fields.type === 'rust-api-assembly' ? 'runtime-composition' : 'runtime-gateway';
  if (write) fs.writeFileSync(componentPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return true;
}

function repairDuplicateAssemblyEntrypoints(repoRoot, applicationCode, write) {
  const bootstrapPath = path.join(repoRoot, assemblyCrateDir(applicationCode), 'src', 'bootstrap.rs');
  if (!fs.existsSync(bootstrapPath)) return false;
  const source = readText(bootstrapPath);
  const token = 'fn assemble_api_router(';
  const first = source.indexOf(token);
  const second = first < 0 ? -1 : source.indexOf(token, first + token.length);
  if (second < 0) return false;

  const replacement = 'fn assemble_business_routes(';
  let updated = `${source.slice(0, first)}${replacement}${source.slice(first + token.length)}`;
  const shiftedSecond = second + (replacement.length - token.length);
  const wrapperCall = updated.indexOf('assemble_api_router(', shiftedSecond + token.length);
  if (wrapperCall < 0) {
    throw new Error('duplicate assemble_api_router definitions do not contain a wrapper delegation call');
  }
  updated = `${updated.slice(0, wrapperCall)}assemble_business_routes(${updated.slice(wrapperCall + 'assemble_api_router('.length)}`;
  if (write) fs.writeFileSync(bootstrapPath, updated, 'utf8');
  return true;
}

export function migrateApplicationGatewayHosting(root, { write = false } = {}) {
  const repoRoot = path.resolve(root);
  if (path.basename(repoRoot) === 'sdkwork-api-cloud-gateway') {
    return { root: repoRoot, skipped: true, actions: [], changedFiles: [] };
  }
  const applicationCode = resolveApplicationCode(repoRoot);
  const cratesRoot = path.join(repoRoot, 'crates');
  const legacyAssemblyName = `sdkwork-${applicationCode}-gateway-assembly`;
  const canonicalAssemblyName = `sdkwork-api-${applicationCode}-assembly`;
  const legacyAssembly = path.join(cratesRoot, legacyAssemblyName);
  const canonicalAssembly = path.join(repoRoot, assemblyCrateDir(applicationCode));
  const legacyStandalone = findLegacyStandalone(repoRoot, applicationCode);
  const canonicalStandaloneName = `sdkwork-api-${applicationCode}-standalone-gateway`;
  const canonicalStandalone = path.join(cratesRoot, canonicalStandaloneName);
  const actions = [];
  const replacements = [
    ['assemble_application_business_router_with_service', 'assemble_business_router_with_service'],
    ['assemble_application_business_router', 'assemble_business_router'],
    ['assemble_application_router', 'assemble_api_router'],
    ['ApplicationAssembly', 'ApiAssembly'],
  ];

  if (fs.existsSync(legacyAssembly)) {
    assertOwnedCratePath(repoRoot, legacyAssembly);
    assertOwnedCratePath(repoRoot, canonicalAssembly);
    if (fs.existsSync(canonicalAssembly)) {
      const manifest = JSON.parse(readText(path.join(canonicalAssembly, 'assembly-manifest.json')) || '{}');
      if (manifest.kind !== 'sdkwork.api.assembly' || manifest.applicationCode !== applicationCode) {
        throw new Error(`canonical assembly target is not replaceable materialized output: ${canonicalAssembly}`);
      }
      actions.push(`replace materialized ${canonicalAssemblyName} with authored ${legacyAssemblyName}`);
      if (write) fs.rmSync(canonicalAssembly, { recursive: true, force: false });
    } else {
      actions.push(`rename ${legacyAssemblyName} to ${canonicalAssemblyName}`);
    }
    if (write) fs.renameSync(legacyAssembly, canonicalAssembly);
    replacements.push(
      [legacyAssemblyName, canonicalAssemblyName],
      [legacyAssemblyName.replaceAll('-', '_'), canonicalAssemblyName.replaceAll('-', '_')],
    );
  }

  if (legacyStandalone && path.resolve(legacyStandalone) !== path.resolve(canonicalStandalone)) {
    assertOwnedCratePath(repoRoot, legacyStandalone);
    assertOwnedCratePath(repoRoot, canonicalStandalone);
    if (fs.existsSync(canonicalStandalone)) {
      throw new Error(`canonical standalone gateway already exists beside legacy host: ${canonicalStandalone}`);
    }
    const legacyName = path.basename(legacyStandalone);
    actions.push(`rename ${legacyName} to ${canonicalStandaloneName}`);
    if (write) fs.renameSync(legacyStandalone, canonicalStandalone);
    replacements.push(
      [legacyName, canonicalStandaloneName],
      [legacyName.replaceAll('-', '_'), canonicalStandaloneName.replaceAll('-', '_')],
    );
  }

  const changedFiles = replaceRepositoryText(repoRoot, replacements, write);
  if (repairDuplicateAssemblyEntrypoints(repoRoot, applicationCode, write)) {
    changedFiles.push(`${assemblyCrateDir(applicationCode)}/src/bootstrap.rs`);
  }

  if (fs.existsSync(canonicalAssembly)) {
    updateComponentIdentity(
      path.join(canonicalAssembly, 'specs', 'component.spec.json'),
      {
        name: canonicalAssemblyName,
        type: 'rust-api-assembly',
        root: `crates/${canonicalAssemblyName}`,
        capability: 'api-assembly',
        surface: 'api-assembly',
      },
      write,
    );
  }
  if (fs.existsSync(canonicalStandalone)) {
    updateComponentIdentity(
      path.join(canonicalStandalone, 'specs', 'component.spec.json'),
      {
        name: canonicalStandaloneName,
        type: 'rust-api-standalone-gateway',
        root: `crates/${canonicalStandaloneName}`,
        capability: 'api-gateway',
        surface: 'gateway-api',
      },
      write,
    );
  }

  let bootstrap = null;
  if (write && actions.length > 0) bootstrap = bootstrapApiAssemblyRepo(repoRoot);
  return { root: repoRoot, applicationCode, skipped: false, actions, changedFiles, bootstrap };
}

function usage() {
  return 'Usage: node tools/migrate-application-gateway-hosting.mjs (--root <application> | --workspace <workspace>) [--write]';
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
  let migrated = 0;
  const failures = [];
  for (const root of roots) {
    let result;
    try {
      result = migrateApplicationGatewayHosting(root, { write: values.write });
    } catch (error) {
      failures.push(`${path.basename(root)}: ${error.message}`);
      continue;
    }
    if (result.actions.length === 0 && result.changedFiles.length === 0) continue;
    migrated += 1;
    console.log(`${values.write ? 'migrate' : 'would migrate'} ${path.basename(root)}`);
    for (const action of result.actions) console.log(`  - ${action}`);
    if (result.changedFiles.length > 0) console.log(`  - rewrite ${result.changedFiles.length} owned text files`);
    if (result.bootstrap && !result.bootstrap.ok) {
      failures.push(`${path.basename(root)}: ${(result.bootstrap.errors ?? []).join('; ')}`);
    }
  }
  console.log(`\nRepositories ${values.write ? 'migrated' : 'planned'}: ${migrated}`);
  console.log(`Failures: ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  if (failures.length > 0) process.exitCode = 1;
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) main();
