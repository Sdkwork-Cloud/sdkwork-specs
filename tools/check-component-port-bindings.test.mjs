import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  validateComponentPortBindings,
} from './lib/component-port-bindings.mjs';

const CHECKER = path.resolve(import.meta.dirname, 'check-component-port-bindings.mjs');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('legacy component specs without port binding fields remain compatible by default', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-legacy-'));
  writeJson(path.join(root, 'packages/sdkwork-demo/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: '@sdkwork/demo',
      type: 'react-package',
      root: 'packages/sdkwork-demo',
      domain: 'demo',
      capability: 'chat',
      languages: ['typescript'],
    },
    contracts: {
      publicExports: ['.'],
      runtimeEntrypoints: [],
    },
  });

  assert.deepEqual(validateComponentPortBindings(root), []);
});

test('strict mode requires authored components to declare a composable layerRole', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-layer-'));
  writeJson(path.join(root, 'packages/sdkwork-demo/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: '@sdkwork/demo',
      type: 'react-package',
      root: 'packages/sdkwork-demo',
      domain: 'demo',
      capability: 'chat',
      languages: ['typescript'],
    },
    contracts: {
      publicExports: ['.'],
      providedPorts: [],
      requiredPorts: [],
    },
  });

  const issues = validateComponentPortBindings(root, { strict: true });

  assert.ok(issues.some((issue) => issue.includes('contracts.layerRole is required')));
});

test('frontend port declarations must be arrays of named public-export-backed ports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-frontend-'));
  writeJson(path.join(root, 'packages/sdkwork-demo/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: '@sdkwork/demo',
      type: 'react-package',
      root: 'packages/sdkwork-demo',
      domain: 'demo',
      capability: 'chat',
      languages: ['typescript'],
    },
    contracts: {
      layerRole: 'frontend-feature',
      publicExports: ['.'],
      providedPorts: [{ name: 'chatServices' }],
      requiredPorts: [{ export: './sdk' }],
    },
  });

  const issues = validateComponentPortBindings(root);

  assert.ok(issues.some((issue) => issue.includes('providedPorts[0].export')));
  assert.ok(issues.some((issue) => issue.includes('requiredPorts[0].name')));
});

test('same-origin dependency surfaces require executable runtime entrypoints', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-runtime-'));
  writeJson(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-demo-standalone-gateway',
      type: 'rust-standalone-gateway',
      root: 'crates/sdkwork-api-demo-standalone-gateway',
      domain: 'demo',
      capability: 'gateway',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-gateway',
      publicExports: ['.'],
      runtimeEntrypoints: ['sdks/_route-manifests/app-api/sdkwork-routes-demo-app-api.route-manifest.json'],
      dependencyApiSurfaces: [
        {
          workspace: 'sdkwork-iam-app-sdk',
          surface: 'app-api',
          apiPrefix: '/app/v3/api/iam',
          runtimeMode: 'same-origin-mounted',
          embeddedExecutableExport: 'build_sdkwork_iam_app_api_router',
        },
      ],
    },
  });

  const issues = validateComponentPortBindings(root);

  assert.ok(issues.some((issue) => issue.includes('runtimeEntrypoints')));
  assert.ok(issues.some((issue) => issue.includes('route metadata is not executable')));
});

test('CLI reports strict component port binding violations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-cli-'));
  writeJson(path.join(root, 'packages/sdkwork-demo/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: '@sdkwork/demo',
      type: 'react-package',
      root: 'packages/sdkwork-demo',
      domain: 'demo',
      capability: 'chat',
      languages: ['typescript'],
    },
    contracts: {
      publicExports: ['.'],
      providedPorts: [],
      requiredPorts: [],
    },
  });

  const result = spawnSync(process.execPath, [CHECKER, '--root', root, '--strict'], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /contracts\.layerRole is required/u);
});

test('CLI scans child repositories with --workspace', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-workspace-'));
  const repo = path.join(workspace, 'sdkwork-demo');
  writeText(path.join(repo, 'AGENTS.md'), '# Repository Guidelines\n');
  writeJson(path.join(repo, 'packages/sdkwork-demo/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: '@sdkwork/demo',
      type: 'react-package',
      root: 'packages/sdkwork-demo',
      domain: 'demo',
      capability: 'chat',
      languages: ['typescript'],
    },
    contracts: {
      publicExports: ['.'],
      providedPorts: [],
      requiredPorts: [],
    },
  });

  const result = spawnSync(process.execPath, [CHECKER, '--workspace', workspace, '--strict'], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sdkwork-demo/u);
  assert.match(result.stderr, /contracts\.layerRole is required/u);
});
