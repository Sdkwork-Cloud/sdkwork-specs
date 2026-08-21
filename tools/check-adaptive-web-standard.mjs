#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// APP_RUNTIME_TOPOLOGY_SPEC.md §8.2 / APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md §2.1:
// repositories that expose both pc-web and h5 (topology or filesystem pair)
// MUST use adaptive browser delivery (one WEB_DEV_INGRESS + PC/H5 renderers)
// and MUST NOT keep private root `_sdkwork:client:browser:*` / `:h5:*` hooks.
const ADAPTIVE_ARCHITECTURES = Object.freeze(['pc-web', 'h5']);
const BROWSER_HOOK_PATTERN = /^_sdkwork:client:(?:browser|h5)(?::|$)/u;
const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]+$/u;
const PUBLIC_PC_BIND_PATTERN = /^SDKWORK_[A-Z0-9_]+_PC_DEV_BIND$/u;
const PUBLIC_H5_BIND_PATTERN = /^SDKWORK_[A-Z0-9_]+_H5_DEV_BIND$/u;
const WEB_INGRESS_BIND_PATTERN = /^SDKWORK_[A-Z0-9_]+_WEB_DEV_INGRESS_BIND$/u;

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listEnvFiles(root) {
  const topologyDir = path.join(root, 'etc', 'topology');
  if (!fs.existsSync(topologyDir)) {
    return [];
  }
  return fs.readdirSync(topologyDir)
    .filter((name) => name.endsWith('.env'))
    .map((name) => path.join(topologyDir, name));
}

function parseEnvKeys(filePath) {
  const keys = new Set();
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/u)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)=/u.exec(line);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function filesystemAdaptivePair(root) {
  const appsDir = path.join(root, 'apps');
  if (!fs.existsSync(appsDir)) {
    return false;
  }
  const names = fs.readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const name of names) {
    if (!name.startsWith('sdkwork-') || !name.endsWith('-pc')) {
      continue;
    }
    const stem = name.slice(0, -'-pc'.length);
    const h5Name = `${stem}-h5`;
    if (!names.includes(h5Name)) {
      continue;
    }
    if (
      fs.existsSync(path.join(appsDir, name, 'package.json'))
      && fs.existsSync(path.join(appsDir, h5Name, 'package.json'))
    ) {
      return { pcRoot: `apps/${name}`, h5Root: `apps/${h5Name}`, stem };
    }
  }
  return null;
}

function declaredClientArchitectures(topology) {
  const architectures = new Set();
  for (const profile of Object.values(topology.orchestration?.profiles ?? {})) {
    for (const processEntry of profile.processes ?? []) {
      if (processEntry.role === 'client') {
        for (const architecture of processEntry.clientArchitectures ?? []) {
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
  for (const processEntry of profile.processes ?? []) {
    if (processEntry.role !== 'client') continue;
    for (const architecture of processEntry.clientArchitectures ?? []) {
      architectures.add(architecture);
    }
  }
  return ADAPTIVE_ARCHITECTURES.every((architecture) => architectures.has(architecture));
}

function rendererInvocationPresent(renderer) {
  return Boolean(renderer.command || renderer.script || renderer.crate
    || (renderer.package && renderer.script));
}

function checkAdaptiveDelivery(root, profileId, profile, issues) {
  const deliveries = (profile.browserDeliveries ?? [])
    .filter((delivery) => delivery.deliveryMode === 'dev-server-proxy');
  if (deliveries.length === 0) {
    issues.push(`${profileId} must declare a dev-server-proxy browser delivery for adaptive PC/H5 access`);
    return;
  }
  const clientProcesses = new Map(
    (profile.processes ?? [])
      .filter((processEntry) => processEntry.role === 'client')
      .map((processEntry) => [processEntry.id, processEntry]),
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
  } else if (!WEB_INGRESS_BIND_PATTERN.test(clientProcess.bindEnv)
    && !/_WEB_DEV_INGRESS_BIND$/u.test(clientProcess.bindEnv)) {
    issues.push(
      `${profileId} adaptive client ${clientProcess.id} bindEnv should be SDKWORK_*_WEB_DEV_INGRESS_BIND (got ${clientProcess.bindEnv})`,
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
    if (renderer.portEnv && !/_INTERNAL_DEV_PORT$/u.test(renderer.portEnv)) {
      issues.push(
        `${rendererLabel} portEnv should be a private *_INTERNAL_DEV_PORT (got ${renderer.portEnv})`,
      );
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

function checkDualPublicBinds(root, issues) {
  for (const envFile of listEnvFiles(root)) {
    const keys = parseEnvKeys(envFile);
    const pcBinds = [...keys].filter((key) => PUBLIC_PC_BIND_PATTERN.test(key));
    const h5Binds = [...keys].filter((key) => PUBLIC_H5_BIND_PATTERN.test(key));
    if (pcBinds.length > 0 && h5Binds.length > 0) {
      issues.push(
        `${path.relative(root, envFile)} declares both public ${pcBinds.join(', ')} and ${h5Binds.join(', ')}; Adaptive Web uses one WEB_DEV_INGRESS_BIND plus private INTERNAL ports`,
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
  const applicationCode = topology.applicationCode
    || String(topology.appId ?? '').replace(/^sdkwork-/u, '');
  const architectures = declaredClientArchitectures(topology);
  const fsPair = filesystemAdaptivePair(root);
  const requiresAdaptive = ADAPTIVE_ARCHITECTURES.every((architecture) => architectures.has(architecture))
    || Boolean(fsPair);
  if (!requiresAdaptive) {
    return issues;
  }
  if (!ADAPTIVE_ARCHITECTURES.every((architecture) => architectures.has(architecture))) {
    issues.push(
      `${fsPair.pcRoot} and ${fsPair.h5Root} exist but topology does not declare both pc-web and h5 client architectures for Adaptive Web`,
    );
  }
  const profiles = topology.orchestration?.profiles ?? {};
  const standalone = profiles['standalone.development'];
  if (standalone) {
    checkAdaptiveDelivery(root, 'standalone.development', standalone, issues);
  } else if (fsPair) {
    issues.push('standalone.development must declare Adaptive Web when PC and H5 application roots exist');
  }
  const cloudDevelopment = profiles['cloud.development'];
  if (cloudDevelopment && (
    declaresAdaptivePair(cloudDevelopment)
    || Boolean(fsPair)
  )) {
    checkAdaptiveDelivery(root, 'cloud.development', cloudDevelopment, issues);
  }
  checkDualPublicBinds(root, issues);
  if (issues.length === 0) {
    checkBrowserHookRetirement(root, issues);
  } else {
    // Still surface retired hooks alongside topology failures.
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
