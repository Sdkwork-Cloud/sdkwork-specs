import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { collectParallelSdkRegistryViolations } from './lib/sdk-manifest-standard.mjs';

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
