import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { materializeRouteComponentSpecs } from './materialize-route-component-specs.mjs';

function fixture(t) {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-component-'));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const root = path.join(workspace, 'sdkwork-demo');
  const crate = path.join(root, 'crates', 'sdkwork-routes-catalog-app-api');
  fs.mkdirSync(path.join(crate, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Cargo.toml'), '[workspace]\nmembers = ["crates/sdkwork-routes-catalog-app-api"]\n');
  fs.writeFileSync(path.join(crate, 'Cargo.toml'), '[package]\nname = "sdkwork-routes-catalog-app-api"\nversion = "1.2.3"\n');
  fs.writeFileSync(path.join(crate, 'src', 'lib.rs'), 'pub fn build_router() {}\npub fn app_route_manifest() {}\n');
  fs.writeFileSync(path.join(root, 'specs', 'component.spec.json'), JSON.stringify({ component: { domain: 'commerce' } }));
  return root;
}

test('plans without writing and materializes deterministic route ownership only with --write', (t) => {
  const root = fixture(t);
  const target = path.join(root, 'crates', 'sdkwork-routes-catalog-app-api', 'specs', 'component.spec.json');
  const planned = materializeRouteComponentSpecs(root);
  assert.equal(planned.created.length, 1);
  assert.equal(fs.existsSync(target), false);

  const written = materializeRouteComponentSpecs(root, { write: true });
  assert.equal(written.created.length, 1);
  const component = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.equal(component.component.domain, 'commerce');
  assert.equal(component.component.capability, 'catalog');
  assert.equal(component.component.surface, 'app-api');
  assert.equal(component.component.version, '1.2.3');
  assert.deepEqual(component.contracts.runtimeEntrypoints, ['app_route_manifest', 'build_router']);
  assert.equal(materializeRouteComponentSpecs(root, { write: true }).created.length, 0);
});

test('never overwrites an existing component contract', (t) => {
  const root = fixture(t);
  const target = path.join(root, 'crates', 'sdkwork-routes-catalog-app-api', 'specs', 'component.spec.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, '{"owned":true}\n');
  assert.equal(materializeRouteComponentSpecs(root, { write: true }).created.length, 0);
  assert.equal(fs.readFileSync(target, 'utf8'), '{"owned":true}\n');
});
