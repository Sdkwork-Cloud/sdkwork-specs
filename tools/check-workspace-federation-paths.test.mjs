import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  alignWorkspaceFederationPaths,
  rewriteLegacySiblingEntry,
  rewriteTsconfigPathEntry,
  scanWorkspaceFederationPaths,
} from './lib/workspace-federation-path-patterns.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('rewrites migrated sibling common package paths', () => {
  const consumerRoot = makeTempDir('sdkwork-fed-consumer-');
  const siblingRoot = path.join(path.dirname(consumerRoot), 'sdkwork-account');
  const target = path.join(siblingRoot, 'apps/sdkwork-account-common/packages/sdkwork-account-contracts');
  fs.mkdirSync(target, { recursive: true });

  const rewritten = rewriteLegacySiblingEntry(
    '../sdkwork-account/packages/common/account/sdkwork-account-contracts',
    consumerRoot,
  );
  assert.equal(rewritten, '../sdkwork-account/apps/sdkwork-account-common/packages/sdkwork-account-contracts');
});

test('rewrites retired craw-chat alias to sdkwork-im', () => {
  const consumerRoot = makeTempDir('sdkwork-fed-im-');
  const siblingRoot = path.join(path.dirname(consumerRoot), 'sdkwork-im');
  fs.mkdirSync(path.join(siblingRoot, 'sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript'), { recursive: true });

  const rewritten = rewriteLegacySiblingEntry(
    '../craw-chat/sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript',
    consumerRoot,
  );
  assert.equal(rewritten, '../sdkwork-im/sdks/sdkwork-im-sdk/sdkwork-im-sdk-typescript');
});

function makeApplicationRepo(prefix, applicationSlug) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const repoRoot = path.join(parent, `sdkwork-${applicationSlug}`);
  fs.mkdirSync(repoRoot, { recursive: true });
  return repoRoot;
}

test('rewrites stale tsconfig compilerOptions.paths entries', () => {
  const repoRoot = makeApplicationRepo('sdkwork-fed-tsconfig', 'search');
  fs.mkdirSync(
    path.join(repoRoot, 'apps/sdkwork-search-common/packages/sdkwork-search-contracts/src'),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(repoRoot, 'apps/sdkwork-search-common/packages/sdkwork-search-contracts/src/index.ts'),
    'export {};\n',
  );
  fs.writeFileSync(
    path.join(repoRoot, 'tsconfig.base.json'),
    JSON.stringify({
      compilerOptions: {
        paths: {
          '@sdkwork/search-contracts': [
            'packages/common/search/sdkwork-search-contracts/src/index.ts',
          ],
        },
      },
    }, null, 2),
  );

  const rewritten = rewriteTsconfigPathEntry(
    'packages/common/search/sdkwork-search-contracts/src/index.ts',
    repoRoot,
    repoRoot,
  );
  assert.equal(
    rewritten,
    'apps/sdkwork-search-common/packages/sdkwork-search-contracts/src/index.ts',
  );
});

test('aligns stale tsconfig federation paths', () => {
  const repoRoot = makeApplicationRepo('sdkwork-fed-tsconfig-align', 'browser');
  fs.mkdirSync(
    path.join(repoRoot, 'apps/sdkwork-browser-common/packages/sdkwork-browser-contracts/src'),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(repoRoot, 'apps/sdkwork-browser-common/packages/sdkwork-browser-contracts/src/index.ts'),
    'export {};\n',
  );
  fs.writeFileSync(
    path.join(repoRoot, 'tsconfig.base.json'),
    JSON.stringify({
      compilerOptions: {
        paths: {
          '@sdkwork/browser-contracts': [
            './packages/common/browser/sdkwork-browser-contracts/src/index.ts',
          ],
        },
      },
    }, null, 2),
  );

  const result = alignWorkspaceFederationPaths(repoRoot);
  assert.equal(result.changed, true);
  assert.match(result.actions.join('\n'), /tsconfig\.base\.json/);
  assert.equal(scanWorkspaceFederationPaths(repoRoot).issues.length, 0);
});

test('aligns stale tsconfig include globs', () => {
  const repoRoot = makeApplicationRepo('sdkwork-fed-tsconfig-include', 'portal');
  fs.mkdirSync(
    path.join(repoRoot, 'apps/sdkwork-portal-common/packages/sdkwork-portal-contracts/src'),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(repoRoot, 'apps/sdkwork-portal-common/packages/sdkwork-portal-contracts/src/index.ts'),
    'export {};\n',
  );
  fs.writeFileSync(
    path.join(repoRoot, 'tsconfig.json'),
    JSON.stringify({
      include: ['packages/common/portal/**/*.ts'],
    }, null, 2),
  );

  const result = alignWorkspaceFederationPaths(repoRoot);
  assert.equal(result.changed, true);
  assert.match(result.actions.join('\n'), /include/);
  const updated = JSON.parse(fs.readFileSync(path.join(repoRoot, 'tsconfig.json'), 'utf8'));
  assert.equal(updated.include[0], 'apps/sdkwork-portal-common/packages/**/*.ts');
});

test('resolves tsconfig paths entries relative to compilerOptions.baseUrl', () => {
  const repoRoot = makeApplicationRepo('sdkwork-fed-tsconfig-baseurl', 'im');
  const siblingRoot = path.join(path.dirname(repoRoot), 'sdkwork-appbase');
  fs.mkdirSync(
    path.join(siblingRoot, 'packages/pc-react/foundation/sdkwork-appbase-pc-react/src'),
    { recursive: true },
  );
  fs.writeFileSync(
    path.join(siblingRoot, 'packages/pc-react/foundation/sdkwork-appbase-pc-react/src/index.ts'),
    'export {};\n',
  );
  fs.mkdirSync(path.join(repoRoot, 'apps/sdkwork-im-pc/.runtime/tsx'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'apps/sdkwork-im-pc/.runtime/tsx/tsconfig.runtime.json'),
    JSON.stringify({
      compilerOptions: {
        baseUrl: '../..',
        paths: {
          '@sdkwork/appbase-pc-react': [
            '../../../sdkwork-appbase/packages/pc-react/foundation/sdkwork-appbase-pc-react/src/index.ts',
          ],
        },
      },
    }, null, 2),
  );

  const issues = scanWorkspaceFederationPaths(repoRoot).issues;
  assert.deepEqual(issues, []);
});

test('aligns stale pnpm workspace federation entries', () => {
  const repoRoot = makeTempDir('sdkwork-fed-align-');
  const siblingRoot = path.join(path.dirname(repoRoot), 'sdkwork-search');
  fs.mkdirSync(path.join(siblingRoot, 'apps/sdkwork-search-pc/packages/sdkwork-search-pc-react'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'pnpm-workspace.yaml'),
    [
      'packages:',
      "  - '../sdkwork-search/packages/pc-react/foundation/sdkwork-search-pc-react'",
      '',
    ].join('\n'),
  );

  const result = alignWorkspaceFederationPaths(repoRoot);
  assert.equal(result.changed, true);
  assert.match(result.actions.join('\n'), /rewrite/);
  assert.equal(scanWorkspaceFederationPaths(repoRoot).issues.length, 0);
});
