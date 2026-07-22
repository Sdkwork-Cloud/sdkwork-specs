import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  scanPlatformEmbedInfra,
  scanStandaloneDoubleInfra,
} from './audit-gateway-route-composition-workspace.mjs';

function createSettingsRepo(mainSource) {
  const root = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-route-composition-')),
    'sdkwork-settings',
  );
  const mainPath = path.join(
    root,
    'crates/sdkwork-api-settings-standalone-gateway/src/main.rs',
  );
  fs.mkdirSync(path.dirname(mainPath), { recursive: true });
  fs.writeFileSync(mainPath, mainSource, 'utf8');
  return root;
}

test('standalone infra scan ignores imports and accepts one mount call', () => {
  const root = createSettingsRepo([
    'use sdkwork_settings_web_bootstrap::mount_settings_infra_routes;',
    'async fn main() {',
    '    let assembly = assemble_api_router(state).await;',
    '    let router = mount_settings_infra_routes(assembly.router, config);',
    '}',
    '',
  ].join('\n'));

  assert.deepEqual(scanStandaloneDoubleInfra(root, 'settings'), []);
});

test('standalone infra scan rejects two mount calls around assembly', () => {
  const root = createSettingsRepo([
    'async fn main() {',
    '    let assembly = assemble_api_router(state).await;',
    '    let router = mount_settings_infra_routes(assembly.router, config);',
    '    let router = mount_settings_infra_routes(router, config);',
    '}',
    '',
  ].join('\n'));

  assert.equal(scanStandaloneDoubleInfra(root, 'settings').length, 1);
});

test('platform embed scan accepts explicit business-only dependency assembly use', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-platform-embed-'));
  const sourcePath = path.join(
    workspace,
    'sdkwork-im/crates/sdkwork-api-im-standalone-gateway/src/embedded_dependency_routes.rs',
  );
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, [
    'async fn bootstrap() {',
    '    let drive = sdkwork_api_drive_assembly::assemble_business_routes(pool).await;',
    '    let mail = sdkwork_api_mail_assembly::assemble_api_router().await;',
    '}',
    '',
  ].join('\n'), 'utf8');

  assert.deepEqual(scanPlatformEmbedInfra(workspace), []);
});
