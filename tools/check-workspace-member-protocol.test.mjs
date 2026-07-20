import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  planWorkspaceMemberProtocolAlignment,
  scanWorkspaceMemberProtocol,
  scanWorkspaceMaterialization,
} from './lib/workspace-member-protocol.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writePackage(repoRoot, relativeDir, packageJson) {
  const dir = path.join(repoRoot, relativeDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
}

test('scanWorkspaceMemberProtocol rejects file: sibling SDKWork paths in member package.json', () => {
  const repoRoot = makeTempDir('sdkwork-member-protocol-');
  fs.writeFileSync(
    path.join(repoRoot, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - "apps/demo/packages/*"',
      '',
    ].join('\n'),
  );
  writePackage(repoRoot, 'apps/demo/packages/demo-core', {
    name: '@sdkwork/demo-core',
    dependencies: {
      '@sdkwork/drive-app-sdk':
        'file:../../../../../sdkwork-drive/sdks/sdkwork-drive-app-sdk/sdkwork-drive-app-sdk-typescript',
    },
  });

  const issues = scanWorkspaceMemberProtocol(repoRoot);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'forbidden-sdkwork-file-link');
});

test('scanWorkspaceMemberProtocol accepts workspace:* for SDKWork packages', () => {
  const repoRoot = makeTempDir('sdkwork-member-protocol-ok-');
  fs.writeFileSync(
    path.join(repoRoot, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - "apps/demo/packages/*"',
      '',
    ].join('\n'),
  );
  writePackage(repoRoot, 'apps/demo/packages/demo-core', {
    name: '@sdkwork/demo-core',
    dependencies: {
      '@sdkwork/drive-app-sdk': 'workspace:*',
      '@sdkwork/utils': 'workspace:*',
    },
  });

  assert.equal(scanWorkspaceMemberProtocol(repoRoot).length, 0);
});

test('planWorkspaceMemberProtocolAlignment only normalizes SDKWork wildcard dependencies', () => {
  const repoRoot = makeTempDir('sdkwork-member-protocol-align-');
  fs.writeFileSync(
    path.join(repoRoot, 'pnpm-workspace.yaml'),
    [
      'packages:',
      '  - "apps/demo/packages/*"',
      '',
    ].join('\n'),
  );
  writePackage(repoRoot, 'apps/demo/packages/demo-core', {
    name: '@sdkwork/demo-core',
    peerDependencies: {
      '@sdkwork/ui-pc-react': '*',
      react: '*',
    },
  });

  const changes = planWorkspaceMemberProtocolAlignment(repoRoot);
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].updates, [
    'peerDependencies.@sdkwork/ui-pc-react: * -> workspace:*',
  ]);
  assert.equal(changes[0].packageJson.peerDependencies['@sdkwork/ui-pc-react'], 'workspace:*');
  assert.equal(changes[0].packageJson.peerDependencies.react, '*');
});
