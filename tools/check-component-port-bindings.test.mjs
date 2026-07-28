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

test('host-neutral API assemblies may declare the runtime-composition layer role', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-assembly-'));
  writeJson(path.join(root, 'crates/sdkwork-api-demo-assembly/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-demo-assembly',
      type: 'rust-api-assembly',
      root: 'crates/sdkwork-api-demo-assembly',
      domain: 'demo',
      capability: 'api-assembly',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-composition',
      publicExports: ['.'],
      runtimeEntrypoints: ['sdkwork_api_demo_assembly::assemble_api_router'],
      providedPorts: [],
      requiredPorts: [],
    },
  });

  assert.deepEqual(validateComponentPortBindings(root, { strict: true }), []);
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

test('same-origin dependency surfaces require an executable port and standalone coverage', () => {
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
          runtimeMode: 'same-origin',
          embeddedExecutableExport: 'build_sdkwork_iam_app_api_router',
          requiredBaseUrlKey: 'SDKWORK_DEMO_IAM_APP_API_BASE_URL',
        },
      ],
    },
  });

  const issues = validateComponentPortBindings(root);

  assert.ok(issues.some((issue) => issue.includes('runtimeEntrypoints')));
  assert.ok(issues.some((issue) => issue.includes('route metadata is not executable')));
  assert.ok(issues.some((issue) => issue.includes('matching requiredPorts entry')));
  assert.ok(issues.some((issue) => issue.includes('standalone profileCoverage')));
  assert.ok(issues.some((issue) => issue.includes('must not require an external base URL key')));
});

test('accepts a canonical Rust assembly contribution embedded in a standalone gateway', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-embedded-'));
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
      publicExports: ['crate-root'],
      runtimeEntrypoints: ['crate-root#build_router'],
      providedPorts: [],
      requiredPorts: [
        {
          name: 'iamAppApiContribution',
          export: 'sdkwork_api_iam_assembly::assemble_app_api_contribution',
        },
      ],
      dependencyApiSurfaces: [
        {
          workspace: 'sdkwork-iam',
          sdkFamily: 'sdkwork-iam-app-sdk',
          surface: 'app-api',
          apiPrefix: '/app/v3/api',
          runtimeMode: 'same-origin',
          sameOriginAllowed: true,
          cargoDependency: 'sdkwork-api-iam-assembly',
          embeddedExecutableExport: 'sdkwork_api_iam_assembly::assemble_app_api_contribution',
          profileCoverage: ['standalone'],
          coverageEvidence: ['src/profile.rs'],
        },
      ],
    },
  });

  assert.deepEqual(validateComponentPortBindings(root, { strict: true }), []);
});

test('required ports resolve provider exports without polluting consumer publicExports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-provider-'));
  writeText(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-demo-standalone-gateway"',
    '',
  ].join('\n'));
  writeJson(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-demo-standalone-gateway',
      type: 'rust-api-standalone-gateway',
      root: 'crates/sdkwork-api-demo-standalone-gateway',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-gateway',
      publicExports: ['crate-root'],
      providedPorts: [],
      requiredPorts: [{
        name: 'driveAppApiContribution',
        export: 'sdkwork_api_drive_assembly::assemble_app_api_contribution',
        provider: 'sdkwork-api-drive-assembly',
      }],
    },
  });
  writeText(path.join(root, 'crates/sdkwork-api-drive-assembly/Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-drive-assembly"',
    '',
  ].join('\n'));
  writeJson(path.join(root, 'crates/sdkwork-api-drive-assembly/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-drive-assembly',
      type: 'rust-api-assembly',
      root: 'crates/sdkwork-api-drive-assembly',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-composition',
      publicExports: ['.'],
      providedPorts: [{
        name: 'driveAppApiContribution',
        export: '.',
        target: 'sdkwork_api_drive_assembly::assemble_app_api_contribution',
      }],
      requiredPorts: [],
    },
  });

  assert.deepEqual(validateComponentPortBindings(root, { strict: true }), []);
});

test('rejects required ports that the resolved provider does not expose', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-provider-missing-'));
  writeJson(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-demo-standalone-gateway',
      type: 'rust-api-standalone-gateway',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-gateway',
      publicExports: ['crate-root'],
      providedPorts: [],
      requiredPorts: [{
        name: 'iamAppApiContribution',
        export: 'sdkwork_api_iam_assembly::assemble_app_api_contribution',
        provider: 'sdkwork-api-iam-assembly',
      }],
    },
  });
  writeJson(path.join(root, 'crates/sdkwork-api-iam-assembly/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-iam-assembly',
      type: 'rust-api-assembly',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-composition',
      publicExports: ['sdkwork_api_iam_assembly::assemble_owner_api_surfaces'],
      providedPorts: [{
        name: 'iamOwnerApiAssembly',
        export: 'sdkwork_api_iam_assembly::assemble_owner_api_surfaces',
      }],
      requiredPorts: [],
    },
  });

  const issues = validateComponentPortBindings(root, { strict: true });

  assert.ok(issues.some((issue) => issue.includes('does not expose it through publicExports/providedPorts')));
});

test('rejects dependency crate paths falsely declared as Rust component public exports', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-virtual-export-'));
  writeText(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-demo-standalone-gateway"',
    '',
  ].join('\n'));
  writeJson(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-demo-standalone-gateway',
      type: 'rust-api-standalone-gateway',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-gateway',
      publicExports: [
        'crate-root',
        'crate::build_router',
        'routing::build_router',
        'sdkwork_api_iam_assembly::assemble_app_api_contribution',
      ],
      providedPorts: [],
      requiredPorts: [{
        name: 'iamAppApiContribution',
        export: 'sdkwork_api_iam_assembly::assemble_app_api_contribution',
      }],
    },
  });

  const issues = validateComponentPortBindings(root, { strict: true });

  assert.equal(issues.filter((issue) => issue.includes('declares dependency export')).length, 1);
});

test('sameOriginAllowed capability does not select same-origin runtime mode', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-external-'));
  writeJson(path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-demo-standalone-gateway',
      type: 'rust-api-standalone-gateway',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-gateway',
      publicExports: ['crate-root'],
      providedPorts: [],
      requiredPorts: [],
      runtimeEntrypoints: [],
      dependencyApiSurfaces: [{
        workspace: 'sdkwork-iam',
        runtimeMode: 'external-service',
        sameOriginAllowed: true,
        requiredBaseUrlKey: 'SDKWORK_IAM_APP_API_BASE_URL',
      }],
    },
  });

  assert.deepEqual(validateComponentPortBindings(root, { strict: true }), []);
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

test('workspace mode resolves provider-qualified ports across sibling repositories', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-component-ports-siblings-'));
  const web = path.join(workspace, 'sdkwork-web');
  const iam = path.join(workspace, 'sdkwork-iam');
  const drive = path.join(workspace, 'sdkwork-drive');
  for (const repo of [web, iam, drive]) {
    writeText(path.join(repo, 'AGENTS.md'), '# Repository Guidelines\n');
  }

  writeText(path.join(web, 'crates/sdkwork-api-web-standalone-gateway/Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-web-standalone-gateway"',
    '',
  ].join('\n'));
  writeJson(path.join(web, 'crates/sdkwork-api-web-standalone-gateway/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-web-standalone-gateway',
      type: 'rust-api-standalone-gateway',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-gateway',
      publicExports: ['crate-root'],
      providedPorts: [],
      requiredPorts: [
        {
          name: 'iamAppApiContribution',
          export: 'sdkwork_api_iam_assembly::assemble_app_api_contribution',
          provider: 'sdkwork-api-iam-assembly',
        },
        {
          name: 'driveAppApiContribution',
          export: 'sdkwork_api_drive_assembly::assemble_app_api_contribution',
          provider: 'sdkwork-api-drive-assembly',
        },
      ],
    },
  });

  writeText(path.join(iam, 'crates/sdkwork-api-iam-assembly/Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-iam-assembly"',
    '',
  ].join('\n'));
  writeJson(path.join(iam, 'crates/sdkwork-api-iam-assembly/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-iam-assembly',
      type: 'rust-api-assembly',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-composition',
      publicExports: ['sdkwork_api_iam_assembly::assemble_app_api_contribution'],
      providedPorts: [{
        name: 'iamAppApiContribution',
        export: 'sdkwork_api_iam_assembly::assemble_app_api_contribution',
      }],
      requiredPorts: [],
    },
  });

  writeText(path.join(drive, 'crates/sdkwork-api-drive-assembly/Cargo.toml'), [
    '[package]',
    'name = "sdkwork-api-drive-assembly"',
    '',
  ].join('\n'));
  writeJson(path.join(drive, 'crates/sdkwork-api-drive-assembly/specs/component.spec.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.component.spec',
    component: {
      name: 'sdkwork-api-drive-assembly',
      type: 'rust-api-assembly',
      languages: ['rust'],
    },
    contracts: {
      layerRole: 'runtime-composition',
      publicExports: ['.'],
      providedPorts: [{
        name: 'driveAppApiContribution',
        export: '.',
        target: 'sdkwork_api_drive_assembly::assemble_app_api_contribution',
      }],
      requiredPorts: [],
    },
  });

  const result = spawnSync(process.execPath, [CHECKER, '--workspace', workspace, '--strict'], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /component port binding check passed/u);
});
