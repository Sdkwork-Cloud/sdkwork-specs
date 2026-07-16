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
  const root = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-gateway-assembly-')),
    'sdkwork-agents',
  );
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
  assert.match(cargoToml, /^edition = "2021"$/mu);
  assert.match(cargoToml, /^version = "0\.1\.0"$/mu);
  assert.match(cargoToml, /^sdkwork-routes-agents-app-api\.workspace = true$/mu);
  assert.match(cargoToml, /^sdkwork-routes-agents-http-shared\.workspace = true$/mu);
  assert.doesNotMatch(cargoToml, /sdkwork_routes_agents_app_api\s*=/u);
  assert.doesNotMatch(cargoToml, /sdkwork_routes_agents_http_shared\s*=/u);
  assert.doesNotMatch(cargoToml, /package = "sdkwork-routes-agents-app-api"/u);
  assert.doesNotMatch(cargoToml, /package = "sdkwork-routes-agents-http-shared"/u);
  assert.equal(
    fs.existsSync(
      path.join(root, 'crates/sdkwork-agents-gateway-assembly/specs/component.spec.json'),
    ),
    true,
  );
});

test('gateway assembly discovers aggregate subdomain routes when app-code routes are absent', () => {
  const root = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-gateway-assembly-')),
    'sdkwork-deployments',
  );
  writeText(
    path.join(root, 'sdkwork.app.config.json'),
    `${JSON.stringify({ backend: { appId: 'sdkwork-deployments' } }, null, 2)}\n`,
  );
  writeText(
    path.join(root, 'Cargo.toml'),
    [
      '[workspace]',
      'members = [',
      '  "crates/sdkwork-routes-deploy-app-api",',
      '  "crates/sdkwork-routes-deploy-backend-api",',
      '  "crates/sdkwork-routes-health-app-api"',
      ']',
      '',
      '[workspace.package]',
      'edition = "2021"',
      'version = "0.1.0"',
      '',
      '[workspace.dependencies]',
      'axum = "0.8"',
      'tokio = { version = "1", features = ["macros", "rt-multi-thread"] }',
      'sdkwork-routes-deploy-app-api = { path = "crates/sdkwork-routes-deploy-app-api" }',
      'sdkwork-routes-deploy-backend-api = { path = "crates/sdkwork-routes-deploy-backend-api" }',
      '',
    ].join('\n'),
  );
  for (const packageName of [
    'sdkwork-routes-deploy-app-api',
    'sdkwork-routes-deploy-backend-api',
    'sdkwork-routes-health-app-api',
  ]) {
    const crateRoot = path.join(root, 'crates', packageName);
    writeText(
      path.join(crateRoot, 'Cargo.toml'),
      `[package]\nname = "${packageName}"\nversion = "0.0.0"\n`,
    );
    writeText(
      path.join(crateRoot, 'src/lib.rs'),
      'pub fn gateway_mount() -> axum::Router { axum::Router::new() }\n',
    );
  }

  const result = materializeGatewayAssembly(root);

  assert.equal(result.ok, true);
  assert.equal(result.routeCrates, 2);
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, 'crates/sdkwork-deployments-gateway-assembly/assembly-manifest.json'),
      'utf8',
    ),
  );
  assert.deepEqual(
    manifest.routeCrates.map((entry) => entry.packageName),
    ['sdkwork-routes-deploy-app-api', 'sdkwork-routes-deploy-backend-api'],
  );

  const secondResult = materializeGatewayAssembly(root);
  assert.equal(secondResult.ok, true);
  const cargoToml = fs.readFileSync(
    path.join(root, 'crates/sdkwork-deployments-gateway-assembly/Cargo.toml'),
    'utf8',
  );
  assert.equal(
    (cargoToml.match(/^sdkwork-routes-deploy-app-api(?:\.workspace)?\s*=/gmu) ?? []).length,
    1,
  );
  assert.equal(
    (cargoToml.match(/^sdkwork-routes-deploy-backend-api(?:\.workspace)?\s*=/gmu) ?? []).length,
    1,
  );
});

test('gateway assembly dependency rendering deduplicates preserved Cargo keys', () => {
  const root = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-gateway-assembly-')),
    'sdkwork-agents',
  );
  writeText(
    path.join(root, 'sdkwork.app.config.json'),
    `${JSON.stringify({ backend: { appId: 'sdkwork-agents' } }, null, 2)}\n`,
  );
  writeText(
    path.join(root, 'Cargo.toml'),
    [
      '[workspace]',
      'members = ["crates/sdkwork-routes-agents-app-api"]',
      '',
      '[workspace.package]',
      'edition = "2021"',
      'version = "0.1.0"',
      '',
      '[workspace.dependencies]',
      'axum = "0.8"',
      'tokio = "1"',
      '',
    ].join('\n'),
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-agents-app-api/Cargo.toml'),
    '[package]\nname = "sdkwork-routes-agents-app-api"\nversion = "0.0.0"\n',
  );
  writeText(
    path.join(root, 'crates/sdkwork-routes-agents-app-api/src/lib.rs'),
    'pub fn gateway_mount() -> axum::Router { axum::Router::new() }\n',
  );
  writeText(
    path.join(root, 'crates/sdkwork-agents-gateway-assembly/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-agents-gateway-assembly"',
      'version = "0.1.0"',
      'edition = "2021"',
      '',
      '[dependencies]',
      'axum = "0.8"',
      'tokio = "1"',
      'serde = "1"',
      '',
    ].join('\n'),
  );

  const result = materializeGatewayAssembly(root);
  assert.equal(result.ok, true);
  const cargoToml = fs.readFileSync(
    path.join(root, 'crates/sdkwork-agents-gateway-assembly/Cargo.toml'),
    'utf8',
  );
  assert.equal((cargoToml.match(/^axum(?:\.workspace)?\s*=/gmu) ?? []).length, 1);
  assert.equal((cargoToml.match(/^tokio(?:\.workspace)?\s*=/gmu) ?? []).length, 1);
  assert.equal((cargoToml.match(/^serde(?:\.workspace)?\s*=/gmu) ?? []).length, 1);
});
