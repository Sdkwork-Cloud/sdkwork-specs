import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { filterApiSurfacesForSurface, resolveApiSurfaces } from './api.mjs';

test('YAML internal-api authority is application-ingress only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-deploy-api-'));
  const authority = path.join(
    root,
    'apis',
    'internal-api',
    'drive',
    'sdkwork-drive-internal-api.openapi.yaml',
  );
  fs.mkdirSync(path.dirname(authority), { recursive: true });
  fs.writeFileSync(
    authority,
    [
      'openapi: 3.1.2',
      'paths:',
      '  /internal/v3/api/drive/resources:',
      '    get:',
      '      operationId: driveResources.list',
      '',
    ].join('\n'),
    'utf8',
  );

  const surfaces = resolveApiSurfaces({}, root);
  assert.deepEqual(surfaces, [
    {
      kind: 'internal-api',
      prefix: '/internal/v3/api',
      source: path.relative(root, authority),
    },
  ]);
  assert.equal(
    filterApiSurfacesForSurface(surfaces, 'application.public-ingress').length,
    1,
  );
  assert.equal(filterApiSurfacesForSurface(surfaces, 'platform.api-gateway').length, 0);
});

test('logical app and backend domains expose only their owned API surface', () => {
  const surfaces = [
    { kind: 'app-api', prefix: '/app/v3/api' },
    { kind: 'backend-api', prefix: '/backend/v3/api' },
    { kind: 'open-api', prefix: '/deploy/v3/api' },
  ];

  assert.deepEqual(
    filterApiSurfacesForSurface(surfaces, 'application.app-http'),
    [surfaces[0]],
  );
  assert.deepEqual(
    filterApiSurfacesForSurface(surfaces, 'application.backend-http'),
    [surfaces[1]],
  );
});
