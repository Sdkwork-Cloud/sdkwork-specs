import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  classifyPnpmWorkspacePackagesLayout,
  classifyRepositoryRootPackages,
  declaresFoundationDependencyRepository,
  listApplicationRoots,
  resolveRepositoryKind,
  scanRepositoryPackagesLayout,
  summarizeRepositoryPackagesLayout,
} from './lib/packages-layout-patterns.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('detects foundation dependency repositories', () => {
  assert.equal(
    declaresFoundationDependencyRepository('This repo is not an independent SDKWORK application root.\n'),
    true,
  );
  assert.equal(
    resolveRepositoryKind(makeTempDir('sdkwork-packages-layout-'), {
      repositoryKind: 'foundation-dependency',
    }),
    'foundation-dependency',
  );
});

test('lists application roots under apps/', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-im-pc'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-im-h5'), { recursive: true });
  assert.deepEqual(listApplicationRoots(root), ['apps/sdkwork-im-h5', 'apps/sdkwork-im-pc']);
});

test('rejects repository-root packages for application repositories', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-im-pc'), { recursive: true });
  fs.mkdirSync(path.join(root, 'packages', 'sdkwork-im-pc-core'), { recursive: true });
  const issues = classifyRepositoryRootPackages(root, { mode: 'enforce' });
  assert.ok(issues.some((issue) => issue.kind === 'forbidden-repo-root-packages' && issue.severity === 'error'));
});

test('skips repository-root packages for foundation dependency repositories', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'packages', 'pc-react', 'iam'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apis'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'README.md'),
    '# Appbase\n\nThis workspace is not an independent SDKWORK application root.\n',
  );
  assert.equal(resolveRepositoryKind(root), 'foundation-dependency');
  assert.deepEqual(scanRepositoryPackagesLayout(root, { mode: 'enforce' }), []);
});

test('warns for legacy-application debt in migration mode', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'packages', 'sdkwork-magic-studio-core'), { recursive: true });
  fs.mkdirSync(path.join(root, 'sdks'), { recursive: true });
  assert.equal(resolveRepositoryKind(root), 'legacy-application');
  const issues = scanRepositoryPackagesLayout(root, { mode: 'migration' });
  assert.ok(issues.every((issue) => issue.severity === 'warn'));
  assert.ok(issues.some((issue) => issue.kind === 'missing-repository-kind'));
});

test('flags legacy pnpm workspace globs for legacy-application repositories', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'packages', 'common', 'iam'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apis'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'pnpm-workspace.yaml'),
    "packages:\n  - 'packages/common/*'\n",
  );
  const issues = classifyPnpmWorkspacePackagesLayout(root, {
    mode: 'enforce',
    repositoryKind: 'legacy-application',
  });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'legacy-pnpm-workspace-glob');
});

test('passes canonical single-surface layout', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-im-pc', 'packages', 'sdkwork-im-pc-core'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# IM\n\nrepository-kind: application\n');
  fs.writeFileSync(
    path.join(root, 'pnpm-workspace.yaml'),
    "packages:\n  - 'apps/sdkwork-im-pc/packages/*'\n",
  );
  const summary = summarizeRepositoryPackagesLayout(root, { mode: 'enforce' });
  assert.equal(summary.repositoryKind, 'application');
  assert.equal(summary.issueCount, 0);
});

test('audit summary counts repository kinds', () => {
  const root = makeTempDir('sdkwork-packages-layout-');
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-im-pc', 'packages', 'sdkwork-im-pc-core'), { recursive: true });
  const summary = summarizeRepositoryPackagesLayout(root, { mode: 'audit' });
  assert.equal(summary.repositoryKind, 'application');
  assert.equal(summary.errors.length, 0);
});
