import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveRuntimePlan } from './resolve-app-runtime-plan.mjs';

test('runtime-plan schema requires resolved architecture-scoped browser deliveries', () => {
  const schema = JSON.parse(fs.readFileSync(
    path.resolve(import.meta.dirname, '..', 'schemas', 'sdkwork.runtime-plan.schema.v1.json'),
    'utf8',
  ));
  assert.ok(schema.required.includes('browserDeliveries'));
  const delivery = schema.properties.browserDeliveries.items;
  assert.ok(delivery.required.includes('clientArchitectures'));
  assert.ok(delivery.required.includes('browserVisibleOrigin'));
  assert.ok(delivery.required.includes('apiTargetOrigin'));
  assert.equal(delivery.properties.browserVisibleOrigin.pattern, '^https?://[^/?#]+$');
  assert.equal(delivery.properties.apiTargetOrigin.pattern, '^https?://[^/?#]+$');
  assert.deepEqual(delivery.properties.preserveCanonicalPaths, { const: true });
});

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
      'platform.api-gateway': {
        httpUrlEnv: 'PLATFORM_URL',
        clientHttpEnv: 'PLATFORM_CLIENT_URL',
      },
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

function rootWithStandaloneDevBrowserDelivery(deliveryOverrides = {}, appUrl = 'http://127.0.0.1:3800') {
  const root = rootWithTopology([
    { id: 'standalone-gateway', role: 'api-standalone-gateway' },
    {
      id: 'pc-browser',
      role: 'client',
      applicationRoot: 'apps/demo-pc',
      bindEnv: 'PC_BIND',
      runtimeTargets: ['browser'],
      clientArchitectures: ['pc-web'],
    },
  ]);
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  topology.orchestration.profiles['standalone.development'].browserDeliveries = [{
    id: 'demo-pc',
    applicationRoot: 'apps/demo-pc',
    clientArchitectures: ['pc-web'],
    originMode: 'same-origin',
    deliveryMode: 'dev-server-proxy',
    clientProcessId: 'pc-browser',
    apiSurfaceId: 'application.public-ingress',
    preserveCanonicalPaths: true,
    ...deliveryOverrides,
  }];
  fs.writeFileSync(topologyPath, JSON.stringify(topology));
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.development.env'),
    `APP_URL=${appUrl}\nPC_BIND=127.0.0.1:5182\n`,
  );
  return root;
}

function rootWithStandaloneProductionBrowserDelivery(deliveryOverrides = {}) {
  const root = rootWithTopology([
    { id: 'application.public-ingress', role: 'api-standalone-gateway' },
  ]);
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  topology.profileFiles['standalone.production'] = 'etc/topology/standalone.production.env';
  topology.orchestration.profiles['standalone.production'] = {
    processes: [{ id: 'application.public-ingress', role: 'api-standalone-gateway' }],
    browserDeliveries: [{
      id: 'demo-pc',
      applicationRoot: 'apps/demo-pc',
      clientArchitectures: ['pc-web'],
      originMode: 'same-origin',
      deliveryMode: 'gateway-static',
      hostProcessId: 'application.public-ingress',
      apiSurfaceId: 'application.public-ingress',
      buildOutput: 'apps/demo-pc/dist',
      runtimeRootEnv: 'PC_STATIC_ROOT',
      mountPath: '/',
      spaFallback: '/index.html',
      ...deliveryOverrides,
    }],
  };
  fs.writeFileSync(topologyPath, JSON.stringify(topology));
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.production.env'),
    'APP_URL=http://127.0.0.1:3800\nPC_STATIC_ROOT=apps/demo-pc/dist\n',
  );
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

test('rejects a standalone platform gateway URL instead of resolving a second API origin', () => {
  const root = rootWithTopology([{ id: 'standalone-gateway', role: 'api-standalone-gateway' }]);
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.development.env'),
    [
      'APP_URL=http://127.0.0.1:3800',
      'PLATFORM_URL=http://127.0.0.1:3900',
      '',
    ].join('\n'),
  );

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /must not resolve PLATFORM_URL; standalone dependency APIs are embedded in application\.public-ingress/u,
  );
});

test('rejects a standalone browser platform gateway URL key', () => {
  const root = rootWithTopology([{ id: 'standalone-gateway', role: 'api-standalone-gateway' }]);
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.development.env'),
    [
      'APP_URL=http://127.0.0.1:3800',
      'PLATFORM_CLIENT_URL=http://127.0.0.1:3900',
      '',
    ].join('\n'),
  );

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /must not resolve PLATFORM_CLIENT_URL; standalone dependency APIs are embedded in application\.public-ingress/u,
  );
});

test('standalone runtime plans expose only application public ingress', () => {
  const root = rootWithTopology([{ id: 'standalone-gateway', role: 'api-standalone-gateway' }]);
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.development.env'),
    'APP_URL=http://127.0.0.1:3800\n',
  );

  const plan = resolveRuntimePlan(root, {
    deploymentProfile: 'standalone',
    environment: 'development',
    runtimeTarget: 'browser',
  });

  assert.equal(plan.resolvedBaseUrls['application.public-ingress'], 'http://127.0.0.1:3800');
  assert.equal(plan.resolvedBaseUrls['platform.api-gateway'], undefined);
  assert.deepEqual(plan.remoteSurfaces, []);
});

test('rejects runtime-plan browser delivery with a non-same-origin mode', () => {
  const root = rootWithStandaloneDevBrowserDelivery({ originMode: 'cross-origin' });

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /must use originMode same-origin/u,
  );
});

test('rejects runtime-plan browser delivery that targets the platform gateway', () => {
  const root = rootWithStandaloneDevBrowserDelivery({
    apiSurfaceId: 'platform.api-gateway',
  });

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /must target application\.public-ingress/u,
  );
});

test('rejects a non-canonical development proxy in runtime-plan resolution', () => {
  const root = rootWithStandaloneDevBrowserDelivery({ preserveCanonicalPaths: false });

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /must preserve canonical API paths/u,
  );
});

test('rejects mixed dev-proxy and gateway-static fields in runtime-plan resolution', () => {
  const root = rootWithStandaloneDevBrowserDelivery({
    hostProcessId: 'standalone-gateway',
  });

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /dev-server-proxy must not declare hostProcessId/u,
  );
});

test('rejects gateway-static delivery in standalone development runtime plans', () => {
  const root = rootWithStandaloneDevBrowserDelivery({ deliveryMode: 'gateway-static' });

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /standalone\.development browser delivery demo-pc must use dev-server-proxy/u,
  );
});

test('rejects non-HTTP application ingress origins for browser delivery', () => {
  const root = rootWithStandaloneDevBrowserDelivery({}, 'ws://127.0.0.1:3800');

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /API target must resolve to an absolute HTTP\(S\) URL/u,
  );
});

test('resolves selected PC and H5 same-origin dev proxy deliveries separately', () => {
  const root = rootWithTopology([
    { id: 'standalone-gateway', role: 'api-standalone-gateway' },
    {
      id: 'pc-browser',
      role: 'client',
      applicationRoot: 'apps/demo-pc',
      bindEnv: 'PC_BIND',
      runtimeTargets: ['browser'],
      clientArchitectures: ['pc-web'],
    },
    {
      id: 'h5-browser',
      role: 'client',
      applicationRoot: 'apps/demo-h5',
      bindEnv: 'H5_BIND',
      runtimeTargets: ['browser'],
      clientArchitectures: ['h5'],
    },
  ]);
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  topology.orchestration.profiles['standalone.development'].browserDeliveries = [
    {
      id: 'demo-pc',
      applicationRoot: 'apps/demo-pc',
      clientArchitectures: ['pc-web'],
      originMode: 'same-origin',
      deliveryMode: 'dev-server-proxy',
      clientProcessId: 'pc-browser',
      apiSurfaceId: 'application.public-ingress',
      preserveCanonicalPaths: true,
    },
    {
      id: 'demo-h5',
      applicationRoot: 'apps/demo-h5',
      clientArchitectures: ['h5'],
      originMode: 'same-origin',
      deliveryMode: 'dev-server-proxy',
      clientProcessId: 'h5-browser',
      apiSurfaceId: 'application.public-ingress',
      preserveCanonicalPaths: true,
    },
  ];
  fs.writeFileSync(topologyPath, JSON.stringify(topology));
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.development.env'),
    [
      'APP_URL=http://127.0.0.1:3800',
      'PC_BIND=127.0.0.1:5182',
      'H5_BIND=127.0.0.1:5183',
      '',
    ].join('\n'),
  );

  const pcPlan = resolveRuntimePlan(root, {
    deploymentProfile: 'standalone',
    environment: 'development',
    runtimeTarget: 'browser',
  });
  const h5Plan = resolveRuntimePlan(root, {
    deploymentProfile: 'standalone',
    environment: 'development',
    runtimeTarget: 'browser',
    clientArchitecture: 'h5',
  });

  assert.deepEqual(pcPlan.browserDeliveries.map((delivery) => delivery.id), ['demo-pc']);
  assert.equal(pcPlan.browserDeliveries[0].browserVisibleOrigin, 'http://127.0.0.1:5182');
  assert.equal(pcPlan.browserDeliveries[0].apiTargetOrigin, 'http://127.0.0.1:3800');
  assert.notEqual(
    pcPlan.browserDeliveries[0].browserVisibleOrigin,
    pcPlan.browserDeliveries[0].apiTargetOrigin,
  );
  assert.deepEqual(h5Plan.browserDeliveries.map((delivery) => delivery.id), ['demo-h5']);
  assert.equal(h5Plan.browserDeliveries[0].browserVisibleOrigin, 'http://127.0.0.1:5183');
});

test('resolves production gateway static assets on the application ingress origin', () => {
  const root = rootWithTopology([{ id: 'application.public-ingress', role: 'api-standalone-gateway' }]);
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  topology.profileFiles['standalone.production'] = 'etc/topology/standalone.production.env';
  topology.orchestration.profiles['standalone.production'] = {
    processes: [{ id: 'application.public-ingress', role: 'api-standalone-gateway' }],
    browserDeliveries: [{
      id: 'demo-pc',
      applicationRoot: 'apps/demo-pc',
      clientArchitectures: ['pc-web'],
      originMode: 'same-origin',
      deliveryMode: 'gateway-static',
      hostProcessId: 'application.public-ingress',
      apiSurfaceId: 'application.public-ingress',
      buildOutput: 'apps/demo-pc/dist',
      runtimeRootEnv: 'PC_STATIC_ROOT',
      mountPath: '/',
      spaFallback: '/index.html',
    }],
  };
  fs.writeFileSync(topologyPath, JSON.stringify(topology));
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.production.env'),
    'APP_URL=http://127.0.0.1:3800\nPC_STATIC_ROOT=apps/demo-pc/dist\n',
  );

  const plan = resolveRuntimePlan(root, {
    deploymentProfile: 'standalone',
    environment: 'production',
    runtimeTarget: 'browser',
  });

  assert.equal(plan.browserDeliveries[0].browserVisibleOrigin, 'http://127.0.0.1:3800');
  assert.equal(plan.browserDeliveries[0].apiTargetOrigin, 'http://127.0.0.1:3800');
  assert.equal(plan.browserDeliveries[0].runtimeRoot, 'apps/demo-pc/dist');
  assert.equal(plan.browserDeliveries[0].spaFallback, '/index.html');
});

test('rejects dev-server-proxy delivery in standalone production runtime plans', () => {
  const root = rootWithStandaloneProductionBrowserDelivery({
    deliveryMode: 'dev-server-proxy',
  });

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'production',
      runtimeTarget: 'browser',
    }),
    /standalone\.production browser delivery demo-pc must use gateway-static/u,
  );
});

test('rejects dev proxy delivery architecture drift at runtime-plan resolution', () => {
  const root = rootWithTopology([
    { id: 'standalone-gateway', role: 'api-standalone-gateway' },
    {
      id: 'pc-browser',
      role: 'client',
      bindEnv: 'PC_BIND',
      runtimeTargets: ['browser'],
      clientArchitectures: ['pc-web', 'h5'],
    },
  ]);
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  topology.orchestration.profiles['standalone.development'].browserDeliveries = [{
    id: 'demo-pc',
    applicationRoot: 'apps/demo-pc',
    clientArchitectures: ['pc-web'],
    originMode: 'same-origin',
    deliveryMode: 'dev-server-proxy',
    clientProcessId: 'pc-browser',
    apiSurfaceId: 'application.public-ingress',
    preserveCanonicalPaths: true,
  }];
  fs.writeFileSync(topologyPath, JSON.stringify(topology));
  fs.writeFileSync(
    path.join(root, 'etc', 'topology', 'standalone.development.env'),
    'APP_URL=http://127.0.0.1:3800\nPC_BIND=127.0.0.1:5182\n',
  );

  assert.throws(
    () => resolveRuntimePlan(root, {
      deploymentProfile: 'standalone',
      environment: 'development',
      runtimeTarget: 'browser',
    }),
    /must match its client process architectures/u,
  );
});
