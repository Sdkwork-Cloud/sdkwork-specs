import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const CHECKER = path.resolve('tools/check-topology-deployment-profiles.mjs');

function makeWorkspace(repoName, topology, files = {}) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-topology-profiles-'));
  const repoRoot = path.join(workspace, repoName);
  fs.mkdirSync(path.join(repoRoot, 'specs'), { recursive: true });
  fs.writeFileSync(
    path.join(repoRoot, 'specs', 'topology.spec.json'),
    `${JSON.stringify(topology, null, 2)}\n`,
  );
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(repoRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  return { workspace, repoRoot };
}

function runChecker(workspace, repo = 'sdkwork-demo') {
  return spawnSync(
    process.execPath,
    [CHECKER, '--workspace', workspace, '--repo', repo],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  );
}

function standardTopology() {
  return {
    schemaVersion: 4,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    vocabulary: {
      deploymentProfile: { allowed: ['standalone', 'cloud'] },
      environment: { allowed: ['development', 'production'] },
    },
    profileFiles: {
      'standalone.development': 'etc/topology/standalone.development.env',
      'cloud.development': 'etc/topology/cloud.development.env',
      'cloud.production': 'etc/topology/cloud.production.env',
    },
    surfaces: {
      'platform.api-gateway': {},
    },
    components: {
      cloudGateway: {
        configGlob: 'etc/sdkwork-api-cloud-gateway.demo.{profile}.toml',
      },
    },
    orchestration: {
      profiles: {
        'standalone.development': { processes: [] },
        'cloud.production': { processes: [] },
      },
    },
  };
}

test('accepts standalone and cloud two-segment topology profiles', () => {
  const { workspace } = makeWorkspace('sdkwork-demo', standardTopology(), {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': '',
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({
      scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' },
    }),
  });

  const result = runChecker(workspace);

  assert.equal(result.status, 0, result.stderr);
});

test('rejects retired serviceLayout vocabulary and three-segment profile ids', () => {
  const legacy = standardTopology();
  legacy.vocabulary.serviceLayout = { allowed: ['unified-process', 'split-services'] };
  legacy.profileFiles = {
    'standalone.unified-process.development': 'etc/topology/standalone.unified-process.development.env',
    'cloud.split-services.production': 'etc/topology/cloud.split-services.production.env',
  };
  legacy.orchestration.profiles = {
    'standalone.unified-process.development': { processes: [] },
    'cloud.split-services.production': { processes: [] },
  };
  const { workspace } = makeWorkspace('sdkwork-demo', legacy, {
    'etc/topology/standalone.unified-process.development.env': '',
    'etc/topology/cloud.split-services.production.env': '',
  });

  const result = runChecker(workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /retired vocabulary\.serviceLayout/);
  assert.match(result.stderr, /retired profile id standalone\.unified-process\.development/);
});

test('rejects pre-v4 topology specs', () => {
  const legacy = standardTopology();
  legacy.schemaVersion = 2;
  const { workspace } = makeWorkspace('sdkwork-demo', legacy, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': '',
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({
      scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' },
    }),
  });

  const result = runChecker(workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /schemaVersion must be 4/);
});
