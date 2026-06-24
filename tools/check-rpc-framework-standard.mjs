#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '../..');
const specsRoot = path.join(workspaceRoot, 'sdkwork-specs');
const frameworkRoot = path.join(workspaceRoot, 'sdkwork-rpc-framework');

const requiredSpecs = [
  'DISCOVERY_SPEC.md',
  'RPC_FRAMEWORK_SPEC.md',
  'RPC_RESILIENCE_SPEC.md',
];

const requiredCrates = [
  'crates/sdkwork-rpc-core',
  'crates/sdkwork-rpc-resilience',
  'crates/sdkwork-rpc-discovery',
  'crates/sdkwork-rpc-client',
  'crates/sdkwork-rpc-server',
];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

for (const spec of requiredSpecs) {
  const specPath = path.join(specsRoot, spec);
  if (!fs.existsSync(specPath)) {
    fail(`missing spec ${spec}`);
  }
}

if (!fs.existsSync(path.join(frameworkRoot, 'Cargo.toml'))) {
  fail('missing sdkwork-rpc-framework/Cargo.toml');
}

const frameworkStandard = path.join(frameworkRoot, 'specs/RPC_FRAMEWORK_STANDARD.md');
if (!fs.existsSync(frameworkStandard)) {
  fail('missing sdkwork-rpc-framework/specs/RPC_FRAMEWORK_STANDARD.md');
}

const frameworkAgents = path.join(frameworkRoot, 'AGENTS.md');
if (!fs.existsSync(frameworkAgents)) {
  fail('missing sdkwork-rpc-framework/AGENTS.md');
}

const commerceRoot = path.join(workspaceRoot, 'sdkwork-commerce');
const commerceAlignmentFiles = [
  'crates/sdkwork-commerce-service-host/src/rpc_framework_bootstrap.rs',
  'crates/sdkwork-commerce-service-host/src/rpc_client_bootstrap.rs',
  'crates/sdkwork-commerce-service-host/src/rpc_discovery.rs',
  'sdks/sdkwork-commerce-rpc-sdk/rpc/sdkwork-commerce-rpc.manifest.json',
];

if (fs.existsSync(commerceRoot)) {
  for (const relativePath of commerceAlignmentFiles) {
    const absolutePath = path.join(commerceRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`missing commerce RPC framework alignment file ${relativePath}`);
    }
  }

  const commerceManifestPath = path.join(
    commerceRoot,
    'sdks/sdkwork-commerce-rpc-sdk/rpc/sdkwork-commerce-rpc.manifest.json',
  );
  const commerceManifest = JSON.parse(fs.readFileSync(commerceManifestPath, 'utf8'));
  assert.equal(commerceManifest.kind, 'sdkwork.rpc.manifest');
  assert.equal(commerceManifest.discoveryServiceName, 'sdkwork-commerce-app-rpc');
  assert.equal(commerceManifest.defaultResilienceProfile, 'rpc-default');

  const commerceComponentSpec = path.join(commerceRoot, 'specs/component.spec.json');
  if (fs.existsSync(commerceComponentSpec)) {
    const componentSpec = JSON.parse(fs.readFileSync(commerceComponentSpec, 'utf8'));
    const canonicalSpecs = componentSpec.canonicalSpecs ?? [];
    const standardsText = JSON.stringify(canonicalSpecs);
    if (!standardsText.includes('RPC_FRAMEWORK_SPEC.md')) {
      fail('commerce specs/component.spec.json must reference RPC_FRAMEWORK_SPEC.md');
    }
    if (!standardsText.includes('DISCOVERY_SPEC.md')) {
      fail('commerce specs/component.spec.json must reference DISCOVERY_SPEC.md');
    }
  }
}

const imRoot = path.join(workspaceRoot, 'sdkwork-im');
const imAlignmentFiles = [
  'crates/sdkwork-im-rpc-service-rust/src/rpc_framework_bootstrap.rs',
  'crates/sdkwork-im-rpc-service-rust/src/rpc_client_bootstrap.rs',
  'crates/sdkwork-im-rpc-service-rust/src/rpc_discovery.rs',
  'sdks/sdkwork-im-rpc-sdk/rpc/sdkwork-im-rpc.manifest.json',
];

if (fs.existsSync(imRoot)) {
  for (const relativePath of imAlignmentFiles) {
    const absolutePath = path.join(imRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`missing IM RPC framework alignment file ${relativePath}`);
    }
  }

  const imManifestPath = path.join(
    imRoot,
    'sdks/sdkwork-im-rpc-sdk/rpc/sdkwork-im-rpc.manifest.json',
  );
  const imManifest = JSON.parse(fs.readFileSync(imManifestPath, 'utf8'));
  assert.equal(imManifest.kind, 'sdkwork.rpc.manifest');
  assert.equal(imManifest.discoveryServiceName, 'sdkwork-communication-app-rpc');
  assert.equal(imManifest.defaultResilienceProfile, 'rpc-default');
}

for (const crate of requiredCrates) {
  const cargoToml = path.join(frameworkRoot, crate, 'Cargo.toml');
  if (!fs.existsSync(cargoToml)) {
    fail(`missing framework crate ${crate}`);
  }
}

const readme = fs.readFileSync(path.join(specsRoot, 'README.md'), 'utf8');
for (const spec of requiredSpecs) {
  if (!readme.includes(spec)) {
    fail(`README.md must reference ${spec}`);
  }
}

const agents = fs.readFileSync(path.join(specsRoot, 'AGENTS_SPEC.md'), 'utf8');
if (!agents.includes('RPC_FRAMEWORK_SPEC.md') || !agents.includes('DISCOVERY_SPEC.md')) {
  fail('AGENTS_SPEC.md must map RPC framework and discovery tasks');
}

const testSpec = fs.readFileSync(path.join(specsRoot, 'TEST_SPEC.md'), 'utf8');
if (!testSpec.includes('RPC Framework Integration Tests')) {
  fail('TEST_SPEC.md must define RPC framework integration tests');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('check-rpc-framework-standard: ok');
