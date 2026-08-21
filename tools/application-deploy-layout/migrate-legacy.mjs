import fs from 'node:fs';
import path from 'node:path';

import { discoverRepos, readTopology } from './discover.mjs';

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

function rewriteJsonPaths(value) {
  if (typeof value === 'string') {
    return value
      .replaceAll('configs/topology/', 'etc/topology/')
      .replace(/^configs\/topology$/u, 'etc/topology');
  }
  if (Array.isArray(value)) return value.map(rewriteJsonPaths);
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = rewriteJsonPaths(item);
    }
    return next;
  }
  return value;
}

function rewriteTextPaths(text) {
  return text
    .replaceAll('configs/topology/', 'etc/topology/')
    .replace(/profileRoot:\s*configs\/topology/gu, 'profileRoot: etc/topology');
}

function copyLegacyTopologyFiles(repoRoot, dryRun) {
  const legacyDir = path.join(repoRoot, 'configs/topology');
  if (!fs.existsSync(legacyDir)) return [];
  const copied = [];
  const targetDir = path.join(repoRoot, 'etc/topology');
  for (const file of listFilesRecursive(legacyDir)) {
    const relative = path.relative(legacyDir, file);
    const target = path.join(targetDir, relative);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(file, target);
    }
    copied.push(`etc/topology/${relative.replace(/\\/gu, '/')}`);
  }
  return copied;
}

function updateTopologySpec(repoRoot, dryRun) {
  const topologyPath = path.join(repoRoot, 'specs/topology.spec.json');
  if (!fs.existsSync(topologyPath)) return false;
  const original = fs.readFileSync(topologyPath, 'utf8');
  if (!original.includes('configs/topology') && !original.includes('"configs/topology"')) {
    return false;
  }
  const parsed = JSON.parse(original);
  const next = rewriteJsonPaths(parsed);
  if (next.profileRoot === 'configs/topology' || next.profileRoot?.includes('configs')) {
    next.profileRoot = 'etc/topology';
  }
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (!dryRun) fs.writeFileSync(topologyPath, serialized, 'utf8');
  return true;
}

function updateDeploymentIndex(repoRoot, dryRun) {
  const indexPath = path.join(repoRoot, 'etc/sdkwork.deployment.config.json');
  if (!fs.existsSync(indexPath)) return false;
  const original = fs.readFileSync(indexPath, 'utf8');
  if (!original.includes('configs/topology')) return false;
  const parsed = JSON.parse(original);
  const next = rewriteJsonPaths(parsed);
  if (!dryRun) fs.writeFileSync(indexPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return true;
}

function updateDeployYaml(repoRoot, dryRun) {
  const deployPath = path.join(repoRoot, 'deployments/deploy.yaml');
  if (!fs.existsSync(deployPath)) return false;
  const original = fs.readFileSync(deployPath, 'utf8');
  if (!original.includes('configs/topology')) return false;
  const next = rewriteTextPaths(original);
  if (!dryRun) fs.writeFileSync(deployPath, next, 'utf8');
  return true;
}

function removeLegacyConfigsTopology(repoRoot, dryRun) {
  const legacyDir = path.join(repoRoot, 'configs/topology');
  if (!fs.existsSync(legacyDir)) return false;
  if (!dryRun) {
    fs.rmSync(legacyDir, { recursive: true, force: true });
    removeEmptyDirs(path.join(repoRoot, 'configs'));
  }
  return true;
}

export function migrateLegacyTopologyRepo(repoRoot, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const changes = [];
  const copied = copyLegacyTopologyFiles(repoRoot, dryRun);
  if (copied.length > 0) changes.push(...copied.map((item) => `copy:${item}`));
  if (updateTopologySpec(repoRoot, dryRun)) changes.push('update:specs/topology.spec.json');
  if (updateDeploymentIndex(repoRoot, dryRun)) changes.push('update:etc/sdkwork.deployment.config.json');
  if (updateDeployYaml(repoRoot, dryRun)) changes.push('update:deployments/deploy.yaml');
  if (removeLegacyConfigsTopology(repoRoot, dryRun)) changes.push('remove:configs/topology');
  return { appId: path.basename(repoRoot), changes };
}

export function migrateLegacyTopologyWorkspace(workspaceRoot, options = {}) {
  return discoverRepos(workspaceRoot, { includeAppConfigOnly: true }).map((repoRoot) =>
    migrateLegacyTopologyRepo(repoRoot, options),
  );
}

function fixProfileFilesToMatchRoot(parsed) {
  const root = parsed.profileRoot ?? 'etc/topology';
  if (!parsed.profileFiles || typeof parsed.profileFiles !== 'object') return parsed;
  for (const [profileId, filePath] of Object.entries(parsed.profileFiles)) {
    if (typeof filePath !== 'string') continue;
    const fileName = path.basename(filePath);
    parsed.profileFiles[profileId] = `${root}/${fileName}`.replace(/\\/gu, '/');
  }
  return parsed;
}

export function normalizeTopologyProfilePaths(repoRoot, dryRun = false) {
  const topologyPath = path.join(repoRoot, 'specs/topology.spec.json');
  if (!fs.existsSync(topologyPath)) return false;
  const parsed = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  if (parsed.schemaVersion !== 5) return false;
  const before = JSON.stringify(parsed.profileFiles ?? {});
  const next = fixProfileFilesToMatchRoot(parsed);
  if (JSON.stringify(next.profileFiles ?? {}) === before) return false;
  if (!dryRun) fs.writeFileSync(topologyPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return true;
}

export function normalizeTopologyProfilePathsWorkspace(workspaceRoot, dryRun = false) {
  const changes = [];
  for (const repoRoot of discoverRepos(workspaceRoot, { includeAppConfigOnly: true })) {
    if (normalizeTopologyProfilePaths(repoRoot, dryRun)) {
      changes.push(path.basename(repoRoot));
    }
  }
  return changes;
}

export function repoHasLegacyConfigsDir(repoRoot) {
  return fs.existsSync(path.join(repoRoot, 'configs/topology'));
}

export function repoTopologyDebt(repoRoot) {
  const topology = readTopology(repoRoot);
  if (!topology) return ['missing topology.spec.json'];
  const issues = [];
  if (topology.schemaVersion !== 5) {
    issues.push(`topology schemaVersion ${topology.schemaVersion} (require 5)`);
  }
  if (!topology.applicationCode?.trim()) {
    issues.push('topology.applicationCode is empty');
  }
  const serialized = JSON.stringify(topology);
  if (serialized.includes('configs/topology')) {
    issues.push('topology references configs/topology');
  }
  if (repoHasLegacyConfigsDir(repoRoot)) {
    issues.push('configs/topology directory still exists');
  }
  if (topology.profileRoot && topology.profileFiles) {
    for (const filePath of Object.values(topology.profileFiles)) {
      if (typeof filePath === 'string' && filePath.includes('configs/')) {
        issues.push(`profileFiles still references ${filePath}`);
        break;
      }
    }
  }
  return issues;
}
