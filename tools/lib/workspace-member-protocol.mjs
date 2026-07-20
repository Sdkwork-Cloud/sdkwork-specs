#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { readJson, toPosix } from './app-composition.mjs';
import {
  buildWorkspaceCatalog,
  buildWorkspacePackages,
  isSiblingPackageEntry,
  loadConsumerOverlay,
  parsePnpmWorkspaceCatalog,
  parsePnpmWorkspacePackages,
  renderPnpmWorkspace,
  specsRoot,
} from './workspace-registry.mjs';

const FORBIDDEN_MEMBER_PROTOCOL_RE =
  /^(?:file|link):(?:\.\.\/|\.\/|\.\.(?:\/|\\))(?:sdkwork-[a-z0-9-]+|packages\/)/u;

const SDKWORK_PACKAGE_NAME_RE = /^@sdkwork\/|^sdkwork-/u;

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function listWorkspacePackageDirs(repoRoot) {
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return [];

  const text = readText(workspacePath);
  const packageEntries = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^packages:\s*$/u.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^[A-Za-z0-9_./-]+:\s*$/u.test(line) && !line.startsWith(' ')) {
      break;
    }
    const match = line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/u);
    if (inPackages && match) packageEntries.push(match[1]);
  }

  const dirs = new Set();
  for (const entry of packageEntries) {
    if (entry.startsWith('../')) continue;
    if (entry.includes('*')) {
      const base = path.resolve(repoRoot, entry.replace(/\/?\*+$/u, ''));
      if (!base.startsWith(path.resolve(repoRoot)) || !fs.existsSync(base)) continue;
      for (const child of fs.readdirSync(base, { withFileTypes: true })) {
        if (!child.isDirectory()) continue;
        dirs.add(path.join(base, child.name));
      }
      continue;
    }
    const resolved = path.resolve(repoRoot, entry);
    if (!resolved.startsWith(path.resolve(repoRoot))) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      dirs.add(resolved);
    }
  }
  return [...dirs];
}

function dependencyEntries(packageJson) {
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  const entries = [];
  for (const section of sections) {
    const block = packageJson?.[section];
    if (!block || typeof block !== 'object') continue;
    for (const [name, value] of Object.entries(block)) {
      if (typeof value !== 'string') continue;
      entries.push({ section, name, value });
    }
  }
  return entries;
}

export function planWorkspaceMemberProtocolAlignment(repoRoot) {
  const changes = [];
  for (const packageDir of listWorkspacePackageDirs(repoRoot)) {
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;
    const packageJson = readJson(packageJsonPath);
    const updates = [];

    for (const { section, name, value } of dependencyEntries(packageJson)) {
      if (!SDKWORK_PACKAGE_NAME_RE.test(name) || value !== '*') continue;
      packageJson[section][name] = 'workspace:*';
      updates.push(`${section}.${name}: * -> workspace:*`);
    }

    if (updates.length > 0) {
      changes.push({
        packageJson,
        packageJsonPath,
        path: toPosix(path.relative(repoRoot, packageJsonPath)),
        updates,
      });
    }
  }
  return changes;
}

export function scanWorkspaceMemberProtocol(repoRoot) {
  const issues = [];
  for (const packageDir of listWorkspacePackageDirs(repoRoot)) {
    const packageJsonPath = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;
    const packageJson = readJson(packageJsonPath);
    const relPackageJson = toPosix(path.relative(repoRoot, packageJsonPath));

    for (const entry of dependencyEntries(packageJson)) {
      const { section, name, value } = entry;

      if (FORBIDDEN_MEMBER_PROTOCOL_RE.test(value)) {
        issues.push({
          kind: 'forbidden-member-sibling-protocol',
          path: relPackageJson,
          detail: `${section}.${name} uses forbidden ${value.split(':')[0]}: sibling path; declare the source once in pnpm-workspace.yaml and consume with workspace:*`,
        });
        continue;
      }

      if (
        SDKWORK_PACKAGE_NAME_RE.test(name)
        && (value.startsWith('file:') || value.startsWith('link:'))
      ) {
        issues.push({
          kind: 'forbidden-sdkwork-file-link',
          path: relPackageJson,
          detail: `${section}.${name} must use workspace:* for SDKWork packages; found ${value}`,
        });
        continue;
      }

      if (
        SDKWORK_PACKAGE_NAME_RE.test(name)
        && !value.startsWith('workspace:')
        && !value.match(/^[\^~]?[\d.]/u)
        && !value.startsWith('npm:')
        && !value.startsWith('catalog:')
      ) {
        issues.push({
          kind: 'non-workspace-sdkwork-source',
          path: relPackageJson,
          detail: `${section}.${name} must use workspace:* or catalog: for SDKWork workspace packages; found ${value}`,
        });
      }
    }
  }
  return issues;
}

function normalizedWorkspaceState(text) {
  return {
    packages: [...parsePnpmWorkspacePackages(text)].sort(),
    catalog: parsePnpmWorkspaceCatalog(text),
  };
}

export function scanWorkspaceMaterialization(repoRoot, repoName = path.basename(repoRoot)) {
  const issues = [];
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) return issues;

  const consumerPath = path.join(specsRoot(), 'workspace/consumers', `${repoName}.json`);
  if (!fs.existsSync(consumerPath)) return issues;

  const existing = readText(workspacePath);
  const existingPackages = parsePnpmWorkspacePackages(existing);
  const localPackages = existingPackages.filter((entry) => !isSiblingPackageEntry(entry));
  const existingCatalog = parsePnpmWorkspaceCatalog(existing);
  const expected = renderPnpmWorkspace({
    packages: buildWorkspacePackages(localPackages, repoName),
    catalog: buildWorkspaceCatalog(existingCatalog, repoName),
  });

  const current = normalizedWorkspaceState(existing);
  const target = normalizedWorkspaceState(expected);
  if (JSON.stringify(current.packages) !== JSON.stringify(target.packages)) {
    issues.push({
      kind: 'workspace-not-materialized',
      path: 'pnpm-workspace.yaml',
      detail: 'pnpm-workspace.yaml packages: drift from sdkwork-specs/workspace registry; run node ../sdkwork-specs/tools/sync-workspace.mjs --repo '
        + repoName
        + ' --root .',
    });
  }

  const overlay = loadConsumerOverlay(repoName);
  const siblingPackages = new Set(parsePnpmWorkspacePackages(existing).filter(isSiblingPackageEntry));
  for (const entry of overlay.pnpmPackages) {
    if (!siblingPackages.has(entry)) {
      issues.push({
        kind: 'consumer-overlay-not-federated',
        path: 'pnpm-workspace.yaml',
        detail: `missing consumer overlay package ${entry}; run sync-workspace.mjs for ${repoName}`,
      });
    }
  }

  return issues;
}

export function validateWorkspaceMemberProtocol(repoRoot, options = {}) {
  const repoName = options.repoName ?? path.basename(repoRoot);
  const issues = [];
  for (const issue of scanWorkspaceMemberProtocol(repoRoot)) {
    issues.push(`${issue.path}: ${issue.detail}`);
  }
  if (options.checkMaterialization !== false) {
    for (const issue of scanWorkspaceMaterialization(repoRoot, repoName)) {
      issues.push(`${issue.path}: ${issue.detail}`);
    }
  }
  return issues;
}
