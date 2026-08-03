import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkAdaptiveWebStandard } from './check-adaptive-web-standard.mjs';

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-adaptive-web-'));
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-demo-pc'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-demo-h5'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps', 'sdkwork-demo-pc', 'package.json'), '{"name":"@sdkwork/demo-pc"}');
  fs.writeFileSync(path.join(root, 'apps', 'sdkwork-demo-h5', 'package.json'), '{"name":"@sdkwork/demo-h5"}');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"sdkwork-demo","scripts":{}}');
  return root;
}

function writeTopology(root, profiles) {
  const spec = {
    schemaVersion: 5,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    applicationCode: 'demo',
    orchestration: { profiles },
  };
  fs.writeFileSync(path.join(root, 'specs', 'topology.spec.json'), JSON.stringify(spec));
}

function adaptiveDelivery() {
  return {
    id: 'demo-adaptive-web',
    applicationRoot: 'apps/sdkwork-demo-pc',
    clientArchitectures: ['pc-web', 'h5'],
    originMode: 'same-origin',
    deliveryMode: 'dev-server-proxy',
    apiSurfaceId: 'application.public-ingress',
    clientProcessId: 'im-browser',
    preserveCanonicalPaths: true,
    renderers: {
      'pc-web': {
        applicationRoot: 'apps/sdkwork-demo-pc',
        command: 'node',
        args: ['scripts/dev/run-vite.mjs', '--port', '{port}'],
        defaultPort: 4176,
        portEnv: 'DEMO_PC_RENDERER_PORT',
      },
      h5: {
        applicationRoot: 'apps/sdkwork-demo-h5',
        script: '_sdkwork:dev-server',
        defaultPort: 4178,
      },
    },
  };
}

function adaptiveProfiles() {
  return {
    'standalone.development': {
      processes: [
        {
          id: 'standalone-gateway',
          role: 'api-standalone-gateway',
          crate: 'sdkwork-demo-standalone-gateway',
        },
        {
          id: 'im-browser',
          role: 'client',
          bindEnv: 'DEMO_WEB_DEV_INGRESS_BIND',
          runtimeTargets: ['browser'],
          clientArchitectures: ['pc-web', 'h5'],
        },
      ],
      browserDeliveries: [adaptiveDelivery()],
    },
  };
}

test('passes for repositories that do not declare both pc-web and h5', () => {
  const root = fixtureRoot();
  writeTopology(root, {
    'standalone.development': {
      processes: [{ id: 'im-browser', role: 'client', clientArchitectures: ['pc-web'] }],
    },
  });
  assert.deepEqual(checkAdaptiveWebStandard(root), []);
});

test('passes for a compliant adaptive browser delivery', () => {
  const root = fixtureRoot();
  writeTopology(root, adaptiveProfiles());
  assert.deepEqual(checkAdaptiveWebStandard(root), []);
});

test('fails when both architectures are declared but the adaptive delivery is missing', () => {
  const root = fixtureRoot();
  const profiles = adaptiveProfiles();
  delete profiles['standalone.development'].browserDeliveries;
  writeTopology(root, profiles);
  const issues = checkAdaptiveWebStandard(root);
  assert.ok(issues.some((issue) => /must declare a dev-server-proxy browser delivery/u.test(issue)));
});

test('fails when a renderer architecture is missing from the adaptive delivery', () => {
  const root = fixtureRoot();
  const profiles = adaptiveProfiles();
  delete profiles['standalone.development'].browserDeliveries[0].renderers.h5;
  writeTopology(root, profiles);
  const issues = checkAdaptiveWebStandard(root);
  assert.ok(issues.some((issue) => /must declare renderers covering both pc-web and h5/u.test(issue)));
});

test('fails when a renderer cannot resolve a TCP port', () => {
  const root = fixtureRoot();
  const profiles = adaptiveProfiles();
  delete profiles['standalone.development'].browserDeliveries[0].renderers.h5.defaultPort;
  writeTopology(root, profiles);
  const issues = checkAdaptiveWebStandard(root);
  assert.ok(issues.some((issue) => /renderer h5 must resolve a TCP port/u.test(issue)));
});

test('fails when a renderer applicationRoot has no package.json', () => {
  const root = fixtureRoot();
  const profiles = adaptiveProfiles();
  profiles['standalone.development'].browserDeliveries[0].renderers['pc-web'].applicationRoot =
    'apps/missing-pc';
  writeTopology(root, profiles);
  const issues = checkAdaptiveWebStandard(root);
  assert.ok(issues.some((issue) => /applicationRoot has no package\.json/u.test(issue)));
});

test('fails when the adaptive delivery references a client without bindEnv', () => {
  const root = fixtureRoot();
  const profiles = adaptiveProfiles();
  profiles['standalone.development'].processes[1].bindEnv = undefined;
  writeTopology(root, profiles);
  const issues = checkAdaptiveWebStandard(root);
  assert.ok(issues.some((issue) => /must reference a client process with bindEnv/u.test(issue)));
});

test('fails when a retired root browser hook still exists', () => {
  const root = fixtureRoot();
  writeTopology(root, adaptiveProfiles());
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'sdkwork-demo',
      scripts: { '_sdkwork:client:browser:standalone': 'node scripts/dev/run-adaptive.mjs' },
    }),
  );
  const issues = checkAdaptiveWebStandard(root);
  assert.ok(issues.some((issue) => /retired; adaptive browser delivery is owned/u.test(issue)));
});
