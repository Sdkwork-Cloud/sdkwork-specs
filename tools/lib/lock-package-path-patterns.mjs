import fs from 'node:fs';
import path from 'node:path';

import { inferApplicationCode } from './align-packages-layout.mjs';
import { keepsRepositoryRootPackages } from './workspace-federation-path-patterns.mjs';

const LEGACY_LOCK_PATTERNS = [
  /packages\/common\/[a-z0-9-]+\//u,
  /packages\/pc-react\/[a-z0-9-]+\//u,
  /packages\/mobile-react\/[a-z0-9-]+\//u,
];

const APPBASE_LOCK_ALLOW = /sdkwork-appbase\/packages\//u;

export function scanLockFileStalePackagePaths(lockFilePath, repoRoot) {
  const issues = [];
  const repoName = path.basename(repoRoot);
  if (keepsRepositoryRootPackages(repoName)) {
    return issues;
  }

  const text = fs.readFileSync(lockFilePath, 'utf8');
  for (const line of text.split(/\r?\n/u)) {
    if (APPBASE_LOCK_ALLOW.test(line)) {
      continue;
    }

    for (const pattern of LEGACY_LOCK_PATTERNS) {
      if (!pattern.test(line)) {
        continue;
      }

      if (line.includes('../sdkwork-appbase/packages/')) {
        continue;
      }

      const crossRepoMatch = line.match(/\.\.\/sdkwork-([a-z0-9-]+)\/packages\/(?:common|pc-react|mobile-react)\//u);
      if (crossRepoMatch && !keepsRepositoryRootPackages(`sdkwork-${crossRepoMatch[1]}`)) {
        issues.push({
          kind: 'stale-lock-cross-repo-package-path',
          path: path.relative(repoRoot, lockFilePath),
          line: line.trim(),
          detail: 'pnpm-lock.yaml still references migrated repository-root package paths; run pnpm install after federation alignment',
        });
        break;
      }

      if (lockFilePath.startsWith(repoRoot) && /^\s+packages\/(?:common|pc-react|mobile-react)\//u.test(line)) {
        const applicationCode = inferApplicationCode(repoRoot);
        issues.push({
          kind: 'stale-lock-internal-package-path',
          path: path.relative(repoRoot, lockFilePath),
          line: line.trim(),
          detail: `pnpm-lock.yaml still references legacy repository-root packages/; expected apps/sdkwork-${applicationCode}-common/packages/ or apps/sdkwork-${applicationCode}-<client-arch>/packages/`,
        });
        break;
      }

      if (/\blink:\.{1,6}\/packages\/(?:common|pc-react|mobile-react)\//u.test(line)) {
        issues.push({
          kind: 'stale-lock-link-package-path',
          path: path.relative(repoRoot, lockFilePath),
          line: line.trim(),
          detail: 'pnpm-lock.yaml workspace link still targets legacy packages/ paths; run pnpm install to regenerate the lockfile',
        });
        break;
      }
    }
  }

  return issues;
}

export function scanRepositoryLockPackagePaths(repoRoot) {
  const lockPath = path.join(repoRoot, 'pnpm-lock.yaml');
  if (!fs.existsSync(lockPath)) {
    return [];
  }
  return scanLockFileStalePackagePaths(lockPath, repoRoot);
}

export function scanWorkspaceLockPackagePaths(workspaceRoot) {
  const issues = [];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const repoRoot = path.join(workspaceRoot, entry.name);
    for (const issue of scanRepositoryLockPackagePaths(repoRoot)) {
      issues.push({ repo: entry.name, ...issue });
    }

    const nestedLock = path.join(repoRoot, 'apps', '**', 'pnpm-lock.yaml');
    walkNestedLocks(repoRoot, repoRoot, issues);
  }
  return issues;
}

function rewriteLockPathFragment(fragment, repoRoot, contextDir = repoRoot) {
  const hadLink = fragment.startsWith('link:');
  const normalized = fragment.replace(/^link:/u, '').replace(/\\/g, '/');

  const siblingMatch = normalized.match(/^((?:\.\.\/)+)([^/]+)\/(.+)$/u);
  if (siblingMatch) {
    const [, prefix, siblingName, restPath] = siblingMatch;
    const siblingRepo = normalizeSiblingRepoName(siblingName);
    const siblingRoot = fs.existsSync(path.resolve(contextDir, prefix, siblingName))
      ? path.resolve(contextDir, prefix, siblingName)
      : path.resolve(repoRoot, '..', siblingRepo);
    if (fs.existsSync(siblingRoot)) {
      const rewrittenRest = rewritePathInsideApplicationRepo(restPath, siblingRoot);
      if (rewrittenRest) {
        const rebuilt = `${prefix}${siblingRepo}/${rewrittenRest}`;
        return hadLink ? `link:${rebuilt}` : rebuilt;
      }
    }
  }

  if (normalized.startsWith('packages/')) {
    const rewritten = rewritePathInsideApplicationRepo(normalized, repoRoot);
    if (rewritten) {
      return hadLink ? `link:${rewritten}` : rewritten;
    }
  }

  return null;
}

function normalizeSiblingRepoName(repoName) {
  return repoName === 'craw-chat' ? 'sdkwork-im' : repoName;
}

function rewritePathInsideApplicationRepo(restPath, repoRoot) {
  if (keepsRepositoryRootPackages(path.basename(repoRoot))) {
    return null;
  }

  const applicationCode = inferApplicationCode(repoRoot);
  const normalizedRest = restPath.replace(/\\/g, '/');

  for (const [legacyFamily, suffix] of Object.entries({
    'packages/common': '-common',
    'packages/pc-react': '-pc',
    'packages/mobile-react': '-h5',
  })) {
    const prefix = `${legacyFamily}/`;
    if (!normalizedRest.startsWith(prefix)) {
      continue;
    }

    const tail = normalizedRest.slice(prefix.length);
    if (!tail) {
      return null;
    }

    const appRoot = `apps/sdkwork-${applicationCode}${suffix}`;
    if (tail.endsWith('/*')) {
      return `${appRoot}/packages/*`;
    }
    if (tail.includes('/')) {
      return `${appRoot}/packages/${tail.split('/').at(-1)}`;
    }
    return `${appRoot}/packages/${tail}`;
  }

  return null;
}

export function alignRepositoryLockfileText(repoRoot, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const actions = [];
  let changed = false;

  function alignFile(lockPath) {
    if (!fs.existsSync(lockPath)) {
      return;
    }

    const original = fs.readFileSync(lockPath, 'utf8');
    const fragmentPattern = /(?:link:)?(?:(?:\.\.\/)+(?:sdkwork-[a-z0-9-]+|magic-studio|claw-studio|hub-installer|craw-chat)\/[^\s"'`:]+|\bpackages\/(?:common|pc-react|mobile-react)\/[A-Za-z0-9_./-]+)/gu;
    const seen = new Set();

    const updated = original.replace(fragmentPattern, (fragment) => {
      if (APPBASE_LOCK_ALLOW.test(fragment)) {
        return fragment;
      }
      const rewritten = rewriteLockPathFragment(fragment, repoRoot, path.dirname(lockPath));
      if (!rewritten || rewritten === fragment || seen.has(`${fragment}->${rewritten}`)) {
        return fragment;
      }
      seen.add(`${fragment}->${rewritten}`);
      actions.push(`rewrite ${path.relative(repoRoot, lockPath)} ${fragment} -> ${rewritten}`);
      return rewritten;
    });

    if (updated !== original) {
      changed = true;
      if (!dryRun) {
        fs.writeFileSync(lockPath, updated);
      }
    }
  }

  alignFile(path.join(repoRoot, 'pnpm-lock.yaml'));
  walkNestedLockFiles(repoRoot, repoRoot, alignFile);

  return { changed, actions };
}

function walkNestedLockFiles(repoRoot, currentDir, alignFile) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkNestedLockFiles(repoRoot, absolute, alignFile);
      continue;
    }
    if (entry.name !== 'pnpm-lock.yaml' || absolute === path.join(repoRoot, 'pnpm-lock.yaml')) {
      continue;
    }
    alignFile(absolute);
  }
}

export function alignWorkspaceLockfileText(workspaceRoot, options = {}) {
  const results = [];
  for (const entry of fs.readdirSync(workspaceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue;
    }
    const repoRoot = path.join(workspaceRoot, entry.name);
    const result = alignRepositoryLockfileText(repoRoot, options);
    if (result.changed || result.actions.length > 0) {
      results.push({ repo: entry.name, ...result });
    }
  }
  return results;
}

function walkNestedLocks(repoRoot, currentDir, issues) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      walkNestedLocks(repoRoot, absolute, issues);
      continue;
    }
    if (entry.name !== 'pnpm-lock.yaml' || absolute === path.join(repoRoot, 'pnpm-lock.yaml')) {
      continue;
    }
    for (const issue of scanLockFileStalePackagePaths(absolute, repoRoot)) {
      issues.push({ repo: path.basename(repoRoot), ...issue });
    }
  }
}
