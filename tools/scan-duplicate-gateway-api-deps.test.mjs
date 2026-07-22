import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { scanDuplicateGatewayApiDepsRepo } from './scan-duplicate-gateway-api-deps.mjs';

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function createAssemblyGatewayRepo(mainSource) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-api-host-assembly-'));
  const root = path.join(workspace, 'sdkwork-demo');
  write(
    path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-api-demo-standalone-gateway"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-api-demo-assembly = { workspace = true }',
      '',
    ].join('\n'),
  );
  write(
    path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/src/main.rs'),
    mainSource,
  );
  return root;
}

test('rejects assembly-owned route dependencies from the standalone gateway host', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-api-host-deps-'));
  const root = path.join(workspace, 'sdkwork-demo');
  write(
    path.join(root, 'Cargo.toml'),
    [
      '[workspace]',
      'members = ["crates/sdkwork-routes-chat-app-api"]',
      '',
    ].join('\n'),
  );
  write(
    path.join(root, 'crates/sdkwork-routes-chat-app-api/Cargo.toml'),
    '[package]\nname = "sdkwork-routes-chat-app-api"\nversion = "0.0.0"\n',
  );
  write(
    path.join(root, 'crates/sdkwork-routes-chat-app-api/src/lib.rs'),
    'pub fn gateway_mount() -> axum::Router { axum::Router::new() }\n',
  );
  write(
    path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-api-demo-standalone-gateway"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-api-demo-assembly = { workspace = true }',
      'sdkwork-routes-chat-app-api = { workspace = true }',
      '',
    ].join('\n'),
  );
  write(
    path.join(root, 'crates/sdkwork-api-demo-standalone-gateway/src/main.rs'),
    'sdkwork_api_demo_assembly::assemble_api_router();\n',
  );

  const report = scanDuplicateGatewayApiDepsRepo(root);

  assert.equal(report.issues.length, 1);
  assert.match(report.issues[0], /api-assembly and application route crates/u);
});

test('accepts an environment assembly function imported by the gateway host', () => {
  const root = createAssemblyGatewayRepo([
    'use sdkwork_api_demo_assembly::assemble_api_router_from_env;',
    'async fn start() {',
    '  let _assembly = assemble_api_router_from_env().await.unwrap();',
    '}',
    '',
  ].join('\n'));

  const report = scanDuplicateGatewayApiDepsRepo(root);

  assert.deepEqual(report.warnings, []);
});

test('accepts an associated environment assembly constructor', () => {
  const root = createAssemblyGatewayRepo([
    'use sdkwork_api_demo_assembly::ApiAssembly;',
    'async fn start() {',
    '  let _assembly = ApiAssembly::from_environment(None::<()>).await.unwrap();',
    '}',
    '',
  ].join('\n'));

  const report = scanDuplicateGatewayApiDepsRepo(root);

  assert.deepEqual(report.warnings, []);
});

test('accepts a typed assembly constructor variant', () => {
  const root = createAssemblyGatewayRepo([
    'use sdkwork_api_demo_assembly::assemble_api_router_with_service;',
    'async fn start(service: DemoService) {',
    '  let _assembly = assemble_api_router_with_service(service).await;',
    '}',
    '',
  ].join('\n'));

  const report = scanDuplicateGatewayApiDepsRepo(root);

  assert.deepEqual(report.warnings, []);
});
