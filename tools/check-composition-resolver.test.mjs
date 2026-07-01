#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  deriveFoundationEnvFromResolution,
  resolveComposition,
  validateCompositionResolution,
} from './lib/composition-resolver.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clawRouterRoot = path.resolve(__dirname, '../../../sdkwork-clawrouter');

test('resolveComposition derives platform IAM integration from clawrouter sdkDependencies', () => {
  if (!fs.existsSync(clawRouterRoot)) return;

  const resolution = resolveComposition(clawRouterRoot);
  const iam = resolution.integrations.find((entry) => entry.workspace === 'sdkwork-iam-app-sdk');
  assert.ok(iam, 'expected sdkwork-iam-app-sdk integration');
  assert.equal(iam.connectivityPlane, 'platform');
  assert.equal(iam.runtimeMode, 'external-via-platform-gateway');
  assert.equal(iam.forbidProductSameOriginFallback, true);
  assert.equal(resolution.requiresPlatformGatewayProcess, true);
  assert.ok(
    resolution.permissions.inheritedManifests.some((entry) => entry.workspace === 'sdkwork-iam-app-sdk'),
    'expected IAM permission manifest inheritance',
  );
});

test('validateCompositionResolution rejects platform IAM falling back to product same-origin URL', () => {
  const resolution = {
    issues: [],
    integrations: [
      {
        workspace: 'sdkwork-iam-app-sdk',
        envKey: 'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
        connectivityPlane: 'platform',
        forbidProductSameOriginFallback: true,
      },
    ],
  };

  const issues = validateCompositionResolution(resolution, {
    observedEnv: {
      VITE_SDKWORK_APPBASE_APP_API_BASE_URL: '/app/v3/api',
    },
    productAppApiBaseUrl: '/app/v3/api',
  });

  assert.ok(issues.length >= 1);
  assert.match(issues[0], /must not fall back to product same-origin/u);
});

test('deriveFoundationEnvFromResolution maps platform dependencies to gateway origin', () => {
  const resolution = {
    env: {},
    integrations: [
      {
        workspace: 'sdkwork-iam-app-sdk',
        envKey: 'VITE_SDKWORK_APPBASE_APP_API_BASE_URL',
        runtimeMode: 'external-via-platform-gateway',
        apiPrefix: '/app/v3/api',
      },
      {
        workspace: 'sdkwork-drive-app-sdk',
        envKey: 'VITE_SDKWORK_DRIVE_APP_API_BASE_URL',
        runtimeMode: 'external-via-platform-gateway',
        apiPrefix: '/app/v3/api',
      },
    ],
  };

  const env = deriveFoundationEnvFromResolution(resolution, {
    platformGatewayOrigin: 'http://127.0.0.1:3902',
    productAppApiBaseUrl: '/app/v3/api',
    productBackendApiBaseUrl: 'http://127.0.0.1:3900/backend/v3/api',
  });

  assert.equal(env.VITE_SDKWORK_APPBASE_APP_API_BASE_URL, 'http://127.0.0.1:3902/app/v3/api');
  assert.equal(env.VITE_SDKWORK_DRIVE_APP_API_BASE_URL, 'http://127.0.0.1:3902/app/v3/api');
});
