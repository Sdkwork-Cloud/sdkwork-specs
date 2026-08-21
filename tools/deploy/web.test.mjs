import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdaptiveMapBlocks, resolveWebMode } from './web.mjs';

test('adaptive UA map matches iPad before the mobile Mobile substring', () => {
  const [uaMap] = buildAdaptiveMapBlocks('sdkwork-webserver');
  const ipadIndex = uaMap.indexOf('"~*iPad" pc;');
  const mobileIndex = uaMap.indexOf('"~*(Mobile|');
  assert.ok(ipadIndex > 0, 'default tablet surface must emit iPad → pc');
  assert.ok(mobileIndex > ipadIndex, 'iPad entry must precede the mobile regex');

  const [uaMapH5] = buildAdaptiveMapBlocks('sdkwork-webserver', {
    web: { tablet: 'h5' },
  });
  assert.ok(uaMapH5.includes('"~*iPad" h5;'));
  assert.ok(
    uaMapH5.indexOf('"~*iPad" h5;') < uaMapH5.indexOf('"~*(Mobile|'),
    'tablet:h5 iPad entry must still precede the mobile regex',
  );
});

test('resolveWebMode folds to static-fallback when neither surface exists', () => {
  const resolved = resolveWebMode('/tmp/missing-module', 'sdkwork-missing', 'adaptive', {
    staticRoot: '/usr/share/sdkwork/missing/web/static',
  });
  assert.equal(resolved.mode, 'static-fallback');
  assert.equal(resolved.staticRoot, '/usr/share/sdkwork/missing/web/static');
  assert.deepEqual(resolved.surfaces, []);
});
