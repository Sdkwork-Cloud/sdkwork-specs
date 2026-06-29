import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildWorkspacePackages,
  parsePnpmWorkspacePackages,
  renderPnpmWorkspace,
} from './lib/workspace-registry.mjs';
import {
  isForbiddenCapabilitySdkImport,
  listClientAppRoots,
  normalizeSdkDependencies,
  validateSdkDependenciesContract,
} from './lib/app-composition.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('listClientAppRoots discovers hybrid pc-react app roots', () => {
  const roots = listClientAppRoots(path.resolve(SPECS_ROOT, '..', 'sdkwork-notes'));
  assert.ok(roots.some((root) => root.appRootName === 'sdkwork-notes-pc-react'));
});

test('normalizeSdkDependencies accepts string and object entries', () => {
  const deps = normalizeSdkDependencies({
    contracts: {
      sdkDependencies: [
        'sdkwork-foo-app-sdk-typescript',
        { workspace: 'sdkwork-bar-backend-sdk-typescript', surface: 'backend-api', credentialMode: 'authenticated-backend-admin' },
      ],
    },
  });
  assert.equal(deps.length, 2);
  assert.equal(deps[0].workspace, 'sdkwork-foo-app-sdk-typescript');
});

test('validateSdkDependenciesContract rejects backend-api on app core', () => {
  const issues = validateSdkDependenciesContract(
    {
      surface: 'app',
      componentName: 'sdkwork-demo-pc-core',
      componentSpec: {
        contracts: {
          sdkDependencies: [{ workspace: 'sdkwork-demo-backend-sdk-typescript', surface: 'backend-api' }],
        },
      },
    },
    'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-core',
  );
  assert.ok(issues.some((issue) => issue.includes('backend-api')));
});

test('isForbiddenCapabilitySdkImport blocks generated SDK imports', () => {
  assert.equal(isForbiddenCapabilitySdkImport('sdkwork-im-generated-app-sdk'), true);
  assert.equal(isForbiddenCapabilitySdkImport('@sdkwork/demo-pc-core/composition'), false);
});

test('buildWorkspacePackages preserves local packages and adds foundation paths', () => {
  const packages = buildWorkspacePackages(['apps/*', 'packages/*'], 'sdkwork-im');
  assert.ok(packages.includes('apps/*'));
  assert.ok(packages.includes('packages/*'));
  assert.ok(packages.some((entry) => entry.includes('sdkwork-utils-typescript')));
});

test('renderPnpmWorkspace round-trips package list parsing', () => {
  const rendered = renderPnpmWorkspace({
    packages: ['apps/*', '../sdkwork-utils/packages/sdkwork-utils-typescript'],
    catalog: { react: '^19.2.4' },
  });
  const parsed = parsePnpmWorkspacePackages(rendered);
  assert.deepEqual(parsed, ['apps/*', '../sdkwork-utils/packages/sdkwork-utils-typescript']);
});
