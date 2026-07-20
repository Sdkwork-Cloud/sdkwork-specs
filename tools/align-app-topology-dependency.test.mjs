import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { planTopologyDependencyAlignment } from './align-app-topology-dependency.mjs';

test('aligns dependency and preserves sibling workspace authority', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-topology-dependency-'));
  const specs = path.join(root, 'sdkwork-specs');
  const repo = path.join(root, 'sdkwork-demo');
  fs.mkdirSync(path.join(specs, 'workspace', 'consumers'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'specs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ scripts: {} }));
  fs.writeFileSync(path.join(repo, 'specs', 'topology.spec.json'), JSON.stringify({ schemaVersion: 5 }));
  fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), [
    'packages:',
    '  - "apps/*"',
    '  - "../sdkwork-shared"',
    '',
    'catalog:',
    '  react: ^19.2.4',
    '',
  ].join('\n'));
  const plan = planTopologyDependencyAlignment(repo, specs);
  assert.equal(plan.manifest.devDependencies['@sdkwork/app-topology'], 'workspace:*');
  assert.deepEqual(plan.consumer.pnpm.packages, ['../sdkwork-app-topology', '../sdkwork-shared']);
  assert.deepEqual(plan.consumer.catalog, { react: '^19.2.4' });
});

test('canonicalizes retired sibling package paths before promoting workspace state to authority', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-topology-dependency-paths-'));
  const specs = path.join(root, 'sdkwork-specs');
  const repo = path.join(root, 'sdkwork-demo');
  const search = path.join(root, 'sdkwork-search');
  fs.mkdirSync(path.join(specs, 'workspace', 'consumers'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(search, 'apps/sdkwork-search-common/packages/sdkwork-search-contracts'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ scripts: {} }));
  fs.writeFileSync(path.join(repo, 'specs', 'topology.spec.json'), JSON.stringify({ schemaVersion: 5 }));
  fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), [
    'packages:',
    '  - "../sdkwork-search/packages/common/search/sdkwork-search-contracts"',
    '',
  ].join('\n'));

  const plan = planTopologyDependencyAlignment(repo, specs);

  assert.deepEqual(plan.consumer.pnpm.packages, [
    '../sdkwork-app-topology',
    '../sdkwork-search/apps/sdkwork-search-common/packages/sdkwork-search-contracts',
  ]);
});

test('does not report catalog key-order differences as authority drift', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-topology-dependency-order-'));
  const specs = path.join(root, 'sdkwork-specs');
  const repo = path.join(root, 'sdkwork-demo');
  fs.mkdirSync(path.join(specs, 'workspace', 'consumers'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'specs'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
    devDependencies: { '@sdkwork/app-topology': 'workspace:*' },
  }));
  fs.writeFileSync(path.join(repo, 'specs', 'topology.spec.json'), JSON.stringify({ schemaVersion: 5 }));
  fs.writeFileSync(path.join(repo, 'pnpm-workspace.yaml'), [
    'packages:',
    '  - "../sdkwork-app-topology"',
    '',
    'catalog:',
    '  react: ^19.2.4',
    '  vite: ^8.0.3',
    '',
  ].join('\n'));
  fs.writeFileSync(
    path.join(specs, 'workspace', 'consumers', 'sdkwork-demo.json'),
    JSON.stringify({
      pnpm: { packages: ['../sdkwork-app-topology'] },
      catalog: { vite: '^8.0.3', react: '^19.2.4' },
    }),
  );

  const plan = planTopologyDependencyAlignment(repo, specs);

  assert.deepEqual(plan.actions, []);
});
