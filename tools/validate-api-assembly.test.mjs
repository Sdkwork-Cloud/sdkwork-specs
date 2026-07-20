import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { materializeApiAssembly } from './materialize-api-assembly.mjs';
import { validateApiAssembly } from './validate-api-assembly.mjs';

function fixture() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-api-assembly-'));
  const root = path.join(workspace, 'sdkwork-demo');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'sdkwork.app.config.json'),
    JSON.stringify({ backend: { appId: 'sdkwork-demo' } }, null, 2),
  );
  fs.writeFileSync(
    path.join(root, 'Cargo.toml'),
    '[workspace]\nmembers = ["crates/sdkwork-routes-demo-app-api"]\nresolver = "2"\n\n[workspace.package]\nedition = "2021"\nversion = "0.1.0"\nlicense = "MIT"\n\n[workspace.dependencies]\naxum = "0.8"\n',
  );
  const routeRoot = path.join(root, 'crates', 'sdkwork-routes-demo-app-api');
  fs.mkdirSync(path.join(routeRoot, 'src'), { recursive: true });
  fs.mkdirSync(path.join(routeRoot, 'specs'), { recursive: true });
  fs.writeFileSync(path.join(routeRoot, 'Cargo.toml'), '[package]\nname = "sdkwork-routes-demo-app-api"\nversion = "0.1.0"\nedition = "2021"\n');
  fs.writeFileSync(path.join(routeRoot, 'src', 'lib.rs'), 'pub fn gateway_mount() -> axum::Router { axum::Router::new() }\n');
  fs.writeFileSync(
    path.join(routeRoot, 'specs', 'component.spec.json'),
    JSON.stringify({ contracts: { routeManifest: 'route-manifest.json' } }, null, 2),
  );
  fs.writeFileSync(path.join(routeRoot, 'route-manifest.json'), '{}\n');
  return root;
}

test('materializes a deterministic canonical API assembly manifest', () => {
  const root = fixture();
  assert.equal(materializeApiAssembly(root).ok, true);
  const manifestPath = path.join(root, 'crates', 'sdkwork-api-demo-assembly', 'assembly-manifest.json');
  const first = fs.readFileSync(manifestPath, 'utf8');
  assert.equal(materializeApiAssembly(root).ok, true);
  assert.equal(fs.readFileSync(manifestPath, 'utf8'), first);
  const manifest = JSON.parse(first);
  assert.equal(manifest.kind, 'sdkwork.api.assembly');
  assert.equal(manifest.packageName, 'sdkwork-api-demo-assembly');
  assert.equal(Object.hasOwn(manifest, 'generatedAt'), false);
  assert.equal(validateApiAssembly(root).ok, true);
});

test('rejects a retired gateway assembly manifest kind', () => {
  const root = fixture();
  const materialized = materializeApiAssembly(root);
  assert.equal(materialized.ok, true, materialized.message);
  const manifestPath = path.join(root, materialized.crateDir, 'assembly-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.kind = 'sdkwork.gateway.assembly';
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const result = validateApiAssembly(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /kind must be sdkwork\.api\.assembly/u);
});

test('accepts UTF-8 BOM in application and component JSON inputs', () => {
  const root = fixture();
  for (const filePath of [
    path.join(root, 'sdkwork.app.config.json'),
    path.join(root, 'crates', 'sdkwork-routes-demo-app-api', 'specs', 'component.spec.json'),
  ]) {
    const value = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, `\uFEFF${value}`, 'utf8');
  }

  assert.equal(materializeApiAssembly(root).ok, true);
  assert.equal(validateApiAssembly(root).ok, true);
});

test('does not require an application assembly from the platform cloud gateway repository', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-api-assembly-'));
  const root = path.join(workspace, 'sdkwork-api-cloud-gateway');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'sdkwork.app.config.json'),
    JSON.stringify({ backend: { appId: 'sdkwork-api-cloud-gateway' } }, null, 2),
  );

  const result = validateApiAssembly(root);

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.match(result.message, /consumes application assemblies/u);
});

test('rejects complete manifest drift, including application identity', () => {
  const root = fixture();
  const materialized = materializeApiAssembly(root);
  assert.equal(materialized.ok, true, materialized.message);
  const manifestPath = path.join(root, materialized.crateDir, 'assembly-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.applicationCode = 'other';
  manifest.routeCrates[0].mountOrder = 99;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = validateApiAssembly(root);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /applicationCode mismatch/u);
  assert.match(result.errors.join('\n'), /content drift/u);
});

test('API assembly schema reserves the platform cloud gateway identity', () => {
  const schema = JSON.parse(
    fs.readFileSync(
      path.resolve(import.meta.dirname, '..', 'schemas', 'sdkwork.api.assembly.schema.v1.json'),
      'utf8',
    ),
  );
  assert.equal(new RegExp(schema.properties.applicationCode.pattern, 'u').test('birdcoder'), true);
  assert.equal(new RegExp(schema.properties.applicationCode.pattern, 'u').test('api-cloud-gateway'), false);
  assert.equal(
    new RegExp(schema.properties.packageName.pattern, 'u').test('sdkwork-api-api-cloud-gateway-assembly'),
    false,
  );
});

test('rejects route crates without component ownership contracts', () => {
  const root = fixture();
  const materialized = materializeApiAssembly(root);
  assert.equal(materialized.ok, true, materialized.message);
  fs.rmSync(
    path.join(root, 'crates', 'sdkwork-routes-demo-app-api', 'specs', 'component.spec.json'),
  );

  const result = validateApiAssembly(root);

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /missing specs\/component\.spec\.json ownership contract/u);
});
