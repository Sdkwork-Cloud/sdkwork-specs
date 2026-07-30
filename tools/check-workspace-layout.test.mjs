import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  listWorkspaceRepositoryRoots,
  validateWorkspaceLayout,
} from './lib/workspace-layout.mjs';

function temporaryDirectory(prefix = 'sdkwork-workspace-layout-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('accepts tool-native generated directories', () => {
  const root = temporaryDirectory();
  fs.mkdirSync(path.join(root, 'target', 'sdkwork', 'gateway'), { recursive: true });
  fs.mkdirSync(path.join(root, 'node_modules', '.vite', 'pc'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'demo', '.dart_tool'), { recursive: true });
  assert.deepEqual(validateWorkspaceLayout(root), []);
});

test('rejects root and nested runtime directories without inspecting their contents', () => {
  const root = temporaryDirectory();
  fs.mkdirSync(path.join(root, '.runtime', 'large-cache'), { recursive: true });
  fs.mkdirSync(path.join(root, 'apps', 'sdkwork-demo-pc', '.runtime', 'tsx'), { recursive: true });
  assert.deepEqual(
    validateWorkspaceLayout(root).map((issue) => issue.path),
    ['.runtime', 'apps/sdkwork-demo-pc/.runtime'],
  );
});

test('allows defensive runtime ignore rules while still rejecting physical directories', () => {
  const root = temporaryDirectory();
  fs.writeFileSync(path.join(root, '.gitignore'), [
    'node_modules/',
    '/.runtime/',
    '**/.runtime/',
    '!.runtime/keep',
    '',
  ].join('\n'));
  assert.deepEqual(validateWorkspaceLayout(root), []);
  fs.mkdirSync(path.join(root, '.runtime'));
  assert.equal(validateWorkspaceLayout(root)[0].kind, 'forbidden-generated-state-directory');
});

test('rejects competing authored root directory names', () => {
  const root = temporaryDirectory();
  fs.mkdirSync(path.join(root, 'api'));
  fs.mkdirSync(path.join(root, 'tooling'));
  assert.deepEqual(
    validateWorkspaceLayout(root).map((issue) => issue.kind),
    ['competing-root-directory', 'competing-root-directory'],
  );
});

test('lists only repository-shaped workspace children', () => {
  const workspace = temporaryDirectory();
  fs.mkdirSync(path.join(workspace, 'sdkwork-alpha'));
  fs.writeFileSync(path.join(workspace, 'sdkwork-alpha', 'AGENTS.md'), '# Agents\n');
  fs.mkdirSync(path.join(workspace, 'scratch'));
  assert.deepEqual(
    listWorkspaceRepositoryRoots(workspace).map((root) => path.basename(root)),
    ['sdkwork-alpha'],
  );
});
