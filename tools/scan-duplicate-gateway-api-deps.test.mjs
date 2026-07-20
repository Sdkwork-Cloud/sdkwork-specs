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
