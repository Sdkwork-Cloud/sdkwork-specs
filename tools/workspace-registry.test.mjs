import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { loadDefaultCatalog } from './lib/workspace-registry.mjs';

function makeSpecsRoot() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-workspace-registry-'));
  const specsRoot = path.join(workspaceRoot, 'sdkwork-specs');
  fs.mkdirSync(path.join(specsRoot, 'workspace'), { recursive: true });
  return { specsRoot, workspaceRoot };
}

test('workspace registry prefers the checkout governance catalog', () => {
  const { specsRoot, workspaceRoot } = makeSpecsRoot();
  fs.writeFileSync(
    path.join(specsRoot, 'workspace', 'catalog.base.json'),
    '{"react":"^18.0.0"}\n',
  );
  fs.mkdirSync(path.join(workspaceRoot, 'configs'));
  fs.writeFileSync(
    path.join(workspaceRoot, 'configs', 'dependency-catalog.yaml'),
    'react: ^19.2.4\n"@tanstack/react-query": ^5.96.2\n',
  );

  assert.deepEqual(loadDefaultCatalog({ specsRoot }), {
    react: '^19.2.4',
    '@tanstack/react-query': '^5.96.2',
  });
});

test('workspace registry falls back for a standalone specs checkout', () => {
  const { specsRoot } = makeSpecsRoot();
  fs.writeFileSync(
    path.join(specsRoot, 'workspace', 'catalog.base.json'),
    '{"react":"^18.3.1"}\n',
  );

  assert.deepEqual(loadDefaultCatalog({ specsRoot }), { react: '^18.3.1' });
});
