#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  browserDistEnvAlias,
  resolveBrowserDistOutDir,
  resolveInstalledBrowserWebRoot,
} from './browser-dist-layout.mjs';

test('maps lifecycle environments to dist path segments', () => {
  assert.equal(browserDistEnvAlias('development'), 'dev');
  assert.equal(browserDistEnvAlias('production'), 'prod');
  assert.equal(resolveBrowserDistOutDir('test'), 'dist/test');
  assert.equal(resolveBrowserDistOutDir('staging'), 'dist/staging');
});

test('rejects unknown environments', () => {
  assert.throws(() => resolveBrowserDistOutDir('dev'), /must be one of/);
});

test('resolves installed Adaptive Web roots', () => {
  assert.equal(resolveInstalledBrowserWebRoot('webserver', 'pc'), '/usr/share/sdkwork/webserver/web/pc');
  assert.equal(resolveInstalledBrowserWebRoot('webserver', 'h5'), '/usr/share/sdkwork/webserver/web/h5');
  assert.equal(
    resolveInstalledBrowserWebRoot('webserver', 'static'),
    '/usr/share/sdkwork/webserver/web/static',
  );
});
