import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkSourceConfigStandard } from './check-source-config-standard.mjs';

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-source-config-'));
}

function write(root, relative, value) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

test('accepts a deployable root with etc authority', () => {
  const root = fixture();
  write(root, 'sdkwork.app.config.json', '{"schemaVersion":3,"kind":"sdkwork.app"}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', '{"schemaVersion":1,"kind":"sdkwork.deployment-index"}\n');
  assert.deepEqual(checkSourceConfigStandard(root), []);
});

test('rejects manifest environment debt and retired configs', () => {
  const root = fixture();
  write(root, 'sdkwork.app.config.json', '{"environments":{"development":{"accessUrl":"http://localhost"}}}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', '{}\n');
  write(root, 'configs/topology/dev.env', 'PORT=1\n');
  const issues = checkSourceConfigStandard(root);
  assert.ok(issues.some((issue) => issue.startsWith('configs/')));
  assert.ok(issues.some((issue) => issue.includes('#/environments')));
});

test('rejects committed secret values', () => {
  const root = fixture();
  write(root, 'sdkwork.app.config.json', '{}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', '{"database":{"password":"secret"}}\n');
  assert.ok(checkSourceConfigStandard(root).some((issue) => issue.includes('secret value')));
});

test('accepts an exact production app-api origin allowlist', () => {
  const root = fixture();
  write(root, 'sdkwork.app.config.json', '{}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', '{}\n');
  write(root, 'etc/sdkwork-api-cloud-gateway.production.toml', `
[service]
environment = "production"
[[dependencySurfaces]]
surface = "app"
[cors]
allowAnyOrigin = false
allowedOrigins = ["https://app.sdkwork.com"]
`);
  assert.deepEqual(checkSourceConfigStandard(root), []);
});

test('rejects empty or permissive production app-api CORS', () => {
  const root = fixture();
  write(root, 'sdkwork.app.config.json', '{}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', '{}\n');
  write(root, 'etc/sdkwork-api-cloud-gateway.production.toml', `
[service]
environment = "production"
[[dependencySurfaces]]
surface = "app"
[cors]
allowAnyOrigin = true
allowedOrigins = []
`);
  const issues = checkSourceConfigStandard(root);
  assert.ok(issues.some((issue) => issue.includes('allowAnyOrigin')));
  assert.ok(issues.some((issue) => issue.includes('requires at least one exact origin')));
});

test('rejects wildcard and path-bearing production origins', () => {
  const root = fixture();
  write(root, 'sdkwork.app.config.json', '{}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', '{}\n');
  write(root, 'etc/sdkwork-api-cloud-gateway.staging.toml', `
[service]
environment = "staging"
[[dependencySurfaces]]
surface = "app"
[cors]
allowAnyOrigin = false
allowedOrigins = ["https://*.sdkwork.com", "https://app.sdkwork.com/login"]
`);
  const issues = checkSourceConfigStandard(root);
  assert.equal(issues.filter((issue) => issue.includes('invalid exact HTTP(S) origin')).length, 2);
});

test('accepts an app surface that delegates deployment and topology to its enclosing application', () => {
  const repository = fixture();
  const root = path.join(repository, 'apps', 'sdkwork-demo-pc');
  write(root, 'sdkwork.app.config.json', '{}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(repository, 'etc/sdkwork.deployment.config.json', '{"kind":"sdkwork.deployment-index"}\n');
  write(repository, 'specs/topology.spec.json', '{"schemaVersion":5,"kind":"sdkwork.app.topology"}\n');
  write(root, 'etc/sdkwork.deployment.config.json', JSON.stringify({
    schemaVersion: 1,
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  }));
  assert.deepEqual(checkSourceConfigStandard(root), []);
});

test('rejects missing or competing component topology authorities', () => {
  const repository = fixture();
  const root = path.join(repository, 'apps', 'sdkwork-demo-pc');
  write(root, 'sdkwork.app.config.json', '{}\n');
  write(root, 'etc/README.md', '# Config\n');
  write(root, 'etc/sdkwork.deployment.config.json', JSON.stringify({
    schemaVersion: 1,
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/missing.json',
    parentTopologySpec: '../../../specs/missing.json',
  }));
  write(root, 'specs/topology.spec.json', '{"schemaVersion":5,"kind":"sdkwork.app.topology"}\n');
  const issues = checkSourceConfigStandard(root);
  assert.ok(issues.some((issue) => issue.includes('parentDeploymentConfig')));
  assert.ok(issues.some((issue) => issue.includes('parentTopologySpec')));
  assert.ok(issues.some((issue) => issue.includes('second topology')));
});
