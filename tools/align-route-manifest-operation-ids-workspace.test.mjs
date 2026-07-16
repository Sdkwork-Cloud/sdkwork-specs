import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('route manifest operationId aligner synchronizes unambiguous derived routes', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-operation-aligner-'));
  const repo = path.join(workspace, 'sdkwork-test');
  const authority = path.join(repo, 'apis', 'app-api', 'test', 'openapi.json');
  const manifestFile = path.join(
    repo,
    'sdks',
    '_route-manifests',
    'app-api',
    'sdkwork-routes-test-app-api.route-manifest.json',
  );
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(authority, `${JSON.stringify({
    openapi: '3.1.2',
    info: { title: 'test', version: '1.0.0' },
    paths: {
      '/app/v3/api/items/{itemId}': {
        delete: { operationId: 'items.delete', responses: { 204: { description: 'deleted' } } },
      },
    },
  }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(manifestFile, `${JSON.stringify({
    kind: 'sdkwork.route.manifest',
    surface: 'app-api',
    routes: [{
      method: 'DELETE',
      path: '/app/v3/api/items/{id}',
      operationId: 'items.remove',
      handler: { name: 'items_remove' },
    }],
  }, null, 2)}\n`, 'utf8');

  const tool = path.resolve(import.meta.dirname, 'align-route-manifest-operation-ids-workspace.mjs');
  const first = spawnSync(process.execPath, [tool, '--workspace', workspace], { encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.equal(manifest.routes[0].operationId, 'items.delete');
  assert.equal(manifest.routes[0].handler.name, 'items_remove');

  const second = spawnSync(process.execPath, [tool, '--workspace', workspace, '--dry-run'], { encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /would align 0 files \(0 changes\)/u);
});
