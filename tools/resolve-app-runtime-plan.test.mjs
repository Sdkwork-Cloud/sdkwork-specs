import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveRuntimePlan } from './resolve-app-runtime-plan.mjs';

function rootWithTopology(processes) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-runtime-plan-'));
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'etc', 'topology'), { recursive: true });
  fs.writeFileSync(path.join(root, 'specs', 'topology.spec.json'), JSON.stringify({
    schemaVersion: 5,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    profileFiles: {
      'cloud.development': 'etc/topology/cloud.development.env',
      'standalone.development': 'etc/topology/standalone.development.env',
    },
    surfaces: {
      'application.public-ingress': { httpUrlEnv: 'APP_URL' },
      'platform.api-gateway': { httpUrlEnv: 'PLATFORM_URL' },
    },
    orchestration: {
      profiles: {
        'cloud.development': {
          processes,
          healthSurfaces: ['application.public-ingress', 'platform.api-gateway'],
        },
        'standalone.development': { processes, healthSurfaces: [] },
      },
    },
  }));
  fs.writeFileSync(path.join(root, 'etc', 'topology', 'cloud.development.env'), [
    'APP_URL=https://api.dev.sdkwork.com/application',
    'PLATFORM_URL=https://api.dev.sdkwork.com',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'etc', 'topology', 'standalone.development.env'), '');
  return root;
}

test('resolves cloud development clients and endpoint provenance', () => {
  const root = rootWithTopology([{ id: 'api-client', role: 'client' }]);
  const plan = resolveRuntimePlan(root, {
    deploymentProfile: 'cloud',
    environment: 'development',
    runtimeTarget: 'browser',
  });
  assert.equal(plan.activeProfile, 'cloud.development');
  assert.equal(plan.localGateway, null);
  assert.deepEqual(plan.forbiddenProcesses, []);
  assert.deepEqual(plan.remoteSurfaces, ['application.public-ingress', 'platform.api-gateway']);
  assert.equal(plan.endpointProvenance['application.public-ingress'].key, 'APP_URL');
});

test('filters scoped processes by runtime target and keeps shared processes', () => {
  const root = rootWithTopology([
    { id: 'shared-client', role: 'client' },
    { id: 'browser-client', role: 'client', runtimeTargets: ['browser'] },
    { id: 'desktop-client', role: 'client', runtimeTargets: ['desktop'] },
  ]);
  const browserPlan = resolveRuntimePlan(root, {
    deploymentProfile: 'cloud',
    environment: 'development',
    runtimeTarget: 'browser',
  });
  const desktopPlan = resolveRuntimePlan(root, {
    deploymentProfile: 'cloud',
    environment: 'development',
    runtimeTarget: 'desktop',
  });

  assert.deepEqual(
    browserPlan.localProcesses.map((process) => process.id),
    ['shared-client', 'browser-client'],
  );
  assert.deepEqual(
    desktopPlan.localProcesses.map((process) => process.id),
    ['shared-client', 'desktop-client'],
  );
});

test('filters same-runtime clients by canonical client architecture', () => {
  const root = rootWithTopology([
    { id: 'shared-gateway-tunnel', role: 'tunnel' },
    { id: 'pc-web-client', role: 'client', runtimeTargets: ['browser'], clientArchitectures: ['pc-web'] },
    { id: 'h5-client', role: 'client', runtimeTargets: ['browser'], clientArchitectures: ['h5'] },
  ]);
  const pcPlan = resolveRuntimePlan(root, {
    deploymentProfile: 'cloud',
    environment: 'development',
    runtimeTarget: 'browser',
  });
  const h5Plan = resolveRuntimePlan(root, {
    deploymentProfile: 'cloud',
    environment: 'development',
    runtimeTarget: 'browser',
    clientArchitecture: 'h5',
  });

  assert.equal(pcPlan.clientArchitecture, 'pc-web');
  assert.deepEqual(pcPlan.localProcesses.map((process) => process.id), [
    'shared-gateway-tunnel', 'pc-web-client',
  ]);
  assert.deepEqual(h5Plan.localProcesses.map((process) => process.id), [
    'shared-gateway-tunnel', 'h5-client',
  ]);
});

test('reports forbidden cloud development process roles', () => {
  const root = rootWithTopology([
    { id: 'local-api', role: 'api-standalone-gateway' },
    { id: 'edge.device-ingress', role: 'edge-runtime' },
  ]);
  const plan = resolveRuntimePlan(root, {
    deploymentProfile: 'cloud',
    environment: 'development',
    runtimeTarget: 'browser',
  });
  assert.deepEqual(plan.forbiddenProcesses, ['local-api', 'edge.device-ingress']);
});

test('fails closed when a standalone HTTP plan has no gateway', () => {
  const root = rootWithTopology([{ id: 'api-client', role: 'client' }]);
  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /exactly one api-standalone-gateway/u,
  );
});
