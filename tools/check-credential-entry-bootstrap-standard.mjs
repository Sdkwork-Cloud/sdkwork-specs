#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));

function parseWorkspaceRoot(argv) {
  const index = argv.indexOf('--workspace');
  return path.resolve(index >= 0 ? argv[index + 1] : path.join(scriptRoot, '..', '..'));
}

function readRequired(workspaceRoot, relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`missing credential-entry contract file: ${relativePath}`);
  }
  return readFileSync(filePath, 'utf8');
}

function requireMarkers(source, relativePath, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      throw new Error(`${relativePath} must contain ${marker}`);
    }
  }
}

function forbidPatterns(source, relativePath, patterns) {
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      throw new Error(`${relativePath} contains forbidden credential-entry fork: ${pattern}`);
    }
  }
}

const workspaceRoot = parseWorkspaceRoot(process.argv.slice(2));
const viteConsumers = [
  'sdkwork-manager/apps/sdkwork-manager-pc/vite.config.ts',
  'sdkwork-im/apps/sdkwork-im-pc/vite.config.ts',
  'sdkwork-im/apps/sdkwork-im-h5/vite.config.ts',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/vite.config.ts',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-h5/vite.config.ts',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web/vite.config.ts',
  'sdkwork-clawrouter/apps/sdkwork-clawrouter-pc/vite.config.ts',
];

for (const relativePath of viteConsumers) {
  const source = readRequired(workspaceRoot, relativePath);
  requireMarkers(source, relativePath, ['createSdkworkCredentialEntryBootstrapVitePlugin']);
  if (
    !source.includes('@sdkwork/iam-credential-entry/vite')
    && !source.includes('sdkwork-iam-credential-entry/src/vite.ts')
  ) {
    throw new Error(`${relativePath} must consume the canonical IAM Vite component entry`);
  }
  forbidPatterns(source, relativePath, [
    /['"]process\.env\.SDKWORK_ACCESS_TOKEN['"]\s*:/u,
    /VITE_[A-Z0-9_]*ACCESS_TOKEN/u,
    /serializeCredentialEntryBootstrapForInlineScript/u,
  ]);
}

const nodeConsumers = [
  'sdkwork-manager/scripts/dev/manager-dev.mjs',
  'sdkwork-im/scripts/dev/sdkwork-im-bootstrap-access-token.mjs',
  'sdkwork-birdcoder/scripts/birdcoder-iam-env.mjs',
  'sdkwork-clawrouter/scripts/dev/claw-router-application-env.mjs',
];

for (const relativePath of nodeConsumers) {
  const source = readRequired(workspaceRoot, relativePath);
  requireMarkers(source, relativePath, [
    'sdkwork-iam/scripts/dev/create-dev-bootstrap-access-token-env.mjs',
  ]);
  forbidPatterns(source, relativePath, [
    /function\s+createTestJwt\s*\(/u,
    /function\s+createDevBootstrapAccessTokenJwt\s*\(/u,
    /function\s+resolveRepoApplicationManifestPath\s*\(/u,
  ]);
}

for (const relativePath of [
  'sdkwork-im/scripts/dev/sdkwork-im-bootstrap-access-token.mjs',
  'sdkwork-birdcoder/scripts/birdcoder-iam-env.mjs',
]) {
  const source = readRequired(workspaceRoot, relativePath);
  forbidPatterns(source, relativePath, [/createTestJwt/u]);
}

const retiredBirdCoderFork = path.join(
  workspaceRoot,
  'sdkwork-birdcoder/scripts/lib/birdcoder-dev-bootstrap-access-token-env.mjs',
);
if (existsSync(retiredBirdCoderFork)) {
  throw new Error('BirdCoder local bootstrap helper fork must remain deleted');
}

const birdCoderViteHelperPath = 'sdkwork-birdcoder/scripts/create-birdcoder-vite-plugins.mjs';
forbidPatterns(readRequired(workspaceRoot, birdCoderViteHelperPath), birdCoderViteHelperPath, [
  /createBirdcoderCredentialEntryBootstrapPlugin/u,
  /__SDKWORK_IAM_CREDENTIAL_ENTRY_ENV__/u,
  /patchCredentialEntryBootstrapTokenSource/u,
]);

const privateBootstrapTemplates = [
  'sdkwork-manager/apps/sdkwork-manager-pc/.env.example',
  'sdkwork-manager/apps/sdkwork-manager-pc/.env.development.example',
  'sdkwork-im/apps/sdkwork-im-pc/.env.example',
  'sdkwork-im/apps/sdkwork-im-h5/.env.example',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/.env.example',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-h5/.env.example',
  'sdkwork-clawrouter/apps/sdkwork-clawrouter-pc/.env.development.example',
];
for (const relativePath of privateBootstrapTemplates) {
  const source = readRequired(workspaceRoot, relativePath);
  if (!/^SDKWORK_ACCESS_TOKEN=[ \t]*$/mu.test(source)) {
    throw new Error(`${relativePath} must declare a blank private SDKWORK_ACCESS_TOKEN placeholder`);
  }
  if (/^SDKWORK_ACCESS_TOKEN=[ \t]*\S+/mu.test(source)) {
    throw new Error(`${relativePath} must not contain a resolved bootstrap token`);
  }
}

for (const relativePath of [
  'sdkwork-manager/apps/sdkwork-manager-pc/.env.production.example',
  'sdkwork-clawrouter/apps/sdkwork-clawrouter-pc/.env.production.example',
]) {
  const source = readRequired(workspaceRoot, relativePath);
  if (/^SDKWORK_ACCESS_TOKEN=/mu.test(source)) {
    throw new Error(`${relativePath} is browser-public and must not declare SDKWORK_ACCESS_TOKEN`);
  }
}

const sharedDualTokenHeaderConsumers = [
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/sdkClients.ts',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/appSessionRefresh.ts',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-infrastructure/src/services/runtimeServerSession.ts',
  'sdkwork-birdcoder/apps/sdkwork-birdcoder-h5/packages/sdkwork-birdcoder-h5-admin-core/src/sdk/backendSdkTransportBootstrap.ts',
  'sdkwork-clawrouter/sdks/clawrouter-app-sdk/clawrouter-app-sdk-typescript/src/http/client.ts',
  'sdkwork-clawrouter/sdks/clawrouter-app-sdk/clawrouter-app-sdk-typescript/generated/server-openapi/src/http/client.ts',
  'sdkwork-clawrouter/sdks/clawrouter-app-sdk/clawrouter-app-sdk-typescript/generated/domains/server-openapi/src/http/client.ts',
  'sdkwork-clawrouter/sdks/clawrouter-backend-sdk/clawrouter-backend-sdk-typescript/src/http/client.ts',
  'sdkwork-clawrouter/sdks/clawrouter-backend-sdk/clawrouter-backend-sdk-typescript/generated/server-openapi/src/http/client.ts',
  'sdkwork-clawrouter/sdks/clawrouter-backend-sdk/clawrouter-backend-sdk-typescript/generated/domains/server-openapi/src/http/client.ts',
];

for (const relativePath of sharedDualTokenHeaderConsumers) {
  const source = readRequired(workspaceRoot, relativePath);
  requireMarkers(source, relativePath, ['buildAuthHeaders']);
  forbidPatterns(source, relativePath, [
    /['"]Access-Token['"]\s*:/u,
    /['"]Authorization['"]\s*:\s*[^,}]*Bearer/u,
  ]);
}

const clawRouterSdkStandardizerPath =
  'sdkwork-clawrouter/tools/clawrouter_sdk_runtime_standardizer.py';
requireMarkers(
  readRequired(workspaceRoot, clawRouterSdkStandardizerPath),
  clawRouterSdkStandardizerPath,
  [
    "buildAuthHeaders('dual-token', undefined, tokenManager)",
    'shared_dual_token',
    'updated.replace(dual_token, shared_dual_token, 1)',
  ],
);

console.log('SDKWork credential-entry bootstrap standard check passed.');
