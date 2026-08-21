import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RETIRED_COMPATIBILITY_DIAGNOSTIC,
  RETIRED_NGINX_PROFILE_DIAGNOSTIC,
  retiredNginxActivationBlock,
  retiredNginxDiagnostics,
  retiredNginxKeys,
} from './webserver/retired-nginx.mjs';

test('retiredNginxDiagnostics reports [compatibility] and nginxProfile', () => {
  const errors = retiredNginxDiagnostics({
    compatibility: { enabled: true },
    nginx: { nginxProfile: 'http-core-v1' },
  });
  assert.equal(errors.length, 2);
  assert.equal(errors[0].path, 'compatibility');
  assert.equal(errors[0].message, RETIRED_COMPATIBILITY_DIAGNOSTIC);
  assert.equal(errors[1].path, 'nginx.nginxProfile');
  assert.equal(errors[1].message, RETIRED_NGINX_PROFILE_DIAGNOSTIC);
  assert.deepEqual([...retiredNginxKeys({ nginx: { nginxProfile: 'x' } })], ['nginxProfile']);
});

test('retiredNginxActivationBlock prefers compatibility table', () => {
  const blocked = retiredNginxActivationBlock({
    compatibility: { enabled: true },
    nginx: { nginxProfile: 'http-core-v1' },
  });
  assert.equal(blocked.blocked, true);
  assert.match(blocked.reason, /\[compatibility\]/);
});

test('canonical [nginx] is not blocked', () => {
  const blocked = retiredNginxActivationBlock({
    nginx: { enabled: true, profile: 'http-core-v1' },
  });
  assert.equal(blocked.blocked, false);
  assert.equal(retiredNginxDiagnostics({ nginx: { enabled: true } }).length, 0);
});
