import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  discoverAllSdkFamiliesIncludingApps,
  discoverSdkFamilies,
} from './lib/sdk-family-discovery.mjs';

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createTypescriptSdkFamily(repoRoot, familyName) {
  writeJson(path.join(repoRoot, 'package.json'), {
    name: 'sdkwork-demo-workspace',
    private: true,
  });
  writeJson(
    path.join(
      repoRoot,
      'sdks',
      familyName,
      `${familyName}-typescript`,
      'generated',
      'server-openapi',
      'package.json',
    ),
    {
      name: `${familyName}-generated-typescript`,
      private: true,
    },
  );
}

test('discoverAllSdkFamiliesIncludingApps includes the workspace root when it is a repository root', () => {
  const repoRoot = makeTempDir('sdkwork-sdk-discovery-repo-root-');
  createTypescriptSdkFamily(repoRoot, 'sdkwork-demo-app-sdk');

  assert.deepEqual(
    discoverSdkFamilies(repoRoot).map((family) => family.sdkFamilyStem),
    ['sdkwork-demo-app-sdk'],
    'direct repo-root discovery must find the SDK family fixture',
  );
  assert.deepEqual(
    discoverAllSdkFamiliesIncludingApps(repoRoot).map((family) => family.sdkFamilyStem),
    ['sdkwork-demo-app-sdk'],
    'workspace discovery must not skip the workspace root itself',
  );
});
