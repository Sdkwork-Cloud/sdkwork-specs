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
      'application.public-ingress': {
        httpUrlEnv: 'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL',
      },
      'platform.api-gateway': {
        httpUrlEnv: 'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL',
        autostartEnv: 'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART',
      },
    },
    components: {
      cloudGateway: {
        configGlob: 'etc/sdkwork-api-cloud-gateway.demo.{profile}.toml',
      },
    },
    orchestration: {
      profiles: {
        'standalone.development': { processes: [] },
        'cloud.development': {
          processes: [],
          healthSurfaces: ['application.public-ingress', 'platform.api-gateway'],
        },
        'cloud.production': { processes: [] },
      },
    },
  };
}

test('accepts standalone and cloud two-segment topology profiles', () => {
  const { workspace } = makeWorkspace('sdkwork-demo', standardTopology(), {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://demo.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
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
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://demo.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({
      scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' },
    }),
  });

  const result = runChecker(workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /schemaVersion must be 4 \(migration\) or 5/);
});

test('schema v5 requires the canonical platform cloud gateway', () => {
  const topology = standardTopology();
  topology.schemaVersion = 5;
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'standalone-gateway', role: 'standalone-gateway' },
  ];
  topology.cloudIngress = {
    strategy: 'platform-collapsed',
    platformGateway: 'sdkwork-api-cloud-gateway',
  };
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({ scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' } }),
  });

  const result = runChecker(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('schema v5 uses process roles instead of process-name heuristics', () => {
  const topology = standardTopology();
  topology.schemaVersion = 5;
  topology.cloudIngress = {
    strategy: 'platform-collapsed',
    platformGateway: 'sdkwork-api-cloud-gateway',
  };
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'standalone-gateway', role: 'standalone-gateway' },
  ];
  topology.orchestration.profiles['cloud.development'].processes = [
    { id: 'api-client', role: 'client' },
  ];
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://api.dev.sdkwork.com/app',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({ scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' } }),
  });

  const result = runChecker(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('schema v5 rejects different origins for platform-collapsed cloud surfaces', () => {
  const topology = standardTopology();
  topology.schemaVersion = 5;
  topology.cloudIngress = {
    strategy: 'platform-collapsed',
    platformGateway: 'sdkwork-api-cloud-gateway',
  };
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'standalone-gateway', role: 'standalone-gateway' },
  ];
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://demo.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({ scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' } }),
  });

  const result = runChecker(workspace);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use the same URL origin/u);
});

test('schema v5 edge-split requires an edge gateway but not an application gateway', () => {
  const topology = standardTopology();
  topology.schemaVersion = 5;
  topology.cloudIngress = {
    strategy: 'edge-split',
    platformGateway: 'sdkwork-api-cloud-gateway',
    edgeGateway: 'sdkwork-demo-edge-gateway',
    decisionRef: 'ADR-20260719-demo-edge-ingress',
  };
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'standalone-gateway', role: 'standalone-gateway' },
  ];
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://edge.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({ scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' } }),
  });

  const result = runChecker(workspace);
  assert.equal(result.status, 0, result.stderr);
});

test('schema v5 rejects an ungoverned dedicated cloud ingress', () => {
  const topology = standardTopology();
  topology.schemaVersion = 5;
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'standalone-gateway', role: 'standalone-gateway' },
  ];
  topology.cloudIngress = {
    strategy: 'dedicated-application',
    platformGateway: 'another-gateway',
  };
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://demo.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({ scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' } }),
  });

  const result = runChecker(workspace);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /platformGateway must be sdkwork-api-cloud-gateway/);
  assert.match(result.stderr, /requires applicationGateway and decisionRef/);
});

test('schema v5 rejects role-less processes and cloud backend roles', () => {
  const topology = standardTopology();
  topology.schemaVersion = 5;
  topology.cloudIngress = {
    strategy: 'platform-collapsed',
    platformGateway: 'sdkwork-api-cloud-gateway',
  };
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'standalone-gateway' },
  ];
  topology.orchestration.profiles['cloud.development'].processes = [
    { id: 'remote-api-helper', role: 'api-listener' },
  ];
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({ scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' } }),
  });

  const result = runChecker(workspace);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires a canonical role/);
  assert.match(result.stderr, /cloud\.development forbids local process role api-listener/);
  assert.match(result.stderr, /requires exactly one standalone-gateway role; found 0/);
});

test('rejects cloud development that autostarts local API and gateway processes', () => {
  const topology = standardTopology();
  topology.orchestration.profiles['cloud.development'].processes = [
    { id: 'application.public-ingress', required: true },
    { id: 'platform.api-gateway', required: true },
  ];
  const { workspace } = makeWorkspace('sdkwork-demo', topology, {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://demo.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=https://api.dev.sdkwork.com',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=true',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({
      scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' },
    }),
  });

  const result = runChecker(workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cloud\.development must not autostart local API\/dependency process application\.public-ingress/);
  assert.match(result.stderr, /PLATFORM_API_GATEWAY_AUTOSTART must disable remote surface autostart/);
});

test('rejects cloud development loopback URLs without an explicit tunnel', () => {
  const { workspace } = makeWorkspace('sdkwork-demo', standardTopology(), {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=http://127.0.0.1:8080',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL=http://127.0.0.1:3900',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({
      scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' },
    }),
  });

  const result = runChecker(workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not use loopback without an explicit tunnel\/proxy process/);
});

test('rejects missing and placeholder cloud development URLs', () => {
  const { workspace } = makeWorkspace('sdkwork-demo', standardTopology(), {
    'etc/topology/standalone.development.env': '',
    'etc/topology/cloud.development.env': [
      'SDKWORK_DEMO_APPLICATION_PUBLIC_HTTP_URL=https://demo.dev.sdkwork.example',
      'SDKWORK_DEMO_PLATFORM_API_GATEWAY_AUTOSTART=false',
      '',
    ].join('\n'),
    'etc/topology/cloud.production.env': '',
    'etc/sdkwork-api-cloud-gateway.demo.development.toml': '',
    'etc/sdkwork-api-cloud-gateway.demo.production.toml': '',
    'package.json': JSON.stringify({
      scripts: { 'gateway:package:cloud': 'node scripts/package.mjs' },
    }),
  });

  const result = runChecker(workspace);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APPLICATION_PUBLIC_HTTP_URL must be a concrete deployed URL, not a placeholder/);
  assert.match(result.stderr, /missing explicit SDKWORK_DEMO_PLATFORM_API_GATEWAY_HTTP_URL/);
});
