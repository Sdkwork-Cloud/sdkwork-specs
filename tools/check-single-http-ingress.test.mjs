import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateRepository } from './check-single-http-ingress.mjs';

function makeRepo(topology) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-single-http-ingress-'));
  fs.mkdirSync(path.join(root, 'specs'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'specs', 'topology.spec.json'),
    `${JSON.stringify(topology, null, 2)}\n`,
  );
  return root;
}

function baseTopology(profiles) {
  return {
    schemaVersion: 2,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    vocabulary: {
      deploymentProfile: { allowed: ['standalone', 'cloud'] },
      environment: { allowed: ['development', 'production'] },
    },
    orchestration: { profiles },
  };
}

test('accepts standalone and cloud profiles with one gateway application ingress', () => {
  const root = makeRepo(baseTopology({
    'standalone.development': {
      processes: [
        {
          id: 'application.public-ingress',
          binary: 'sdkwork-api-demo-standalone-gateway',
        },
      ],
    },
    'cloud.production': {
      processes: [
        {
          id: 'application.public-ingress',
          binary: 'sdkwork-demo-cloud-gateway',
        },
        {
          id: 'platform.api-gateway',
          binary: 'sdkwork-api-cloud-gateway',
        },
      ],
    },
  }));

  const result = validateRepository(root);

  assert.deepEqual(result.errors, []);
});

test('rejects retired split and unified profile ids and serviceLayout vocabulary', () => {
  const root = makeRepo({
    ...baseTopology({
      'standalone.unified-process.development': {
        processes: [
          {
            id: 'application.public-ingress',
            binary: 'sdkwork-api-demo-standalone-gateway',
          },
        ],
      },
      'cloud.split-services.production': {
        processes: [
          {
            id: 'application.public-ingress',
            binary: 'sdkwork-demo-cloud-gateway',
          },
        ],
      },
    }),
    vocabulary: {
      deploymentProfile: { allowed: ['standalone', 'cloud'] },
      serviceLayout: { allowed: ['unified-process', 'split-services'] },
      environment: { allowed: ['development', 'production'] },
    },
  });

  const result = validateRepository(root);

  assert.ok(result.errors.some((issue) => issue.includes('retired profile id')));
  assert.ok(result.errors.some((issue) => issue.includes('retired vocabulary.serviceLayout')));
});

test('rejects multiple application HTTP listeners for any standalone or cloud profile', () => {
  const root = makeRepo(baseTopology({
    'cloud.production': {
      processes: [
        {
          id: 'application.public-ingress',
          binary: 'sdkwork-demo-cloud-gateway',
        },
        {
          id: 'application.backend-http',
          binary: 'sdkwork-demo-backend-api',
        },
      ],
    },
  }));

  const result = validateRepository(root);

  assert.ok(result.errors.some((issue) => issue.includes('starts 2 application HTTP ingress processes')));
  assert.ok(result.errors.some((issue) => issue.includes('starts decomposed HTTP listeners')));
});
