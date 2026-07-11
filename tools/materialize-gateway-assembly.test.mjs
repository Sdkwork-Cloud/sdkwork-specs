import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { materializeGatewayAssembly } from './materialize-gateway-assembly.mjs';

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('gateway assembly Cargo dependencies use workspace declarations when root owns route crates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-gateway-assembly-'));
  writeText(
    path.join(root, 'sdkwork.app.config.json'),
    `${JSON.stringify({ backend: { appId: 'sdkwork-agents' } }, null, 2)}\n`,
  );
  writeText(
    path.join(root, 'Cargo.toml'),
    [
      '[workspace]',
      'members = [',
      '  "crates/sdkwork-routes-agents-app-api",',
      '  "crates/sdkwork-routes-agents-http-shared"',
      ']',
      '',
      '[workspace.dependencies]',
      'axum = "0.8"',
      'tokio = { version = "1", features = ["macros", "rt-multi-thread"] }',
      'sdkwork-routes-agents-app-api = { path = "crates/sdkwork-routes-agents-app-api" }',
      'sdkwork-routes-agents-http-shared = { path = "crates/sdkwork-routes-agents-http-shared" }',
      '',
    ].join('\n'),
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-agents-app-api/Cargo.toml'),
    '[package]\nname = "sdkwork-routes-agents-app-api"\nversion = "0.0.0"\n',
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-agents-app-api/src/lib.rs'),
    [
      'pub const APP_API_PREFIX: &str = "/app/v3/api/agents";',
      'pub fn gateway_mount() -> axum::Router { axum::Router::new() }',
      '',
    ].join('\n'),
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-agents-http-shared/Cargo.toml'),
    '[package]\nname = "sdkwork-routes-agents-http-shared"\nversion = "0.0.0"\n',
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-agents-http-shared/src/lib.rs'),
    'pub const ROUTE_MANIFEST_KIND: &str = "sdkwork.route.manifest";\n',
  );

  const result = materializeGatewayAssembly(root);

  assert.equal(result.ok, true);
  const cargoToml = fs.readFileSync(
    path.join(root, 'crates/sdkwork-agents-gateway-assembly/Cargo.toml'),
    'utf8',
  );
  assert.match(cargoToml, /^tokio\.workspace = true$/mu);
  assert.match(cargoToml, /^sdkwork-routes-agents-app-api\.workspace = true$/mu);
  assert.match(cargoToml, /^sdkwork-routes-agents-http-shared\.workspace = true$/mu);
  assert.doesNotMatch(cargoToml, /sdkwork_routes_agents_app_api\s*=/u);
  assert.doesNotMatch(cargoToml, /sdkwork_routes_agents_http_shared\s*=/u);
  assert.doesNotMatch(cargoToml, /package = "sdkwork-routes-agents-app-api"/u);
  assert.doesNotMatch(cargoToml, /package = "sdkwork-routes-agents-http-shared"/u);
});
