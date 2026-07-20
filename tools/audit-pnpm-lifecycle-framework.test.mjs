import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { auditPnpmLifecycleWorkspace } from './audit-pnpm-lifecycle-framework.mjs';

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test('classifies framework adoption and migration waves', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-lifecycle-audit-'));
  const app = path.join(workspace, 'sdkwork-demo');
  writeJson(path.join(app, 'sdkwork.app.config.json'), { app: { key: 'sdkwork-demo' } });
  writeJson(path.join(app, 'specs', 'topology.spec.json'), { schemaVersion: 5 });
  writeJson(path.join(app, 'sdkwork.workflow.json'), { schemaVersion: 1 });
  fs.mkdirSync(path.join(app, 'deployments'), { recursive: true });
  fs.writeFileSync(path.join(app, 'deployments', 'deploy.yaml'), 'version: 2\n');
  writeJson(path.join(app, 'package.json'), {
    scripts: {
      dev: 'pnpm dev:standalone',
      'dev:standalone': 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs dev --deployment-profile standalone',
      'dev:cloud': 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs dev --deployment-profile cloud',
      stop: 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs stop',
      build: 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs build',
      test: 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs test',
      check: 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs check',
      verify: 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs verify',
      clean: 'node ../sdkwork-app-topology/scripts/sdkwork-app.mjs clean',
    },
  });

  const report = auditPnpmLifecycleWorkspace(workspace);
  assert.equal(report.summary.applications, 1);
  assert.equal(report.summary.devProfilePairs, 1);
  assert.equal(report.summary.lifecycleFacadeAdopters, 1);
  assert.equal(report.summary.debtFree, 1);
  assert.equal(report.applications[0].wave, 1);
});

test('reports missing cloud development and facade debt', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-lifecycle-audit-'));
  const app = path.join(workspace, 'sdkwork-demo');
  writeJson(path.join(app, 'sdkwork.app.config.json'), { app: { key: 'sdkwork-demo' } });
  writeJson(path.join(app, 'package.json'), { scripts: { dev: 'vite' } });
  const report = auditPnpmLifecycleWorkspace(workspace);
  assert.ok(report.applications[0].debt.includes('missing-script:dev:cloud'));
  assert.ok(report.applications[0].debt.includes('not-using-lifecycle-facade'));
  assert.equal(report.applications[0].wave, 4);
});

test('records malformed application manifests as debt instead of aborting the workspace audit', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-lifecycle-audit-'));
  const app = path.join(workspace, 'sdkwork-broken');
  fs.mkdirSync(app, { recursive: true });
  fs.writeFileSync(path.join(app, 'sdkwork.app.config.json'), '{ broken\n');
  fs.writeFileSync(path.join(app, 'package.json'), '{ broken\n');

  const report = auditPnpmLifecycleWorkspace(workspace);
  assert.equal(report.summary.applications, 1);
  assert.ok(report.applications[0].debt.includes('invalid-app-manifest-json'));
  assert.ok(report.applications[0].debt.includes('invalid-package-manifest-json'));
});

test('recognizes an app surface that explicitly delegates topology to its enclosing application', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-lifecycle-audit-'));
  const repository = path.join(workspace, 'sdkwork-demo');
  const app = path.join(repository, 'apps', 'sdkwork-demo-pc');
  writeJson(path.join(repository, 'specs', 'topology.spec.json'), {
    schemaVersion: 5,
    kind: 'sdkwork.app.topology',
  });
  writeJson(path.join(repository, 'etc', 'sdkwork.deployment.config.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.deployment-config',
  });
  writeJson(path.join(app, 'sdkwork.app.config.json'), { app: { key: 'sdkwork-demo-pc' } });
  writeJson(path.join(app, 'etc', 'sdkwork.deployment.config.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  });
  const facade = 'pnpm exec sdkwork-app';
  writeJson(path.join(app, 'package.json'), {
    scripts: {
      dev: 'pnpm dev:standalone',
      'dev:standalone': `${facade} dev --root ../.. --deployment-profile standalone`,
      'dev:cloud': `${facade} dev --root ../.. --deployment-profile cloud`,
      stop: `${facade} stop --root ../..`,
      build: 'vite build',
      test: 'node --test',
      check: 'tsc --noEmit',
      verify: 'pnpm check && pnpm test',
      clean: 'node scripts/clean.mjs',
    },
  });

  const report = auditPnpmLifecycleWorkspace(workspace);
  assert.equal(report.summary.applications, 1);
  assert.equal(report.summary.topologyContracts, 1);
  assert.equal(report.summary.debtFree, 1);
  assert.equal(report.applications[0].topologyOwnership, 'delegated');
  assert.equal(report.applications[0].wave, 3);
});

test('does not require pnpm lifecycle scripts for a native Flutter application root', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-lifecycle-audit-'));
  const repository = path.join(workspace, 'sdkwork-demo');
  const app = path.join(repository, 'apps', 'sdkwork-demo-flutter-mobile');
  writeJson(path.join(repository, 'specs', 'topology.spec.json'), { schemaVersion: 5 });
  writeJson(path.join(repository, 'etc', 'sdkwork.deployment.config.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.deployment-index',
  });
  writeJson(path.join(app, 'sdkwork.app.config.json'), {
    app: { key: 'sdkwork-demo-flutter-mobile' },
    runtime: { family: 'mobile', framework: 'flutter' },
  });
  writeJson(path.join(app, 'etc', 'sdkwork.deployment.config.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  });

  const report = auditPnpmLifecycleWorkspace(workspace);

  assert.equal(report.applications[0].pnpmManaged, false);
  assert.equal(report.applications[0].debt.includes('missing-package-manifest'), false);
  assert.equal(report.applications[0].debt.some((issue) => issue.startsWith('missing-script:')), false);
  assert.equal(report.applications[0].debt.length, 0);
});
