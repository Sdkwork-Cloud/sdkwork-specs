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
        crate: 'sdkwork-demo-standalone-gateway',
        binary: 'sdkwork-demo-standalone-gateway',
      },
    },
    orchestration: {
      profiles: {
        'standalone.unified-process.development': {
          processes: [
            {
              id: 'application.public-ingress',
              crate: 'sdkwork-demo-standalone-gateway',
              binary: 'sdkwork-demo-standalone-gateway',
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
    ].join('\n'),
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
  assert.equal(topology.schemaVersion, 4);
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
  assert.ok(topology.orchestration.profiles['cloud.production']);
  assert.equal(fs.existsSync(path.join(repoRoot, 'etc/topology/standalone.unified-process.development.env')), false);
  assert.equal(fs.existsSync(path.join(repoRoot, 'etc/topology/cloud.split-services.production.env')), false);
  const standaloneEnv = fs.readFileSync(path.join(repoRoot, 'etc/topology/standalone.development.env'), 'utf8');
  assert.match(standaloneEnv, /SDKWORK_DEMO_PROFILE_ID=standalone\.development/);
  assert.doesNotMatch(standaloneEnv, /SERVICE_LAYOUT|unified-process|split-services/);
});
