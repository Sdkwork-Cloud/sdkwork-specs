import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAdaptiveWebFolding } from './adaptive-web.mjs';

function adaptiveDoc() {
  return {
    http: {
      include: ['snippets/adaptive-web.maps.conf'],
      server: [
        {
          serverName: ['server.sdkwork.com'],
          include: ['snippets/adaptive-web.named-locations.conf'],
          location: [
            { match: '/api/', proxyPass: 'http://gateway' },
            { match: '/', include: ['snippets/adaptive-web.dispatch.conf'] },
          ],
        },
        {
          serverName: ['server-dev.sdkwork.com'],
          location: [{ match: '/', proxyPass: 'http://gateway' }],
        },
      ],
    },
  };
}

function publicRoot(doc) {
  return doc.http.server[0].location.find((location) => location.match === '/');
}

test('keeps named-location adaptive wiring when pc and h5 exist', () => {
  const { mode, doc, warnings } = applyAdaptiveWebFolding(adaptiveDoc(), {
    pcExists: true,
    h5Exists: true,
  });
  assert.equal(mode, 'adaptive');
  assert.deepEqual(warnings, []);
  assert.deepEqual(doc.http.include, ['snippets/adaptive-web.maps.conf']);
  assert.deepEqual(doc.http.server[0].include, [
    'snippets/adaptive-web.named-locations.conf',
  ]);
  assert.deepEqual(publicRoot(doc).include, [
    'snippets/adaptive-web.dispatch.conf',
  ]);
  assert.equal(doc.http.server[1].location[0].proxyPass, 'http://gateway');
});

test('collapse-pc removes maps and serves fixed pc root', () => {
  const { mode, doc } = applyAdaptiveWebFolding(adaptiveDoc(), {
    pcExists: true,
    h5Exists: false,
  });
  assert.equal(mode, 'collapse-pc');
  assert.deepEqual(doc.http.include, []);
  assert.equal(doc.http.server[0].include, undefined);
  assert.deepEqual(publicRoot(doc), {
    match: '/',
    root: '/usr/share/sdkwork/webserver/web/pc',
    index: ['index.html'],
    tryFiles: ['$uri', '$uri/', '/index.html'],
  });
});

test('collapse-h5 removes maps and serves fixed h5 root', () => {
  const { mode, doc } = applyAdaptiveWebFolding(adaptiveDoc(), {
    pcExists: false,
    h5Exists: true,
  });
  assert.equal(mode, 'collapse-h5');
  assert.equal(publicRoot(doc).root, '/usr/share/sdkwork/webserver/web/h5');
  assert.deepEqual(publicRoot(doc).tryFiles, ['$uri', '$uri/', '/index.html']);
});

test('static-fallback uses ordinary static try_files =404', () => {
  const { mode, doc } = applyAdaptiveWebFolding(adaptiveDoc(), {
    pcExists: false,
    h5Exists: false,
  });
  assert.equal(mode, 'static-fallback');
  assert.deepEqual(publicRoot(doc), {
    match: '/',
    root: '/usr/share/sdkwork/webserver/web/static',
    index: ['index.html'],
    tryFiles: ['$uri', '$uri/', '=404'],
  });
});

test('does not rewrite proxied non-production hosts without adaptive wiring', () => {
  const { doc } = applyAdaptiveWebFolding(adaptiveDoc(), {
    pcExists: false,
    h5Exists: false,
  });
  assert.equal(doc.http.server[1].location[0].proxyPass, 'http://gateway');
  assert.equal(doc.http.server[1].location[0].root, undefined);
});

test('does not inject Adaptive Web onto proxy-only public ingress hosts', () => {
  const doc = {
    http: {
      server: [
        {
          serverName: ['server.sdkwork.com'],
          location: [
            { match: '/api/', proxyPass: 'http://gateway' },
            { match: '/', proxyPass: 'http://gateway' },
          ],
        },
      ],
    },
  };
  const folded = applyAdaptiveWebFolding(doc, {
    pcExists: true,
    h5Exists: true,
  });
  assert.equal(folded.mode, 'proxy-passthrough');
  assert.deepEqual(folded.warnings, []);
  assert.equal(folded.doc.http.server[0].include, undefined);
  assert.equal(folded.doc.http.server[0].location[1].proxyPass, 'http://gateway');
  assert.equal(folded.doc.http.server[0].location[1].include, undefined);
  assert.equal(folded.doc.http.server[0].location[1].root, undefined);
});
