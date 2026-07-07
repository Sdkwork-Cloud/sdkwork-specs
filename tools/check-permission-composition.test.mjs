import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  classifyPermissionComposition,
} from './lib/permission-composition.mjs';

const CHECKER = path.resolve(import.meta.dirname, 'check-permission-composition.mjs');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createClientAppRoot(root, componentContracts) {
  const appRoot = path.join(root, 'apps/sdkwork-shop-h5');
  writeJson(path.join(appRoot, 'sdkwork.app.config.json'), {
    schemaVersion: 1,
    applicationCode: 'shop',
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-shop-h5-core/package.json'), {
    name: '@sdkwork/shop-h5-core',
    version: '0.0.0',
  });
  writeJson(path.join(appRoot, 'packages/sdkwork-shop-h5-core/specs/component.spec.json'), {
    component: {
      name: '@sdkwork/shop-h5-core',
      type: 'frontend-core',
    },
    contracts: componentContracts,
  });
  return appRoot;
}

function sdkDependency() {
  return {
    workspace: 'sdkwork-shop-app-sdk',
    surface: 'app-api',
    credentialMode: 'authenticated-app-api',
  };
}

function openApiWithPermission(permissionCode) {
  return {
    openapi: '3.1.2',
    info: { title: 'permission composition', version: '1.0.0' },
    paths: {
      '/app/v3/api/shop/orders': {
        get: {
          operationId: 'orders.list',
          'x-sdkwork-permission': permissionCode,
          responses: { 200: { description: 'ok' } },
        },
      },
    },
  };
}

test('classifyPermissionComposition requires permissionComposition when HTTP sdkDependencies exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-permission-missing-composition-'));
  createClientAppRoot(root, {
    sdkDependencies: [sdkDependency()],
  });

  const issues = classifyPermissionComposition(root);

  assert.ok(issues.some((issue) => issue.includes('missing contracts.permissionComposition')));
});

test('checker fails when sdkDependencies are not backed by inherited module catalog refs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-permission-missing-ref-'));
  createClientAppRoot(root, {
    sdkDependencies: [sdkDependency()],
    permissionComposition: {
      inheritanceMode: 'module-catalog-with-overrides',
      moduleCatalogRefs: [],
      consumerPolicy: {
        forbidLocalPermissionCatalogForDependencyDomains: true,
        allowExplicitOverridesOnly: true,
      },
    },
  });

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sdkwork-shop-app-sdk/u);
  assert.match(result.stderr, /moduleCatalogRefs/u);
});

test('checker fails when OpenAPI x-sdkwork-permission is absent from inherited catalogs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-permission-missing-code-'));
  const appRoot = createClientAppRoot(root, {
    sdkDependencies: [sdkDependency()],
    permissionComposition: {
      inheritanceMode: 'module-catalog-with-overrides',
      moduleCatalogRefs: [
        {
          moduleId: 'shop',
          manifestRef: '../../../../../sdkwork-shop/specs/iam.module.manifest.json',
          inheritPermissions: true,
          inheritRoles: true,
        },
      ],
      consumerPolicy: {
        forbidLocalPermissionCatalogForDependencyDomains: true,
        allowExplicitOverridesOnly: true,
      },
    },
  });
  writeJson(path.join(root, 'sdkwork-shop/specs/iam.module.manifest.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.iam.module',
    moduleId: 'shop',
    domain: 'shop',
    permissions: { catalog: [{ code: 'shop.orders.read' }] },
  });
  writeJson(
    path.join(appRoot, 'apis/app-api/shop/openapi.json'),
    openApiWithPermission('shop.orders.export'),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown-openapi-permission/u);
  assert.match(result.stderr, /shop\.orders\.export/u);
});

test('checker accepts sdk dependency permission inheritance when OpenAPI codes resolve', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-permission-valid-'));
  const appRoot = createClientAppRoot(root, {
    sdkDependencies: [sdkDependency()],
    permissionComposition: {
      inheritanceMode: 'module-catalog-with-overrides',
      moduleCatalogRefs: [
        {
          moduleId: 'shop',
          manifestRef: '../../../../../sdkwork-shop/specs/iam.module.manifest.json',
          inheritPermissions: true,
          inheritRoles: true,
        },
      ],
      consumerPolicy: {
        forbidLocalPermissionCatalogForDependencyDomains: true,
        allowExplicitOverridesOnly: true,
      },
    },
  });
  writeJson(path.join(root, 'sdkwork-shop/specs/iam.module.manifest.json'), {
    schemaVersion: 1,
    kind: 'sdkwork.iam.module',
    moduleId: 'shop',
    domain: 'shop',
    permissions: { catalog: [{ code: 'shop.orders.read' }] },
  });
  writeJson(
    path.join(appRoot, 'apis/app-api/shop/openapi.json'),
    openApiWithPermission('shop.orders.read'),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /permission composition check passed/u);
});
