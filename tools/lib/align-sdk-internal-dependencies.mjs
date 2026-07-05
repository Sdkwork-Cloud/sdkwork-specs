/**
 * Replace retired @sdkwork-internal/* transport dependency keys with consumer packages.
 */
import fs from 'node:fs';
import path from 'node:path';

import { listWorkspaceRepos, walkFiles } from './app-sdk-consumer-import-patterns.mjs';

const DEPENDENCY_REWRITES = new Map([
  ['@sdkwork-internal/im-app-api-generated', '@sdkwork/im-app-sdk'],
  ['@sdkwork-internal/im-backend-api-generated', '@sdkwork/im-backend-sdk'],
  ['@sdkwork-internal/games-app-sdk-generated', '@sdkwork/games-app-sdk'],
  ['@sdkwork-internal/notes-app-sdk-generated', '@sdkwork/notes-app-sdk'],
  ['@sdkwork-internal/xiangqi-app-sdk-generated', '@sdkwork/xiangqi-app-sdk'],
  ['@sdkwork-internal/doudizhu-app-sdk-generated', '@sdkwork/doudizhu-app-sdk'],
  ['@sdkwork-internal/dezhou-app-sdk-generated', '@sdkwork/dezhou-app-sdk'],
  ['@sdkwork-internal/dezhou-backend-sdk-generated', '@sdkwork/dezhou-backend-sdk'],
]);

const FILTER_REWRITES = new Map([
  ['@sdkwork-internal/xiangqi-app-sdk-generated', '@sdkwork/xiangqi-app-sdk'],
  ['@sdkwork-internal/games-app-sdk-generated', '@sdkwork/games-app-sdk'],
  ['@sdkwork-internal/doudizhu-app-sdk-generated', '@sdkwork/doudizhu-app-sdk'],
  ['@sdkwork-internal/dezhou-app-sdk-generated', '@sdkwork/dezhou-app-sdk'],
  ['@sdkwork-internal/dezhou-backend-sdk-generated', '@sdkwork/dezhou-backend-sdk'],
]);

function rewriteObjectKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  let changed = false;
  for (const [legacy, scoped] of DEPENDENCY_REWRITES) {
    if (!(legacy in obj)) continue;
    obj[scoped] = obj[legacy];
    delete obj[legacy];
    changed = true;
  }
  return changed;
}

function rewriteFilterScripts(scripts) {
  if (!scripts) return false;
  let changed = false;
  for (const [key, value] of Object.entries(scripts)) {
    if (typeof value !== 'string') continue;
    let next = value;
    for (const [legacy, scoped] of FILTER_REWRITES) {
      next = next.replaceAll(legacy, scoped);
    }
    if (next !== value) {
      scripts[key] = next;
      changed = true;
    }
  }
  return changed;
}

export function collectInternalSdkDependencyViolations(workspaceRoot) {
  const violations = [];
  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    for (const filePath of walkFiles(repoRoot, (candidate) => /package\.json$/u.test(candidate))) {
      const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const legacy of DEPENDENCY_REWRITES.keys()) {
          if (pkg[section]?.[legacy]) {
            violations.push({
              kind: 'internal-transport-dependency',
              file: filePath,
              message: `${legacy} must be ${DEPENDENCY_REWRITES.get(legacy)}`,
            });
          }
        }
      }
      if (pkg.pnpm?.overrides) {
        for (const legacy of DEPENDENCY_REWRITES.keys()) {
          if (pkg.pnpm.overrides[legacy]) {
            violations.push({
              kind: 'internal-transport-override',
              file: filePath,
              message: `${legacy} must be ${DEPENDENCY_REWRITES.get(legacy)}`,
            });
          }
        }
      }
    }
  }
  return violations;
}

export function alignInternalSdkDependencies(workspaceRoot) {
  const changed = [];
  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    for (const filePath of walkFiles(repoRoot, (candidate) => /package\.json$/u.test(candidate))) {
      const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
      let touched = false;
      for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        if (rewriteObjectKeys(pkg[section])) touched = true;
      }
      if (pkg.pnpm?.overrides && rewriteObjectKeys(pkg.pnpm.overrides)) touched = true;
      if (rewriteFilterScripts(pkg.scripts)) touched = true;
      if (!touched) continue;
      fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      changed.push(filePath);
    }
  }
  return changed;
}
