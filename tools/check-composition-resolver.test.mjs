#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import os from 'node:os';

import {
  deriveFoundationEnvFromResolution,
  resolveComposition,
  validateCompositionResolution,
} from './lib/composition-resolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clawRouterRoot = path.resolve(__dirname, '../../../sdkwork-clawrouter');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('resolveComposition derives platform IAM integration from clawrouter sdkDependencies', () => {
  if (!fs.existsSync(clawRouterRoot)) return;

  const resolution = resolveComposition(clawRouterRoot);
  const iam = resolution.integrations.find((entry) => entry.workspace === 'sdkwork-iam-app-sdk');
  assert.ok(iam, 'expected sdkwork-iam-app-sdk integration');
  assert.equal(iam.connectivityPlane, 'platform');
  assert.equal(iam.runtimeMode, 'external-via-platform-surface');
  assert.equal(iam.forbidApplicationSameOriginFallback, true);
  assert.equal(resolution.requiresPlatformApiSurface, true);
  assert.equal(Object.hasOwn(resolution, 'requiresPlatformGatewayProcess'), false);
  assert.doesNotMatch(JSON.stringify(resolution), /external-via-platform-gateway/u);
  assert.ok(
    resolution.permissions.inheritedManifests.some((entry) => entry.workspace === 'sdkwork-iam-app-sdk'),
    'expected IAM permission manifest inheritance',
  );
});

test('validateCompositionResolution rejects platform IAM falling back to application same-origin URL', () => {
  const resolution = {
    issues: [],
    integrations: [
      {
        workspace: 'sdkwork-iam-app-sdk',
        envKey: 'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
        connectivityPlane: 'platform',
        forbidApplicationSameOriginFallback: true,
      },
    ],
  };

  const issues = validateCompositionResolution(resolution, {
    observedEnv: {
      VITE_SDKWORK_APPBASE_APP_API_BASE_URL: '/app/v3/api',
    },
    applicationAppApiBaseUrl: '/app/v3/api',
  });

  assert.ok(issues.length >= 1);
  assert.match(issues[0], /must not fall back to application same-origin/u);
});

test('deriveFoundationEnvFromResolution maps platform dependencies to surface origin', () => {
  const resolution = {
    env: {},
    integrations: [
      {
        workspace: 'sdkwork-iam-app-sdk',
        envKey: 'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
        runtimeMode: 'external-via-platform-surface',
        apiPrefix: '/app/v3/api',
      },
      {
        workspace: 'sdkwork-drive-app-sdk',
        envKey: 'VITE_SDKWORK_DRIVE_APP_API_BASE_URL',
        runtimeMode: 'external-via-platform-surface',
        apiPrefix: '/app/v3/api',
      },
    ],
  };

  const env = deriveFoundationEnvFromResolution(resolution, {
    platformApiOrigin: 'http://127.0.0.1:3902',
    applicationAppApiBaseUrl: '/app/v3/api',
    applicationBackendApiBaseUrl: 'http://127.0.0.1:3900/backend/v3/api',
  });

  assert.equal(env.VITE_SDKWORK_APPBASE_APP_API_BASE_URL, 'http://127.0.0.1:3902/app/v3/api');
  assert.equal(env.VITE_SDKWORK_DRIVE_APP_API_BASE_URL, 'http://127.0.0.1:3902/app/v3/api');
});

test('resolveComposition prefers verified standalone-host assembly mounts over dependency surface defaults', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-composition-embedded-iam-'));
  const appRoot = path.join(root, 'apps/sdkwork-demo-pc');
  writeJson(path.join(appRoot, 'sdkwork.app.config.json'), {
    schemaVersion: 1,
    applicationCode: 'demo',
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-demo-pc-core/package.json'), {
    name: '@sdkwork/demo-pc-core',
    version: '0.0.0',
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-demo-pc-core/specs/component.spec.json'), {
    component: {
      name: '@sdkwork/demo-pc-core',
      type: 'typescript-package',
      surface: 'app',
    },
    contracts: {
      sdkDependencies: [
        {
          workspace: 'sdkwork-iam-app-sdk',
          surface: 'app-api',
          credentialMode: 'authenticated-app-api',
        },
      ],
    },
  });
  writeJson(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/specs/component.spec.json'), {
    component: {
      name: 'sdkwork-demo-standalone-gateway',
      type: 'rust-crate',
      surface: 'backend',
    },
    contracts: {
      dependencyApiSurfaces: [
        {
          workspace: 'sdkwork-iam',
          sdkFamily: 'sdkwork-iam-app-sdk',
          surface: 'app-api',
          apiPrefix: '/app/v3/api',
          runtimeMode: 'same-origin-mounted',
          cargoDependency: 'sdkwork_api_iam_assembly',
          embeddedExecutableExport: 'sdkwork_api_iam_assembly::assemble_api_business_router',
          coverageEvidence: ['src/main.rs#assemble_api_router'],
        },
      ],
    },
  });
  writeText(
    path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-api-demo-standalone-gateway"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork_api_iam_assembly.workspace = true',
      '',
    ].join('\n'),
  );

  const resolution = resolveComposition(root);
  const iam = resolution.integrations.find((entry) => entry.workspace === 'sdkwork-iam-app-sdk');

  assert.ok(iam);
  assert.equal(iam.runtimeMode, 'same-origin-embedded');
  assert.equal(iam.connectivityPlane, 'application');
  assert.equal(iam.mountStatus, 'verified');
  assert.equal(iam.envKey, null);
  assert.equal(resolution.requiresPlatformApiSurface, false);
});

test('resolveComposition includes cross-stack architecture summary', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-composition-architecture-'));
  writeJson(path.join(root, 'specs/component.spec.json'), {
    component: { name: 'sdkwork-demo', type: 'application-root' },
    composition: { consumerIntegrationsExempt: true },
    contracts: {
      dependencyApiSurfaces: [
        {
          workspace: 'sdkwork-iam-app-sdk',
          surface: 'app-api',
          runtimeMode: 'external-service',
          apiPrefix: '/app/v3/api/iam',
        },
      ],
    },
  });
  const appRoot = path.join(root, 'apps/sdkwork-demo-pc');
  writeJson(path.join(appRoot, 'sdkwork.app.config.json'), {
    schemaVersion: 1,
    applicationCode: 'demo',
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-demo-pc-core/package.json'), {
    name: '@sdkwork/demo-pc-core',
    version: '0.0.0',
  });
  fs.mkdirSync(path.join(appRoot, 'packages/sdkwork-demo-pc-core/src/composition'), { recursive: true });
  writeJson(path.join(appRoot, 'packages/sdkwork-demo-pc-core/specs/component.spec.json'), {
    component: {
      name: '@sdkwork/demo-pc-core',
      type: 'frontend-core',
      root: 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-core',
      domain: 'demo',
      capability: 'core',
      languages: ['typescript'],
    },
    contracts: {
      layerRole: 'frontend-core',
      publicExports: ['.', './composition'],
      providedPorts: [],
      requiredPorts: [],
      sdkDependencies: [],
    },
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-demo-pc-chat/package.json'), {
    name: '@sdkwork/demo-pc-chat',
    version: '0.0.0',
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-demo-pc-chat/specs/component.spec.json'), {
    component: {
      name: '@sdkwork/demo-pc-chat',
      type: 'react-package',
      root: 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-chat',
      domain: 'demo',
      capability: 'chat',
      languages: ['typescript'],
    },
    contracts: {
      layerRole: 'frontend-feature',
      publicExports: ['.'],
      providedPorts: [{ name: 'chatServices', export: '.' }],
      requiredPorts: [{ name: 'demoSdk', export: '.' }],
    },
  });
  writeText(
    path.join(root, 'crates/sdkwork-demo-chat-service/Cargo.toml'),
    '[package]\nname = "sdkwork-demo-chat-service"\nversion = "0.0.0"\n',
  );
  writeJson(path.join(root, 'crates/sdkwork-routes-chat-app-api/specs/component.spec.json'), {
    component: {
      name: 'sdkwork-routes-chat-app-api',
      type: 'rust-route-crate',
      root: 'crates/sdkwork-routes-chat-app-api',
      domain: 'demo',
      capability: 'chat',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'backend-route',
      publicExports: ['.'],
      runtimeEntrypoints: ['build_sdkwork_chat_app_api_router'],
      routeManifest: 'sdks/_route-manifests/app-api/sdkwork-routes-chat-app-api.route-manifest.json',
    },
  });
  writeJson(path.join(root, 'sdks/_route-manifests/app-api/sdkwork-routes-chat-app-api.route-manifest.json'), {
    kind: 'sdkwork.route.manifest',
    surface: 'app-api',
    packageName: 'sdkwork-routes-chat-app-api',
    routes: [{ method: 'GET', path: '/app/v3/api/chat/messages', operationId: 'chat.messages.list' }],
  });

  const resolution = resolveComposition(root);

  assert.ok(resolution.architecture.components.some((entry) => entry.name === '@sdkwork/demo-pc-chat'));
  assert.ok(resolution.architecture.frontend.packages.some((entry) => entry.name === '@sdkwork/demo-pc-chat'));
  assert.ok(resolution.architecture.rust.crates.some((entry) => entry.packageName === 'sdkwork-demo-chat-service'));
  assert.ok(resolution.architecture.routes.manifests.some((entry) => entry.packageName === 'sdkwork-routes-chat-app-api'));
  assert.ok(resolution.architecture.runtime.dependencyApiSurfaces.some((entry) => entry.workspace === 'sdkwork-iam-app-sdk'));
});

test('standards repositories are exempt from consumer SDK dependency requirements', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-composition-standards-'));
  writeText(path.join(root, 'README.md'), '# SDKWork Standards\n\nrepository-kind: standards\n');

  const resolution = resolveComposition(root);

  assert.equal(resolution.issues.includes('no sdkDependencies found in consumer core component.spec.json files'), false);
});
