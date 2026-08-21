#!/usr/bin/env node
/**
 * Batch-align Adaptive Web for modules that ship both apps/*-pc and apps/*-h5:
 * one WEB_DEV_INGRESS_BIND + private PC/H5 INTERNAL ports + adaptive delivery.
 *
 * Usage:
 *   node tools/align-adaptive-web-modules.mjs [--root <module>] [--write]
 *   node tools/align-adaptive-web-modules.mjs --workspace <workspace> [--write]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { checkAdaptiveWebStandard } from './check-adaptive-web-standard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function upsertEnvKey(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'mu');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.replace(/\s*$/u, '')}\n${line}\n`;
}

function removeEnvKey(content, key) {
  return content.replace(new RegExp(`^${key}=.*\\r?\\n?`, 'gmu'), '');
}

function detectFsPair(root) {
  const appsDir = path.join(root, 'apps');
  if (!fs.existsSync(appsDir)) {
    return null;
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
      return {
        stem,
        code: stem.replace(/^sdkwork-/u, ''),
        pcRoot: `apps/${name}`,
        h5Root: `apps/${h5Name}`,
      };
    }
  }
  return null;
}

function envPrefix(topology, pair) {
  const code = String(topology.applicationCode || pair.code || 'app')
    .replace(/[^a-z0-9]+/giu, '_')
    .replace(/^_+|_+$/gu, '')
    .toUpperCase();
  return `SDKWORK_${code}`;
}

function hashPortBase(code) {
  let hash = 0;
  for (const char of code) {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  }
  return 4200 + (hash % 1500);
}

function pickRendererScript(appRootAbs) {
  return pickNamedScript(appRootAbs, [
    '_sdkwork:dev:standalone',
    'dev:standalone',
    'dev',
  ]);
}

function pickNamedScript(appRootAbs, candidates) {
  const manifest = readJson(path.join(appRootAbs, 'package.json'));
  const scripts = manifest.scripts ?? {};
  for (const candidate of candidates) {
    if (scripts[candidate]) {
      return candidate;
    }
  }
  return null;
}

function adaptiveDelivery({ pair, prefix, pcPort, h5Port, pcScript, h5Script }) {
  const pcRenderer = pcScript
    ? {
        applicationRoot: pair.pcRoot,
        script: pcScript,
        defaultPort: pcPort,
        portEnv: `${prefix}_PC_INTERNAL_DEV_PORT`,
        env: {},
      }
    : {
        applicationRoot: pair.pcRoot,
        command: 'pnpm',
        args: ['exec', 'vite', '--host', '{host}', '--port', '{port}', '--strictPort'],
        defaultPort: pcPort,
        portEnv: `${prefix}_PC_INTERNAL_DEV_PORT`,
        env: {},
      };
  const h5Renderer = h5Script
    ? {
        applicationRoot: pair.h5Root,
        script: h5Script,
        defaultPort: h5Port,
        portEnv: `${prefix}_H5_INTERNAL_DEV_PORT`,
        env: {},
      }
    : {
        applicationRoot: pair.h5Root,
        command: 'pnpm',
        args: ['exec', 'vite', '--host', '{host}', '--port', '{port}', '--strictPort'],
        defaultPort: h5Port,
        portEnv: `${prefix}_H5_INTERNAL_DEV_PORT`,
        env: {},
      };
  return {
    id: `${pair.code}-adaptive-web`,
    applicationRoot: pair.pcRoot,
    clientArchitectures: ['pc-web', 'h5'],
    originMode: 'same-origin',
    deliveryMode: 'dev-server-proxy',
    clientProcessId: `${pair.code}-browser`,
    apiSurfaceId: 'application.public-ingress',
    preserveCanonicalPaths: true,
    tabletArchitecture: 'pc-web',
    renderers: {
      'pc-web': pcRenderer,
      h5: h5Renderer,
    },
  };
}

function isBrowserClientProcess(processEntry) {
  if (processEntry.role !== 'client') {
    return false;
  }
  const arches = processEntry.clientArchitectures ?? [];
  const targets = processEntry.runtimeTargets ?? [];
  if (arches.some((architecture) => architecture === 'pc-web' || architecture === 'h5')) {
    return true;
  }
  if (targets.includes('browser') && arches.length === 0) {
    return true;
  }
  if (!arches.length && !targets.length && (
    /browser|pc|h5|renderer/iu.test(processEntry.id ?? '')
    || processEntry.script === 'vite'
  )) {
    return true;
  }
  return false;
}

function migrateProfile(profile, {
  pair,
  prefix,
  pcPort,
  h5Port,
  pcScript,
  h5Script,
  required,
}) {
  const processes = [];
  let inserted = false;
  for (const processEntry of profile.processes ?? []) {
    if (isBrowserClientProcess(processEntry)) {
      if (!inserted) {
        processes.push({
          id: `${pair.code}-browser`,
          role: 'client',
          applicationRoot: pair.pcRoot,
          bindEnv: `${prefix}_WEB_DEV_INGRESS_BIND`,
          runtimeTargets: ['browser'],
          clientArchitectures: ['pc-web', 'h5'],
          required,
        });
        inserted = true;
      }
      continue;
    }
    processes.push(processEntry);
  }
  if (!inserted) {
    processes.push({
      id: `${pair.code}-browser`,
      role: 'client',
      applicationRoot: pair.pcRoot,
      bindEnv: `${prefix}_WEB_DEV_INGRESS_BIND`,
      runtimeTargets: ['browser'],
      clientArchitectures: ['pc-web', 'h5'],
      required,
    });
  }
  return {
    ...profile,
    processes,
    browserDeliveries: [
      adaptiveDelivery({
        pair,
        prefix,
        pcPort,
        h5Port,
        pcScript,
        h5Script,
      }),
    ],
  };
}

function migrateEnvFiles(root, prefix, ingressBind, pcPort, h5Port) {
  const topologyDir = path.join(root, 'etc', 'topology');
  if (!fs.existsSync(topologyDir)) {
    return;
  }
  for (const name of fs.readdirSync(topologyDir)) {
    if (!name.endsWith('.env')) {
      continue;
    }
    if (!/(development|test)\.env$/u.test(name)) {
      continue;
    }
    const envPath = path.join(topologyDir, name);
    let content = fs.readFileSync(envPath, 'utf8');
    const existingPc = content.match(new RegExp(`^${prefix}_PC_DEV_BIND=(.*)$`, 'mu'))?.[1]?.trim();
    const existingIngress = content.match(new RegExp(`^${prefix}_WEB_DEV_INGRESS_BIND=(.*)$`, 'mu'))?.[1]?.trim();
    const bind = existingIngress || existingPc || ingressBind;
    content = upsertEnvKey(content, `${prefix}_WEB_DEV_INGRESS_BIND`, bind);
    content = upsertEnvKey(content, `${prefix}_PC_INTERNAL_DEV_PORT`, String(pcPort));
    content = upsertEnvKey(content, `${prefix}_H5_INTERNAL_DEV_PORT`, String(h5Port));
    content = removeEnvKey(content, `${prefix}_H5_DEV_BIND`);
    // Keep PC_DEV_BIND only when still referenced by non-browser clients; retire for adaptive modules.
    content = removeEnvKey(content, `${prefix}_PC_DEV_BIND`);
    fs.writeFileSync(envPath, content, 'utf8');
  }
}

function retireRootBrowserHooks(root) {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return;
  }
  const manifest = readJson(packagePath);
  let changed = false;
  for (const key of Object.keys(manifest.scripts ?? {})) {
    if (/^_sdkwork:client:(?:browser|h5)(?::|$)/u.test(key)) {
      delete manifest.scripts[key];
      changed = true;
    }
  }
  if (changed) {
    writeJson(packagePath, manifest);
  }
}

function alignModule(root, { write }) {
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  if (!fs.existsSync(topologyPath)) {
    return { root, skipped: true, reason: 'no topology' };
  }
  const topology = readJson(topologyPath);
  if (topology.schemaVersion !== 5) {
    return { root, skipped: true, reason: 'topology schemaVersion != 5' };
  }
  const pair = detectFsPair(root);
  if (!pair) {
    return { root, skipped: true, reason: 'no pc+h5 pair' };
  }
  const before = checkAdaptiveWebStandard(root);
  if (before.length === 0) {
    return { root, skipped: true, reason: 'already compliant' };
  }
  if (!write) {
    return { root, skipped: false, dryRun: true, issues: before };
  }

  const prefix = envPrefix(topology, pair);
  const base = hashPortBase(pair.code);
  const ingressPort = base;
  const pcPort = base + 2;
  const h5Port = base + 3;
  const pcScript = pickRendererScript(path.join(root, pair.pcRoot));
  const h5Script = pickRendererScript(path.join(root, pair.h5Root));
  const profiles = topology.orchestration?.profiles ?? {};
  for (const profileId of ['standalone.development', 'cloud.development', 'standalone.test', 'cloud.test']) {
    if (!profiles[profileId]) {
      continue;
    }
    const cloud = profileId.includes('cloud');
    const profilePcScript = cloud
      ? (pickNamedScript(path.join(root, pair.pcRoot), ['_sdkwork:dev:cloud', 'dev:cloud']) || pcScript)
      : pcScript;
    const profileH5Script = cloud
      ? (pickNamedScript(path.join(root, pair.h5Root), ['_sdkwork:dev:cloud', 'dev:cloud']) || h5Script)
      : h5Script;
    profiles[profileId] = migrateProfile(profiles[profileId], {
      pair,
      prefix,
      pcPort,
      h5Port,
      pcScript: profilePcScript,
      h5Script: profileH5Script,
      required: true,
    });
  }
  writeJson(topologyPath, topology);
  migrateEnvFiles(root, prefix, `127.0.0.1:${ingressPort}`, pcPort, h5Port);
  retireRootBrowserHooks(root);
  const after = checkAdaptiveWebStandard(root);
  return { root, skipped: false, written: true, before, after };
}

function discoverModules(workspace) {
  return fs.readdirSync(workspace, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspace, entry.name))
    .filter((root) => fs.existsSync(path.join(root, 'specs', 'topology.spec.json')));
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string' },
      workspace: { type: 'string' },
      write: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/align-adaptive-web-modules.mjs (--root <module>|--workspace <dir>) [--write]');
    return;
  }
  const roots = values.root
    ? [path.resolve(values.root)]
    : discoverModules(path.resolve(values.workspace || path.join(__dirname, '../..')));
  let failed = 0;
  for (const root of roots) {
    const result = alignModule(root, { write: values.write });
    const name = path.basename(root);
    if (result.skipped) {
      console.log(`skip ${name}: ${result.reason}`);
      continue;
    }
    if (result.dryRun) {
      console.log(`dry-run ${name}: ${result.issues.length} issue(s)`);
      result.issues.forEach((issue) => console.log(`  - ${issue}`));
      continue;
    }
    if (result.after.length > 0) {
      failed += 1;
      console.error(`align incomplete ${name}`);
      result.after.forEach((issue) => console.error(`  - ${issue}`));
    } else {
      console.log(`aligned ${name}`);
    }
  }
  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
