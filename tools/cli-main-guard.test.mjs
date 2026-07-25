#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const toolsDir = import.meta.dirname;
const importableTools = [
  'align-composition-sdk-dependencies.mjs',
  'align-permission-composition.mjs',
  'check-process-shared-database-pool.mjs',
  'audit-repository-baseline.mjs',
];

for (const tool of importableTools) {
  const toolUrl = pathToFileURL(path.join(toolsDir, tool)).href;
  const imported = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import(${JSON.stringify(toolUrl)});`],
    { encoding: 'utf8' },
  );
  assert.equal(
    imported.status,
    0,
    `${tool} must be importable when process.argv[1] is absent:\n${imported.stdout}${imported.stderr}`,
  );
  assert.equal(imported.stdout, '', `${tool} must not execute its CLI while imported`);
  assert.equal(imported.stderr, '', `${tool} must not emit errors while imported`);
}

for (const tool of [
  'align-composition-sdk-dependencies.mjs',
  'align-permission-composition.mjs',
]) {
  const executed = spawnSync(process.execPath, [path.join(toolsDir, tool), '--help'], {
    encoding: 'utf8',
  });
  assert.equal(executed.status, 0, `${tool} --help failed:\n${executed.stdout}${executed.stderr}`);
  assert.match(executed.stdout, /Usage:/u, `${tool} must execute when invoked directly`);
}

process.stdout.write('cli-main-guard.test.mjs passed\n');
