import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  classifyRoutePathCollisions,
  normalizeRoutePath,
} from './lib/route-registry.mjs';
import {
  validateGatewayAssembly,
} from './validate-gateway-assembly.mjs';

const CHECKER = path.resolve(import.meta.dirname, 'check-route-path-collisions.mjs');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function openApi(paths) {
  return {
    openapi: '3.1.2',
    info: { title: 'route registry', version: '1.0.0' },
    paths,
  };
}

test('normalizeRoutePath collapses path template dialects before collision checks', () => {
  assert.equal(normalizeRoutePath('/app/v3/api/users/:userId'), '/app/v3/api/users/{param}');
  assert.equal(normalizeRoutePath('/app/v3/api/users/{id}/'), '/app/v3/api/users/{param}');
  assert.equal(normalizeRoutePath('/app//v3/api/users/<id>'), '/app/v3/api/users/{param}');
});

test('classifyRoutePathCollisions reports duplicate OpenAPI method/path entries on the same surface', () => {
  const routes = [
    {
      source: 'apis/app-api/users/openapi.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/users/{userId}',
    },
    {
      source: 'apis/app-api/profiles/openapi.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/users/:id',
    },
  ];

  const issues = classifyRoutePathCollisions(routes);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].kind, 'duplicate-route-path');
  assert.match(issues[0].detail, /GET \/app\/v3\/api\/users\/\{param\}/u);
});

test('classifyRoutePathCollisions reconciles source and SDK OpenAPI projections for the same operation', () => {
  const routes = [
    {
      sourceKind: 'openapi',
      projectionKind: 'api-authority',
      source: 'apis/app-api/users/openapi.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/users/{userId}',
      operationId: 'users.retrieve',
    },
    {
      sourceKind: 'openapi',
      projectionKind: 'sdk-authority',
      source: 'sdks/sdkwork-users-app-sdk/openapi/users-app-api.openapi.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/users/:id',
      operationId: 'users.retrieve',
    },
  ];

  const issues = classifyRoutePathCollisions(routes);

  assert.equal(issues.length, 0);
});

test('classifyRoutePathCollisions reconciles duplicate SDK OpenAPI projections for the same operation', () => {
  const routes = [
    {
      sourceKind: 'openapi',
      projectionKind: 'sdk-authority',
      source: 'apps/sdkwork-demo-pc/sdks/sdkwork-users-app-sdk/openapi/users-app-api.openapi.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/users/{userId}',
      operationId: 'users.retrieve',
    },
    {
      sourceKind: 'openapi',
      projectionKind: 'sdk-authority',
      source: 'sdks/sdkwork-users-app-sdk/openapi/users-app-api.openapi.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/users/:id',
      operationId: 'users.retrieve',
    },
  ];

  const issues = classifyRoutePathCollisions(routes);

  assert.equal(issues.length, 0);
});

test('classifyRoutePathCollisions reports non-health owners on reserved health and ready paths', () => {
  const routes = [
    {
      sourceKind: 'route-manifest',
      projectionKind: 'route-manifest',
      source: 'sdks/_route-manifests/app-api/sdkwork-router-xiangqi-app-api.route-manifest.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/system/health',
      operationId: 'xiangqi.health.check',
      routeCrate: 'sdkwork-router-xiangqi-app-api',
    },
    {
      sourceKind: 'route-manifest',
      projectionKind: 'route-manifest',
      source: 'sdks/_route-manifests/app-api/sdkwork-router-xiangqi-app-api.route-manifest.json',
      surface: 'app-api',
      method: 'GET',
      path: '/app/v3/api/system/ready',
      operationId: 'xiangqi.ready.check',
      routeCrate: 'sdkwork-router-xiangqi-app-api',
    },
  ];

  const issues = classifyRoutePathCollisions(routes);

  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.kind === 'reserved-route-path-owner'));
});

test('checker reconciles source and SDK OpenAPI authority projections for the same operation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-projection-reconcile-'));
  writeJson(
    path.join(root, 'apis/app-api/users/openapi.json'),
    openApi({
      '/app/v3/api/users/{userId}': {
        get: { operationId: 'users.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );
  writeJson(
    path.join(root, 'sdks/sdkwork-users-app-sdk/openapi/users-app-api.openapi.json'),
    openApi({
      '/app/v3/api/users/:id': {
        get: { operationId: 'users.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});

test('checker still reports distinct operations across OpenAPI authority projections', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-projection-collision-'));
  writeJson(
    path.join(root, 'apis/app-api/users/openapi.json'),
    openApi({
      '/app/v3/api/users/{userId}': {
        get: { operationId: 'users.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );
  writeJson(
    path.join(root, 'sdks/sdkwork-users-app-sdk/openapi/users-app-api.openapi.json'),
    openApi({
      '/app/v3/api/users/:id': {
        get: { operationId: 'profiles.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate-route-path/u);
});

test('checker reports normalized OpenAPI route collisions across authorities', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-collision-openapi-'));
  writeJson(
    path.join(root, 'apis/app-api/users/openapi.json'),
    openApi({
      '/app/v3/api/users/{userId}': {
        get: { operationId: 'users.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );
  writeJson(
    path.join(root, 'apis/app-api/profiles/openapi.json'),
    openApi({
      '/app/v3/api/users/:id': {
        get: { operationId: 'profiles.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate-route-path/u);
  assert.match(result.stderr, /users\/openapi\.json/u);
  assert.match(result.stderr, /profiles\/openapi\.json/u);
});

test('checker reports route manifest collisions with OpenAPI routes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-collision-manifest-'));
  writeJson(
    path.join(root, 'apis/app-api/users/openapi.json'),
    openApi({
      '/app/v3/api/users/{userId}': {
        get: { operationId: 'users.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );
  writeJson(
    path.join(root, 'sdks/_route-manifests/app-api/sdkwork-routes-users-app-api.route-manifest.json'),
    {
      schemaVersion: 1,
      kind: 'sdkwork.route.manifest',
      packageName: 'sdkwork-routes-users-app-api',
      surface: 'app-api',
      routes: [
        {
          method: 'GET',
          path: '/app/v3/api/users/:id',
          operationId: 'users.retrieveFromManifest',
        },
      ],
    },
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /duplicate-route-path/u);
  assert.match(result.stderr, /route-manifest/u);
});

test('validateGatewayAssembly includes route path collision validation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-gateway-route-collision-'));
  writeJson(path.join(root, 'sdkwork.app.config.json'), {
    backend: { appId: 'sdkwork-shop' },
  });
  writeText(
    path.join(root, 'Cargo.toml'),
    [
      '[workspace]',
      'members = [',
      '  "crates/sdkwork-routes-shop-app-api",',
      '  "crates/sdkwork-shop-gateway-assembly"',
      ']',
      '',
    ].join('\n'),
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-shop-app-api/Cargo.toml'),
    '[package]\nname = "sdkwork-routes-shop-app-api"\nversion = "0.0.0"\n',
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-shop-app-api/src/lib.rs'),
    [
      'pub const APP_API_PREFIX: &str = "/app/v3/api/shop";',
      'pub fn gateway_mount() {}',
      'pub fn gateway_route_manifest() {}',
      '',
    ].join('\n'),
  );
  writeJson(path.join(root, 'crates/sdkwork-shop-gateway-assembly/assembly-manifest.json'), {
    kind: 'sdkwork.gateway.assembly',
    schemaVersion: 1,
    applicationCode: 'shop',
    packageName: 'sdkwork-shop-gateway-assembly',
    routeCrates: [{ packageName: 'sdkwork-routes-shop-app-api' }],
  });
  writeJson(
    path.join(root, 'apis/app-api/users/openapi.json'),
    openApi({
      '/app/v3/api/shop/users/{userId}': {
        get: { operationId: 'users.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );
  writeJson(
    path.join(root, 'apis/app-api/profiles/openapi.json'),
    openApi({
      '/app/v3/api/shop/users/:id': {
        get: { operationId: 'profiles.retrieve', responses: { 200: { description: 'ok' } } },
      },
    }),
  );

  const result = validateGatewayAssembly(root);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('duplicate-route-path')));
});
