import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

function read(relativePath) {
  return readFileSync(path.resolve(relativePath), 'utf8');
}

describe('read-only upstream source dependency standard', () => {
  it('defines native dependency consumption and immutable upstream ownership', () => {
    const dependencySpec = read('DEPENDENCY_MANAGEMENT_SPEC.md');
    const workspaceSpec = read('SDKWORK_WORKSPACE_SPEC.md');

    assert.match(dependencySpec, /## 3\.2 Read-Only Upstream Source Dependencies/u);
    assert.match(dependencySpec, /`external\/`, `third_party\/`, and `vendor\/`/u);
    assert.match(dependencySpec, /`MUST` remain unmodified relative to the recorded upstream revision/u);
    assert.match(dependencySpec, /codex-app-server-client = \{ path = "external\/codex\/codex-rs\/app-server-client" \}/u);
    assert.match(dependencySpec, /official process\/protocol boundary/u);
    assert.match(workspaceSpec, /Repository layout, code-style, naming, and authored-source validators `MUST` exclude these trees/u);
    assert.match(workspaceSpec, /`MUST NOT` be assigned SDKWork component-spec ownership/u);
  });

  it('requires public runtime facades instead of provider-owned persistence', () => {
    const integrationSpec = read('INTEGRATION_SPEC.md');
    const testSpec = read('TEST_SPEC.md');

    assert.match(integrationSpec, /## 2\.1 Upstream Runtime Facades And Provider-Owned State/u);
    assert.match(integrationSpec, /Provider-owned runtime state[\s\S]*MUST NOT` be treated as a live integration API/u);
    assert.match(integrationSpec, /codex-app-server-client` with `codex-app-server-protocol/u);
    assert.match(integrationSpec, /~\/\.codex\/state_\*\.sqlite/u);
    assert.match(testSpec, /public-facade integration tests/u);
    assert.match(testSpec, /Production access to `~\/\.codex\/state_\*\.sqlite`/u);
  });

  it('routes agents and supply-chain review through the new boundary', () => {
    const agentsSpec = read('AGENTS_SPEC.md');
    const readme = read('README.md');
    const supplyChainSpec = read('SUPPLY_CHAIN_SECURITY_SPEC.md');

    assert.match(agentsSpec, /Read-only upstream source under `external\/`, `third_party\/`, or `vendor\/`/u);
    assert.match(readme, /Add, upgrade, or consume read-only upstream source/u);
    assert.match(supplyChainSpec, /clean-tree evidence/u);
    assert.match(supplyChainSpec, /exact upstream revision used by the build/u);
  });
});
