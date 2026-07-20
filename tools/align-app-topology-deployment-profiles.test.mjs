import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const ALIGNER = path.resolve('tools/align-app-topology-deployment-profiles.mjs');

function makeWorkspace() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-align-topology-'));
  const repoRoot = path.join(workspace, 'sdkwork-demo');
  fs.mkdirSync(path.join(repoRoot, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'etc', 'topology'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'sdkwork.app.config.json'),
    `${JSON.stringify({
      schemaVersion: 3,
      kind: 'sdkwork.app',
      app: { key: 'sdkwork-demo', name: 'Demo' },
      runtime: { supportedDeploymentProfiles: ['standalone', 'cloud'] },
    }, null, 2)}\n`,
  );
  return { workspace, repoRoot };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function runAligner(workspace, repo = 'sdkwork-demo') {
  return spawnSync(
    process.execPath,
    [ALIGNER, '--workspace', workspace, '--repo', repo],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  );
}

test('migrates topology specs from retired serviceLayout profiles to two-segment profiles', () => {
  const { workspace, repoRoot } = makeWorkspace();
  fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'scripts/gateway-cloud-bundle.mjs'), '');
  writeJson(path.join(repoRoot, 'package.json'), { scripts: {} });
  writeJson(path.join(repoRoot, 'specs', 'topology.spec.json'), {
    schemaVersion: 2,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    profileRoot: 'etc/topology',
    profilePattern: '{deploymentProfile}.{serviceLayout}.{environment}.env',
    vocabulary: {
      deploymentProfile: { allowed: ['standalone', 'cloud'] },
      serviceLayout: { allowed: ['unified-process', 'split-services'] },
      environment: { allowed: ['development', 'production'] },
    },
    defaults: {
      developmentProfileId: 'standalone.unified-process.development',
      productionProfileId: 'cloud.split-services.production',
      desktopBuildProfileId: 'standalone.unified-process.production',
    },
    profileFiles: {
      'standalone.unified-process.development': 'etc/topology/standalone.unified-process.development.env',
      'cloud.split-services.production': 'etc/topology/cloud.split-services.production.env',
    },
    envKeys: {
      deploymentProfile: 'SDKWORK_DEMO_DEPLOYMENT_PROFILE',
      serviceLayout: 'SDKWORK_DEMO_SERVICE_LAYOUT',
      environment: 'SDKWORK_DEMO_ENVIRONMENT',
      profileId: 'SDKWORK_DEMO_PROFILE_ID',
    },
    components: {
      standaloneGateway: {
        crate: 'sdkwork-api-demo-standalone-gateway',
        binary: 'sdkwork-api-demo-standalone-gateway',
      },
    },
    surfaces: {
      'application.public-ingress': {
        connectivityPlane: 'application',
        protocols: ['http'],
        bindEnv: 'SDKWORK_DEMO_APPLICATION_PUBLIC_INGRESS_BIND',
        httpUrlEnv: 'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL',
        clientHttpEnv: 'VITE_SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL',
      },
      'application.backend-http': {
        connectivityPlane: 'application',
        protocols: ['http'],
        httpUrlEnv: 'SDKWORK_DEMO_APPLICATION_BACKEND_HTTP_URL',
        clientHttpEnv: 'VITE_SDKWORK_DEMO_APPLICATION_BACKEND_HTTP_URL',
      },
    },
    cloudPublicHosts: {
      'application.public-ingress': { httpHost: 'demo.sdkwork.com' },
    },
    orchestration: {
      profiles: {
        'standalone.unified-process.development': {
          processes: [
            {
              id: 'application.public-ingress',
              crate: 'sdkwork-api-demo-standalone-gateway',
              binary: 'sdkwork-api-demo-standalone-gateway',
            },
          ],
        },
      },
    },
  });
  fs.writeFileSync(
    path.join(repoRoot, 'etc/topology/standalone.unified-process.development.env'),
    [
      '# standalone.unified-process.development',
      'SDKWORK_DEMO_DEPLOYMENT_PROFILE=standalone',
      'SDKWORK_DEMO_SERVICE_LAYOUT=unified-process',
      'SDKWORK_DEMO_ENVIRONMENT=development',
      'SDKWORK_DEMO_PROFILE_ID=standalone.unified-process.development',
      '',
    ].join('\r\n'),
  );
  fs.writeFileSync(
    path.join(repoRoot, 'etc/topology/cloud.split-services.production.env'),
    [
      '# cloud.split-services.production',
      'SDKWORK_DEMO_DEPLOYMENT_PROFILE=cloud',
      'SDKWORK_DEMO_SERVICE_LAYOUT=split-services',
      'SDKWORK_DEMO_ENVIRONMENT=production',
      'SDKWORK_DEMO_PROFILE_ID=cloud.split-services.production',
      '',
    ].join('\n'),
  );

  const result = runAligner(workspace);

  assert.equal(result.status, 0, result.stderr);
  const topology = JSON.parse(fs.readFileSync(path.join(repoRoot, 'specs/topology.spec.json'), 'utf8'));
  assert.equal(topology.schemaVersion, 5);
  assert.equal(topology.cloudIngress, undefined);
  assert.equal(topology.components?.cloudGateway, undefined);
  assert.deepEqual(topology.vocabulary.deploymentProfile.allowed, ['standalone', 'cloud']);
  assert.equal(topology.vocabulary.serviceLayout, undefined);
  assert.equal(topology.retired?.vocabulary?.serviceLayout, undefined);
  assert.notEqual(topology.retired?.envKeys?.includes('SDKWORK_DEMO_SERVICE_LAYOUT'), true);
  assert.equal(topology.profilePattern, '{deploymentProfile}.{environment}.env');
  assert.deepEqual(Object.keys(topology.profileFiles).sort(), [
    'cloud.development',
    'cloud.production',
    'standalone.development',
    'standalone.production',
  ]);
  assert.equal(topology.envKeys.serviceLayout, undefined);
  assert.equal(topology.defaults.developmentProfileId, 'standalone.development');
  assert.equal(topology.defaults.productionProfileId, 'cloud.production');
  assert.ok(topology.orchestration.profiles['standalone.development']);
  assert.equal(
    topology.orchestration.profiles['standalone.development'].processes[0].role,
    'api-standalone-gateway',
  );
  assert.ok(topology.orchestration.profiles['cloud.production']);
  assert.equal(fs.existsSync(path.join(repoRoot, 'etc/topology/standalone.unified-process.development.env')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'etc/topology/cloud.split-services.production.env')), false);
  const standaloneEnv = fs.readFileSync(path.join(repoRoot, 'etc/topology/standalone.development.env'), 'utf8');
  assert.doesNotMatch(standaloneEnv, /\r/u);
  assert.match(standaloneEnv, /SDKWORK_DEMO_PROFILE_ID=standalone\.development/);
  assert.doesNotMatch(standaloneEnv, /SERVICE_LAYOUT|unified-process|split-services/);
  const cloudDevelopmentEnv = fs.readFileSync(
    path.join(repoRoot, 'etc/topology/cloud.development.env'),
    'utf8',
  );
  assert.doesNotMatch(cloudDevelopmentEnv, /\r/u);
  assert.match(cloudDevelopmentEnv, /SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https:\/\/demo\.sdkwork\.com/);
  assert.doesNotMatch(cloudDevelopmentEnv, /SDKWORK_DEMO_APPLICATION_BACKEND_HTTP_URL=/);
  assert.match(cloudDevelopmentEnv, /SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https:\/\/api\.sdkwork\.com/);
  assert.doesNotMatch(cloudDevelopmentEnv, /PLATFORM_API_GATEWAY_AUTOSTART/);
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['gateway:package:cloud'], undefined);
  assert.equal(packageJson.scripts['gateway:validate:cloud'], undefined);

  topology.orchestration.profiles['cloud.development'].processes = [
    {
      id: 'demo-h5',
      role: 'client',
      script: '_sdkwork:client:h5:cloud',
      runtimeTargets: ['browser'],
      clientArchitectures: ['h5'],
      required: true,
    },
    {
      id: 'demo-flutter-android',
      role: 'client',
      script: '_sdkwork:client:flutter-android:cloud',
      runtimeTargets: ['flutter-android'],
      clientArchitectures: ['flutter'],
      required: true,
    },
  ];
  writeJson(path.join(repoRoot, 'specs/topology.spec.json'), topology);

  const topologyAfterFirstRun = fs.readFileSync(
    path.join(repoRoot, 'specs/topology.spec.json'),
    'utf8',
  );
  const secondResult = runAligner(workspace);
  assert.equal(secondResult.status, 0, secondResult.stderr);
  assert.equal(
    fs.readFileSync(path.join(repoRoot, 'specs/topology.spec.json'), 'utf8'),
    topologyAfterFirstRun,
  );
  assert.match(secondResult.stdout, /Total actions: 0/u);
});

test('does not invent a v5 executable gateway for an explicitly declared domain library', () => {
  const { workspace, repoRoot } = makeWorkspace();
  const topology = {
    schemaVersion: 4,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    components: {
      appApiRouter: {
        crate: 'sdkwork-routes-demo-app-api',
        library: 'sdkwork_routes_demo_app_api',
      },
      cloudGateway: {
        crate: 'sdkwork-api-cloud-gateway',
        binary: 'sdkwork-api-cloud-gateway',
      },
    },
    orchestration: {
      profiles: {
        'standalone.development': { processes: [] },
        'standalone.production': { processes: [] },
      },
    },
    retired: {
      notes: 'sdkwork-demo is a domain library. Host applications own executable gateways.',
    },
  };
  writeJson(path.join(repoRoot, 'specs', 'topology.spec.json'), topology);
  const before = fs.readFileSync(path.join(repoRoot, 'specs', 'topology.spec.json'), 'utf8');

  const result = runAligner(workspace);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Total actions: 0/u);
  assert.equal(fs.readFileSync(path.join(repoRoot, 'specs', 'topology.spec.json'), 'utf8'), before);
});

test('bootstraps from a unique standalone gateway binary', () => {
  const { workspace, repoRoot } = makeWorkspace();
  const gatewayRoot = path.join(repoRoot, 'crates', 'sdkwork-api-demo-standalone-gateway');
  fs.mkdirSync(gatewayRoot, { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'Cargo.toml'), [
    '[workspace]',
    'members = [',
    '  "crates/sdkwork-api-demo-standalone-gateway",',
    ']',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(gatewayRoot, 'Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-demo-standalone-gateway"',
    '[[bin]]',
    'name = "sdkwork-api-demo-standalone-gateway"',
    'path = "src/main.rs"',
    '',
  ].join('\n'));

  const result = runAligner(workspace);

  assert.equal(result.status, 0, result.stderr);
  const topology = JSON.parse(fs.readFileSync(path.join(repoRoot, 'specs', 'topology.spec.json'), 'utf8'));
  assert.deepEqual(topology.components.applicationServer, {
    crate: 'sdkwork-api-demo-standalone-gateway',
    binary: 'sdkwork-api-demo-standalone-gateway',
  });
});
