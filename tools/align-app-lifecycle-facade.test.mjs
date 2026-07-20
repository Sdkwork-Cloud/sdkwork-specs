import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  planDelegatedLifecycleAlignment,
  planLifecycleAlignment,
} from './align-app-lifecycle-facade.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-lifecycle-align-'));
  fs.mkdirSync(path.join(root, 'specs'));
  const manifest = {
    dependencies: { '@sdkwork/app-topology': 'workspace:*' },
    scripts: {
      dev: 'node scripts/dev.mjs',
      stop: 'node scripts/stop.mjs',
      build: 'cargo build --workspace',
      test: 'node --test',
      check: 'cargo check --workspace',
      verify: 'pnpm check && pnpm test',
      clean: 'node scripts/clean.mjs',
      'api:assembly:materialize': 'node scripts/gateway/assembly-materialize.mjs',
      'api:assembly:validate': 'node scripts/gateway/assembly-validate.mjs',
    },
  };
  const topology = {
    schemaVersion: 5,
    orchestration: { profiles: { 'standalone.development': { processes: [] } } },
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
  fs.writeFileSync(path.join(root, 'specs', 'topology.spec.json'), JSON.stringify(topology));
  return { root, manifest, topology };
}

test('preserves implementation commands and delegates public lifecycle to sdkwork-app', () => {
  const { root } = fixture();
  const plan = planLifecycleAlignment(root);
  assert.equal(plan.eligible, true);
  assert.equal(plan.manifest.scripts.dev, 'pnpm dev:standalone');
  assert.equal(
    plan.manifest.scripts['dev:cloud'],
    'pnpm exec sdkwork-app dev --deployment-profile cloud',
  );
  assert.equal(plan.manifest.scripts.build, 'pnpm exec sdkwork-app build');
  assert.equal(plan.manifest.scripts['_sdkwork:build'], 'cargo build --workspace');
  assert.equal(plan.manifest.scripts.stop, 'pnpm exec sdkwork-app stop');
  assert.equal(
    plan.manifest.scripts['api:assembly:materialize'],
    'node ../sdkwork-specs/tools/materialize-api-assembly.mjs --root .',
  );
  assert.equal(
    plan.manifest.scripts['api:assembly:validate'],
    'node ../sdkwork-specs/tools/validate-api-assembly.mjs --root .',
  );
});

test('retires process-layout dev aliases behind runtime-target facade commands', () => {
  const { root, manifest } = fixture();
  manifest.scripts['dev:browser'] = 'pnpm dev:browser:postgres:unified-process:standalone';
  manifest.scripts['dev:browser:postgres:unified-process:standalone'] =
    'node scripts/dev.mjs --service-layout unified-process --database postgres';
  manifest.scripts['dev:browser:postgres:split-services:cloud'] =
    'node scripts/dev.mjs --service-layout split-services --database postgres';
  manifest.scripts['dev:browser:sqlite:unified-process:standalone'] =
    'node scripts/dev.mjs --service-layout unified-process --database sqlite --dev-env-file configs/topology/standalone.unified-process.development.env';
  manifest.scripts['dev:browser:split-services'] =
    'node scripts/dev.mjs --service-layout split-services --database postgres';
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));

  const plan = planLifecycleAlignment(root);
  assert.equal(plan.eligible, true);
  assert.equal(
    plan.manifest.scripts['dev:browser'],
    'pnpm dev:browser:postgres:standalone',
  );
  assert.equal(
    plan.manifest.scripts['dev:browser:postgres:standalone'],
    'pnpm exec sdkwork-app dev --runtime-target browser --deployment-profile standalone',
  );
  assert.equal(
    plan.manifest.scripts['dev:browser:cloud'],
    'pnpm exec sdkwork-app dev --runtime-target browser --deployment-profile cloud',
  );
  assert.equal(
    plan.manifest.scripts['dev:browser:sqlite:standalone'],
    'node scripts/dev.mjs --database sqlite --dev-env-file configs/topology/standalone.development.env',
  );
  assert.equal(plan.manifest.scripts['dev:browser:split-services'], undefined);
  assert.equal(plan.manifest.scripts['dev:browser:postgres:unified-process:standalone'], undefined);
});

test('refuses migration when topology would recurse through a replaced root script', () => {
  const { root, topology } = fixture();
  topology.orchestration.profiles['standalone.development'].processes = [
    { id: 'legacy-runner', role: 'api-standalone-gateway', script: 'dev' },
  ];
  fs.writeFileSync(
    path.join(root, 'specs', 'topology.spec.json'),
    JSON.stringify(topology),
  );
  const plan = planLifecycleAlignment(root);
  assert.equal(plan.eligible, false);
  assert.match(plan.reasons.join('; '), /topology references public lifecycle scripts: dev/u);
});

test('refuses migration without the declared facade dependency', () => {
  const { root, manifest } = fixture();
  delete manifest.dependencies['@sdkwork/app-topology'];
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(manifest));
  const plan = planLifecycleAlignment(root);
  assert.equal(plan.eligible, false);
  assert.match(plan.reasons.join('; '), /missing @sdkwork\/app-topology dependency/u);
});

test('delegates only development and stop for a component deployment', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-delegated-lifecycle-align-'));
  const parent = path.join(workspace, 'sdkwork-demo');
  const app = path.join(parent, 'apps', 'sdkwork-demo-h5');
  fs.mkdirSync(path.join(parent, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(parent, 'etc'), { recursive: true });
  fs.mkdirSync(path.join(app, 'etc'), { recursive: true });
  fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify({
    dependencies: { '@sdkwork/app-topology': 'workspace:*' },
  }));
  fs.writeFileSync(path.join(parent, 'specs', 'topology.spec.json'), JSON.stringify({ schemaVersion: 5 }));
  fs.writeFileSync(path.join(parent, 'etc', 'sdkwork.deployment.config.json'), '{}');
  fs.writeFileSync(path.join(app, 'etc', 'sdkwork.deployment.config.json'), JSON.stringify({
    schemaVersion: 1,
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  }));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ scripts: {
    dev: 'vite',
    'dev:browser': 'vite',
    build: 'vite build',
  } }));

  const plan = planDelegatedLifecycleAlignment(app);
  assert.equal(plan.eligible, true);
  assert.equal(plan.manifest.scripts.dev, 'pnpm dev:standalone');
  assert.equal(
    plan.manifest.scripts['dev:standalone'],
    'pnpm exec sdkwork-app dev --root ../.. --deployment-profile standalone',
  );
  assert.equal(plan.manifest.scripts.stop, 'pnpm exec sdkwork-app stop --root ../..');
  assert.equal(
    plan.manifest.scripts['dev:browser:postgres:standalone'],
    'pnpm exec sdkwork-app dev --root ../.. --runtime-target browser --deployment-profile standalone',
  );
  assert.equal(plan.manifest.scripts['dev:browser'], 'pnpm dev:browser:postgres:standalone');
  assert.equal(plan.manifest.scripts.build, 'vite build');
  assert.equal(plan.manifest.scripts.test, undefined);
  assert.equal(
    plan.manifest.scripts.clean,
    'node -e "require(\'node:fs\').rmSync(\'dist\',{recursive:true,force:true})"',
  );
  assert.equal(plan.manifest.scripts['_sdkwork:build'], undefined);
});

test('infers complete local lifecycle scripts for delegated application surfaces', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-delegated-local-lifecycle-'));
  const parent = path.join(workspace, 'sdkwork-demo');
  const app = path.join(parent, 'apps', 'sdkwork-demo-pc');
  fs.mkdirSync(path.join(parent, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(parent, 'etc'), { recursive: true });
  fs.mkdirSync(path.join(app, 'etc'), { recursive: true });
  fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify({
    dependencies: { '@sdkwork/app-topology': 'workspace:*' },
  }));
  fs.writeFileSync(path.join(parent, 'specs', 'topology.spec.json'), JSON.stringify({ schemaVersion: 5 }));
  fs.writeFileSync(path.join(parent, 'etc', 'sdkwork.deployment.config.json'), '{}');
  fs.writeFileSync(path.join(app, 'etc', 'sdkwork.deployment.config.json'), JSON.stringify({
    schemaVersion: 1,
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  }));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ scripts: {
    build: 'tsc && vite build',
    typecheck: 'tsc --noEmit',
    'test:contract': 'node --test contract.test.mjs',
    'test:unit': 'vitest run',
    'test:e2e': 'playwright test',
  } }));

  const plan = planDelegatedLifecycleAlignment(app);

  assert.equal(plan.eligible, true);
  assert.equal(plan.manifest.scripts.test, 'pnpm run test:contract && pnpm run test:unit');
  assert.equal(plan.manifest.scripts.check, 'pnpm typecheck && pnpm test && pnpm build');
  assert.equal(plan.manifest.scripts.verify, 'pnpm check');
  assert.equal(
    plan.manifest.scripts.clean,
    'node -e "require(\'node:fs\').rmSync(\'dist\',{recursive:true,force:true})"',
  );
});

test('prefers an existing aggregate test command over duplicating its leaves', () => {
  const scripts = {
    'test:app': 'node --test app.test.mjs',
    'test:iam': 'node --test iam.test.mjs',
    'test:contracts': 'pnpm run test:app && pnpm run test:iam',
  };
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-delegated-test-aggregate-'));
  const parent = path.join(workspace, 'sdkwork-demo');
  const app = path.join(parent, 'apps', 'sdkwork-demo-h5');
  fs.mkdirSync(path.join(parent, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(parent, 'etc'), { recursive: true });
  fs.mkdirSync(path.join(app, 'etc'), { recursive: true });
  fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify({
    dependencies: { '@sdkwork/app-topology': 'workspace:*' },
  }));
  fs.writeFileSync(path.join(parent, 'specs', 'topology.spec.json'), '{"schemaVersion":5}');
  fs.writeFileSync(path.join(parent, 'etc', 'sdkwork.deployment.config.json'), '{}');
  fs.writeFileSync(path.join(app, 'etc', 'sdkwork.deployment.config.json'), JSON.stringify({
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  }));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ scripts }));

  const plan = planDelegatedLifecycleAlignment(app);

  assert.equal(plan.manifest.scripts.test, 'pnpm run test:contracts');
});

test('verify adds local tests when an existing check does not run them', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-delegated-verify-'));
  const parent = path.join(workspace, 'sdkwork-demo');
  const app = path.join(parent, 'apps', 'sdkwork-demo-pc');
  fs.mkdirSync(path.join(parent, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(parent, 'etc'), { recursive: true });
  fs.mkdirSync(path.join(app, 'etc'), { recursive: true });
  fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify({
    dependencies: { '@sdkwork/app-topology': 'workspace:*' },
  }));
  fs.writeFileSync(path.join(parent, 'specs', 'topology.spec.json'), '{"schemaVersion":5}');
  fs.writeFileSync(path.join(parent, 'etc', 'sdkwork.deployment.config.json'), '{}');
  fs.writeFileSync(path.join(app, 'etc', 'sdkwork.deployment.config.json'), JSON.stringify({
    kind: 'sdkwork.component-deployment',
    parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
    parentTopologySpec: '../../../specs/topology.spec.json',
  }));
  fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ scripts: {
    check: 'pnpm typecheck && pnpm build',
    'test:contract': 'node --test contract.test.mjs',
  } }));

  const plan = planDelegatedLifecycleAlignment(app);

  assert.equal(plan.manifest.scripts.verify, 'pnpm check && pnpm test');
});

test('refuses component delegation without both parent authorities', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-invalid-delegated-lifecycle-'));
  fs.mkdirSync(path.join(root, 'etc'), { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'etc', 'sdkwork.deployment.config.json'), JSON.stringify({
    kind: 'sdkwork.component-deployment',
    parentTopologySpec: '../../../specs/topology.spec.json',
  }));
  const plan = planDelegatedLifecycleAlignment(root);
  assert.equal(plan.eligible, false);
  assert.match(plan.reasons.join('; '), /parentTopologySpec|parentDeploymentConfig/u);
});
