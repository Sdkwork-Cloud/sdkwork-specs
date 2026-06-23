#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const discoveryRoot = path.join(workspaceRoot, 'sdkwork-discovery');
const componentSpecPath = path.join(discoveryRoot, 'specs/component.spec.json');

if (!fs.existsSync(componentSpecPath)) {
  console.error('FAIL missing sdkwork-discovery specs/component.spec.json');
  process.exit(1);
}

const componentSpec = JSON.parse(fs.readFileSync(componentSpecPath, 'utf8'));
const canonicalFiles = (componentSpec.canonicalSpecs ?? []).map((entry) => entry.file);
const required = ['DISCOVERY_SPEC.md', 'RPC_FRAMEWORK_SPEC.md', 'RPC_RESILIENCE_SPEC.md'];

for (const spec of required) {
  if (!canonicalFiles.includes(spec)) {
    console.error(`FAIL sdkwork-discovery component.spec.json must reference ${spec}`);
    process.exit(1);
  }
}

const manifestPath = path.join(
  discoveryRoot,
  'sdks/sdkwork-discovery-rpc-sdk/sdkwork-discovery-rpc.manifest.json',
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.kind, 'sdkwork.rpc.manifest');
assert.ok(manifest.services?.length > 0, 'discovery rpc manifest must declare services');

console.log('check-discovery-standard: ok');
