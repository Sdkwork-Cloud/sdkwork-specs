import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAppManifestDeployment } from './check-app-manifest-deployment-standard.mjs';

function manifest(packages) {
  return {
    runtime: {
      supportedDeploymentProfiles: ['standalone', 'cloud'],
      defaultDeploymentProfile: 'standalone',
    },
    artifacts: { installConfig: { packages } },
  };
}

test('accepts fixed services and runtime-configurable clients', () => {
  const issues = validateAppManifestDeployment(manifest([
    {
      id: 'container-x64-cloud-container-oci',
      sourceType: 'CONTAINER_IMAGE',
      profileBinding: 'fixed',
      deploymentProfile: 'cloud',
      runtimeTarget: 'container',
    },
    {
      id: 'ios-universal-dual-mobile-ipa',
      sourceType: 'APP_STORE',
      profileBinding: 'runtime-configurable',
      supportedDeploymentProfiles: ['standalone', 'cloud'],
      defaultDeploymentProfile: 'standalone',
      runtimeTarget: 'ios-native',
      targetPlatform: 'ios',
      clientArchitecture: 'ios-native',
    },
  ]));
  assert.deepEqual(issues, []);
});

test('rejects a runtime-configurable server and third deployment mode', () => {
  const value = manifest([
    {
      id: 'linux-x64-dual-server-tar-gz',
      sourceType: 'DIRECT_DOWNLOAD',
      profileBinding: 'runtime-configurable',
      supportedDeploymentProfiles: ['standalone', 'saas'],
      defaultDeploymentProfile: 'saas',
      runtimeTarget: 'server',
      targetPlatform: 'linux',
      clientArchitecture: 'service',
    },
  ]);
  const issues = validateAppManifestDeployment(value);
  assert.ok(issues.some((issue) => issue.includes('sourceType')));
  assert.ok(issues.some((issue) => issue.includes('limited to client')));
  assert.ok(issues.some((issue) => issue.includes('exactly standalone and cloud')));
});

test('rejects profile-binding field overlap', () => {
  const issues = validateAppManifestDeployment(manifest([
    {
      id: 'windows-x64-dual-desktop-msi',
      sourceType: 'BINARY_URL',
      profileBinding: 'runtime-configurable',
      deploymentProfile: 'standalone',
      supportedDeploymentProfiles: ['standalone', 'cloud'],
      defaultDeploymentProfile: 'standalone',
      runtimeTarget: 'desktop',
      targetPlatform: 'windows',
      clientArchitecture: 'tauri',
    },
  ]));
  assert.ok(issues.some((issue) => issue.includes('forbids deploymentProfile')));
});

test('rejects client platform and architecture drift', () => {
  const issues = validateAppManifestDeployment(manifest([
    {
      id: 'ios-universal-cloud-mobile-ipa',
      sourceType: 'APP_STORE',
      profileBinding: 'fixed',
      deploymentProfile: 'cloud',
      runtimeTarget: 'flutter-ios',
      targetPlatform: 'android',
      clientArchitecture: 'android-native',
    },
  ]));
  assert.ok(issues.some((issue) => issue.includes('targetPlatform contradicts')));
  assert.ok(issues.some((issue) => issue.includes('clientArchitecture contradicts')));
});

test('accepts non-deployable test evidence without a deployment profile', () => {
  const issues = validateAppManifestDeployment(manifest([
    {
      id: 'workflow-noarch-test-json',
      sourceType: 'SCRIPT',
      profileBinding: 'non-deployable',
      runtimeTarget: 'test-runner',
    },
    {
      id: 'container-x64-cloud-container-oci',
      sourceType: 'CONTAINER_IMAGE',
      profileBinding: 'fixed',
      deploymentProfile: 'cloud',
      runtimeTarget: 'container',
    },
    {
      id: 'linux-x64-standalone-server-tar-gz',
      sourceType: 'BINARY_URL',
      profileBinding: 'fixed',
      deploymentProfile: 'standalone',
      runtimeTarget: 'server',
    },
  ]));
  assert.deepEqual(issues, []);
});

test('rejects deployment selectors on non-deployable artifacts', () => {
  const issues = validateAppManifestDeployment(manifest([
    {
      id: 'workflow-noarch-cloud-test-json',
      sourceType: 'SCRIPT',
      profileBinding: 'non-deployable',
      deploymentProfile: 'cloud',
      runtimeTarget: 'test-runner',
    },
  ]));
  assert.ok(issues.some((issue) => issue.includes('forbids deployment profile fields')));
});

test('accepts disabled deferred profile coverage for draft publication', () => {
  const value = manifest([
    {
      id: 'web-universal-cloud-browser-zip',
      sourceType: 'BINARY_URL',
      profileBinding: 'fixed',
      deploymentProfile: 'cloud',
      runtimeTarget: 'browser',
      targetPlatform: 'web',
      clientArchitecture: 'pc-web',
      enabled: false,
      metadata: { releaseBuildDeferred: true },
    },
    {
      id: 'linux-x64-standalone-server-tar-gz',
      sourceType: 'BINARY_URL',
      profileBinding: 'fixed',
      deploymentProfile: 'standalone',
      runtimeTarget: 'server',
      enabled: false,
      metadata: { releaseBuildDeferred: true },
    },
  ]);
  value.publish = { status: 'DRAFT' };
  assert.deepEqual(validateAppManifestDeployment(value), []);
});

test('rejects disabled profile coverage for active publication', () => {
  const value = manifest([
    {
      id: 'web-universal-cloud-browser-zip',
      sourceType: 'BINARY_URL',
      profileBinding: 'fixed',
      deploymentProfile: 'cloud',
      runtimeTarget: 'browser',
      targetPlatform: 'web',
      clientArchitecture: 'pc-web',
      enabled: false,
      metadata: { releaseBuildDeferred: true },
    },
    {
      id: 'linux-x64-standalone-server-tar-gz',
      sourceType: 'BINARY_URL',
      profileBinding: 'fixed',
      deploymentProfile: 'standalone',
      runtimeTarget: 'server',
      enabled: false,
      metadata: { releaseBuildDeferred: true },
    },
  ]);
  value.publish = { status: 'ACTIVE' };
  const issues = validateAppManifestDeployment(value);
  assert.ok(issues.some((issue) => issue.includes('no enabled package covers deployment profile cloud')));
  assert.ok(issues.some((issue) => issue.includes('no enabled package covers deployment profile standalone')));
});
