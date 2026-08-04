import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  collectParallelSdkRegistryViolations,
  loadSdkFamilyManifestForWorkspaceConsumer,
} from './lib/sdk-manifest-standard.mjs';

const removedFileName = ['.sdkwork', 'assembly.json'].join('-');

test('SDK manifest standard rejects removed parallel registries at every level', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-sdk-manifest-'));
  try {
    const repo = path.join(workspace, 'sdkwork-example');
    const nested = path.join(repo, 'apps', 'sdkwork-example-pc', 'sdks');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(repo, 'package.json'), '{}\n', 'utf8');
    const forbiddenPath = path.join(nested, removedFileName);
    fs.writeFileSync(forbiddenPath, '{}\n', 'utf8');

    assert.deepEqual(collectParallelSdkRegistryViolations(workspace), [
      {
        kind: 'parallel-sdk-registry-file',
        file: forbiddenPath,
        message: `${removedFileName} is removed; use sdk-manifest.json and native application/package manifests`,
      },
    ]);
    assert.equal(fs.existsSync(forbiddenPath), true, 'read-only validation must not mutate the workspace');
  } finally {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});

test('workspace consumers resolve sibling internal SDK family ownership', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-sdk-manifest-internal-'));
  try {
    const consumer = path.join(workspace, 'sdkwork-web');
    const owner = path.join(workspace, 'sdkwork-drive');
    fs.mkdirSync(path.join(consumer, 'specs'), { recursive: true });
    fs.mkdirSync(path.join(owner, 'specs'), { recursive: true });
    fs.mkdirSync(path.join(owner, 'sdks', 'sdkwork-drive-internal-sdk'), { recursive: true });
    fs.writeFileSync(path.join(consumer, 'specs', 'component.spec.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(owner, 'specs', 'component.spec.json'), '{}\n', 'utf8');
    fs.writeFileSync(
      path.join(owner, 'sdks', 'sdkwork-drive-internal-sdk', 'sdk-manifest.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        workspace: 'sdkwork-drive-internal-sdk',
        sdkOwner: 'sdkwork-drive',
        apiAuthority: 'sdkwork-drive-internal-api',
      }, null, 2)}\n`,
      'utf8',
    );

    assert.deepEqual(
      loadSdkFamilyManifestForWorkspaceConsumer(consumer, 'sdkwork-drive-internal-sdk'),
      {
        schemaVersion: 1,
        workspace: 'sdkwork-drive-internal-sdk',
        sdkOwner: 'sdkwork-drive',
        apiAuthority: 'sdkwork-drive-internal-api',
      },
    );
  } finally {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});

test('workspace consumers resolve an SDK family whose directory stem omits the sdkwork prefix', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-sdk-manifest-family-stem-'));
  try {
    const consumer = path.join(workspace, 'sdkwork-web');
    const owner = path.join(workspace, 'sdkwork-cloudrouter');
    fs.mkdirSync(path.join(consumer, 'specs'), { recursive: true });
    fs.mkdirSync(path.join(owner, 'specs'), { recursive: true });
    fs.mkdirSync(path.join(owner, 'sdks', 'cloudrouter-app-sdk'), { recursive: true });
    fs.writeFileSync(path.join(consumer, 'specs', 'component.spec.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(owner, 'specs', 'component.spec.json'), '{}\n', 'utf8');
    fs.writeFileSync(
      path.join(owner, 'sdks', 'cloudrouter-app-sdk', 'sdk-manifest.json'),
      `${JSON.stringify({
        schemaVersion: 1,
        sdkFamily: 'cloudrouter-app-sdk',
        packageName: '@sdkwork/cloudrouter-app-sdk',
        sdkOwner: 'sdkwork-cloudrouter',
        apiAuthority: 'sdkwork-cloudrouter.app',
      }, null, 2)}\n`,
      'utf8',
    );

    assert.deepEqual(
      loadSdkFamilyManifestForWorkspaceConsumer(consumer, 'sdkwork-cloudrouter-app-sdk'),
      {
        schemaVersion: 1,
        sdkFamily: 'cloudrouter-app-sdk',
        packageName: '@sdkwork/cloudrouter-app-sdk',
        sdkOwner: 'sdkwork-cloudrouter',
        apiAuthority: 'sdkwork-cloudrouter.app',
      },
    );
    assert.deepEqual(
      loadSdkFamilyManifestForWorkspaceConsumer(owner, 'sdkwork-cloudrouter-app-sdk'),
      loadSdkFamilyManifestForWorkspaceConsumer(consumer, 'sdkwork-cloudrouter-app-sdk'),
    );
  } finally {
    fs.rmSync(workspace, { force: true, recursive: true });
  }
});
