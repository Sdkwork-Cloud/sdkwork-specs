import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { scanStandaloneDoubleInfra } from './audit-gateway-route-composition-workspace.mjs';

function createSettingsRepo(mainSource) {
  const root = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-composition-')),
    'sdkwork-settings',
  );
  const mainPath = path.join(
    root,
    'crates/sdkwork-settings-standalone-gateway/src/main.rs',
  );
  fs.mkdirSync(path.dirname(mainPath), { recursive: true });
  fs.writeFileSync(mainPath, mainSource, 'utf8');
  return root;
}

test('standalone infra scan ignores imports and accepts one mount call', () => {
  const root = createSettingsRepo([
    'use sdkwork_settings_web_bootstrap::mount_settings_infra_routes;',
    'async fn main() {',
    '    let assembly = assemble_application_router(state).await;',
    '    let router = mount_settings_infra_routes(assembly.router, config);',
    '}',
    '',
  ].join('\n'));

  assert.deepEqual(scanStandaloneDoubleInfra(root, 'settings'), []);
});

test('standalone infra scan rejects two mount calls around assembly', () => {
  const root = createSettingsRepo([
    'async fn main() {',
    '    let assembly = assemble_application_router(state).await;',
    '    let router = mount_settings_infra_routes(assembly.router, config);',
    '    let router = mount_settings_infra_routes(router, config);',
    '}',
    '',
  ].join('\n'));

  assert.equal(scanStandaloneDoubleInfra(root, 'settings').length, 1);
});
