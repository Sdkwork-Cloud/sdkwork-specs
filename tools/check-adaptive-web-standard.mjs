#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// APP_RUNTIME_TOPOLOGY_SPEC.md §8.2: repositories that declare both pc-web and
// h5 browser client architectures MUST expose the standard adaptive browser
// delivery (dev-server-proxy with renderers covering both architectures) and
// MUST NOT keep private root `_sdkwork:client:browser:*` hooks, which the
// framework now owns.
const ADAPTIVE_ARCHITECTURES = Object.freeze(['pc-web', 'h5']);
const BROWSER_HOOK_PATTERN = /^_sdkwork:client:browser(?::|$)/u;
const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]+$/u;

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function declaredClientArchitectures(topology) {
  const architectures = new Set();
  for (const profile of Object.values(topology.orchestration?.profiles ?? {})) {
    for (const process of profile.processes ?? []) {
      if (process.role === 'client') {
        for (const architecture of process.clientArchitectures ?? []) {
          architectures.add(architecture);
        }
      }
    }
    for (const delivery of profile.browserDeliveries ?? []) {
      for (const architecture of delivery.clientArchitectures ?? []) {
        architectures.add(architecture);
      }
    }
  }
  return architectures;
}

function declaresAdaptivePair(profile) {
  const architectures = new Set();
  for (const process of profile.processes ?? []) {
    if (process.role !== 'client') continue;
    for (const architecture of process.clientArchitectures ?? []) {
      architectures.add(architecture);
    }
  }
  return ADAPTIVE_ARCHITECTURES.every((architecture) => architectures.has(architecture));
}

function rendererInvocationPresent(renderer) {
  return Boolean(renderer.command || renderer.script || renderer.crate
    || (renderer.package && renderer.script));
}

function checkAdaptiveDelivery(root, profileId, profile, issues, label) {
  const deliveries = (profile.browserDeliveries ?? [])
    .filter((delivery) => delivery.deliveryMode === 'dev-server-proxy');
  if (deliveries.length === 0) {
    issues.push(`${profileId} must declare a dev-server-proxy browser delivery for adaptive PC/H5 access`);
    return;
  }
  const clientProcesses = new Map(
    (profile.processes ?? [])
      .filter((process) => process.role === 'client')
      .map((process) => [process.id, process]),
  );
  const adaptive = deliveries.find((delivery) => (
    delivery.renderers && typeof delivery.renderers === 'object'
    && ADAPTIVE_ARCHITECTURES.every((architecture) => delivery.renderers[architecture])
  ));
  if (!adaptive) {
    issues.push(
      `${profileId} adaptive browser delivery must declare renderers covering both ${ADAPTIVE_ARCHITECTURES.join(' and ')}`,
    );
    return;
  }
  const clientProcess = clientProcesses.get(adaptive.clientProcessId);
  if (!clientProcess?.bindEnv) {
    issues.push(
      `${profileId} adaptive browser delivery ${adaptive.id} must reference a client process with bindEnv`,
    );
  }
  if (adaptive.preserveCanonicalPaths !== true) {
    issues.push(`${profileId} adaptive browser delivery ${adaptive.id} must preserve canonical API paths`);
  }
  for (const architecture of ADAPTIVE_ARCHITECTURES) {
    const renderer = adaptive.renderers[architecture];
    const rendererLabel = `${profileId} adaptive renderer ${architecture}`;
    const applicationRoot = path.resolve(root, renderer.applicationRoot);
    if (!rendererInvocationPresent(renderer)) {
      issues.push(`${rendererLabel} requires a command/args or script invocation`);
    }
    if (renderer.defaultPort === undefined && !ENV_KEY_PATTERN.test(renderer.portEnv ?? '')) {
      issues.push(`${rendererLabel} must resolve a TCP port from defaultPort or portEnv`);
    }
    if (!fs.existsSync(path.join(applicationRoot, 'package.json'))) {
      issues.push(`${rendererLabel} applicationRoot has no package.json (${renderer.applicationRoot})`);
    }
  }
}

function checkBrowserHookRetirement(root, issues) {
  const manifest = readJsonFile(path.join(root, 'package.json'));
  for (const scriptName of Object.keys(manifest?.scripts ?? {})) {
    if (BROWSER_HOOK_PATTERN.test(scriptName)) {
      issues.push(
        `${scriptName} is retired; adaptive browser delivery is owned by the @sdkwork/app-topology framework`,
      );
    }
  }
}

export function checkAdaptiveWebStandard(root) {
  const issues = [];
  const topology = readJsonFile(path.join(root, 'specs', 'topology.spec.json'));
  if (!topology || topology.schemaVersion !== 5) {
    return issues;
  }
  const architectures = declaredClientArchitectures(topology);
  if (!ADAPTIVE_ARCHITECTURES.every((architecture) => architectures.has(architecture))) {
    return issues;
  }
  const profiles = topology.orchestration?.profiles ?? {};
  const standalone = profiles['standalone.development'];
  if (standalone) {
    checkAdaptiveDelivery(root, 'standalone.development', standalone, issues);
  }
  const cloudDevelopment = profiles['cloud.development'];
  if (cloudDevelopment && declaresAdaptivePair(cloudDevelopment)) {
    checkAdaptiveDelivery(root, 'cloud.development', cloudDevelopment, issues);
  }
  if (issues.length === 0) {
    checkBrowserHookRetirement(root, issues);
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', default: '.' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/check-adaptive-web-standard.mjs --root <deployable-root>');
    return;
  }
  const root = path.resolve(values.root);
  const issues = checkAdaptiveWebStandard(root);
  if (issues.length > 0) {
    console.error(`adaptive web standard failed for ${root}`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
    return;
  }
  console.log(`adaptive web standard passed for ${root}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
