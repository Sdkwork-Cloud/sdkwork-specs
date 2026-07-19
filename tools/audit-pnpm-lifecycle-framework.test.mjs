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
