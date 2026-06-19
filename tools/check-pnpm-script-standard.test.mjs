import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';

const CHECKER = path.resolve('tools/check-pnpm-script-standard.mjs');

function makeRepo(manifest) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-pnpm-script-standard-'));
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return root;
}

function runChecker(root, productPrefix = 'demo') {
  return spawnSync(
    process.execPath,
    [CHECKER, '--root', root, '--product-prefix', productPrefix],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  );
}

describe('check-pnpm-script-standard', () => {
  it('accepts a repository root with canonical scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'gateway:package:cloud': 'node scripts/sdkwork-command.mjs gateway package --deployment-profile cloud',
      },
    });

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pnpm script standard ok/);
  });

  it('rejects missing required root scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing required root script "build"/);
    assert.match(result.stderr, /missing required root script "verify"/);
  });

  it('rejects product-prefixed public scripts and gateway profile-first names', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'demo:dev': 'node scripts/demo-dev.mjs',
        'gateway:cloud:bundle': 'node scripts/gateway-cloud-bundle.mjs bundle',
      },
    });

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /demo:dev: first segment "demo" is not a standard public namespace/);
    assert.match(result.stderr, /demo:dev: product-prefixed public root scripts are forbidden/);
    assert.match(result.stderr, /gateway:cloud:bundle: use gateway:<action>\[:deploymentProfile\]/);
  });

  it('ignores generated package manifests while scanning local packages', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const generatedDir = path.join(root, 'sdks/demo/generated/server-openapi');
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(
      path.join(generatedDir, 'package.json'),
      `${JSON.stringify({ name: 'generated', scripts: { 'demo:dev': 'vite' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });
});
