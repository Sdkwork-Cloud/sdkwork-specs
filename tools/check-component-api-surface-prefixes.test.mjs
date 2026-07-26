import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { scanComponentApiSurfacePrefixes } from './check-component-api-surface-prefixes.mjs';

function fixture(spec) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-api-prefixes-'));
  const specs = path.join(root, 'specs');
  fs.mkdirSync(specs, { recursive: true });
  fs.writeFileSync(path.join(specs, 'component.spec.json'), JSON.stringify(spec));
  return root;
}

test('accepts complete multi-prefix authority coverage', () => {
  const root = fixture({
    dependencies: [{
      serviceId: 'sdkwork-drive-app-api',
      apiPrefixes: ['/app/v3/api/assets', '/app/v3/api/drive'],
    }],
    apiSurfaces: [
      { dependencyServiceId: 'sdkwork-drive-app-api', prefix: '/app/v3/api/assets' },
      { dependencyServiceId: 'sdkwork-drive-app-api', prefix: '/app/v3/api/drive' },
    ],
  });
  assert.deepEqual(scanComponentApiSurfacePrefixes(root), []);
});

test('rejects omitted and synthetic authority prefixes', () => {
  const root = fixture({
    dependencies: [{
      serviceId: 'sdkwork-drive-app-api',
      apiPrefixes: ['/app/v3/api/assets', '/app/v3/api/drive'],
    }],
    apiSurfaces: [
      { dependencyServiceId: 'sdkwork-drive-app-api', prefix: '/app/v3/api/assets' },
      { dependencyServiceId: 'other-api', prefix: '/__sdkwork/platform' },
    ],
  });
  const issues = scanComponentApiSurfacePrefixes(root);
  assert.ok(issues.some((issue) => issue.includes('apiSurfaces missing /app/v3/api/drive')));
  assert.ok(issues.some((issue) => issue.includes('synthetic prefix /__sdkwork/platform')));
});
