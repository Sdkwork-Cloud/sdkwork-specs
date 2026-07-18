import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const resolverUrl = pathToFileURL(path.resolve('tools/deploy/yaml-resolver.mjs'));

test('getYaml resolves a package hoisted above the target repository', async () => {
  const workspaceRoot = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-yaml-resolver-'));
  const repoRoot = path.join(workspaceRoot, 'apps', 'demo');
  const yamlRoot = path.join(workspaceRoot, 'node_modules', 'yaml');

  try {
    mkdirSync(repoRoot, { recursive: true });
    mkdirSync(yamlRoot, { recursive: true });
    writeFileSync(path.join(repoRoot, 'package.json'), '{"type":"module"}\n');
    writeFileSync(path.join(yamlRoot, 'package.json'), '{"main":"index.cjs"}\n');
    writeFileSync(path.join(yamlRoot, 'index.cjs'), 'module.exports = { parse: () => "hoisted" };\n');

    const { getYaml } = await import(`${resolverUrl.href}?test=${Date.now()}`);
    assert.equal(getYaml(repoRoot).parse('value'), 'hoisted');
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
