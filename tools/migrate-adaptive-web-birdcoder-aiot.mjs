#!/usr/bin/env node
/**
 * One-shot Adaptive Web migration for birdcoder + aiot:
 * one browser-visible WEB_DEV_INGRESS + private PC/H5 INTERNAL ports.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const WORKSPACE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

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
  const trimmed = content.replace(/\s*$/u, '');
  return `${trimmed}\n${line}\n`;
}

function removeEnvKey(content, key) {
  return content.replace(new RegExp(`^${key}=.*\\r?\\n?`, 'gmu'), '');
}

function birdcoderAdaptiveDelivery({ profileScriptSuffix }) {
  const pcScript = profileScriptSuffix === 'cloud' ? 'cloud' : 'standalone';
  void pcScript;
  return {
    id: 'birdcoder-adaptive-web',
    applicationRoot: 'apps/sdkwork-birdcoder-pc',
    clientArchitectures: ['pc-web', 'h5'],
    originMode: 'same-origin',
    deliveryMode: 'dev-server-proxy',
    clientProcessId: 'birdcoder-browser',
    apiSurfaceId: 'application.public-ingress',
    preserveCanonicalPaths: true,
    tabletArchitecture: 'pc-web',
    renderers: {
      'pc-web': {
        applicationRoot: 'apps/sdkwork-birdcoder-pc/packages/sdkwork-birdcoder-pc-web',
        command: 'node',
        args: [
          '../../../../scripts/run-vite-host.mjs',
          'serve',
          '--mode',
          'development',
          '--host',
          '{host}',
          '--port',
          '{port}',
          '--strictPort',
        ],
        defaultPort: 5175,
        portEnv: 'SDKWORK_BIRDCODER_PC_INTERNAL_DEV_PORT',
        env: {
          SDKWORK_BIRDCODER_RUNTIME_TARGET: 'browser',
          VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET: 'browser',
          VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: '{httpOrigin}',
        },
      },
      h5: {
        applicationRoot: 'apps/sdkwork-birdcoder-h5',
        command: 'node',
        args: [
          '../../scripts/run-vite-host.mjs',
          'serve',
          '--mode',
          'development',
          '--host',
          '{host}',
          '--port',
          '{port}',
          '--strictPort',
        ],
        defaultPort: 5176,
        portEnv: 'SDKWORK_BIRDCODER_H5_INTERNAL_DEV_PORT',
        env: {
          SDKWORK_BIRDCODER_RUNTIME_TARGET: 'browser',
          VITE_SDKWORK_BIRDCODER_RUNTIME_TARGET: 'browser',
          VITE_SDKWORK_RUNTIME_TARGET: 'h5',
          VITE_SDKWORK_BIRDCODER_APPLICATION_PUBLIC_HTTP_URL: '{httpOrigin}',
        },
      },
    },
  };
}

function migrateBirdcoderProfile(profile, profileId) {
  if (!profile?.processes) {
    return profile;
  }
  const isDev = profileId === 'standalone.development' || profileId === 'cloud.development';
  if (!isDev) {
    return profile;
  }

  const nextProcesses = [];
  let insertedBrowser = false;
  for (const processEntry of profile.processes) {
    if (
      processEntry.id === 'pc-web-renderer'
      || processEntry.id === 'h5-browser-renderer'
    ) {
      if (!insertedBrowser) {
        nextProcesses.push({
          id: 'birdcoder-browser',
          role: 'client',
          applicationRoot: 'apps/sdkwork-birdcoder-pc',
          bindEnv: 'SDKWORK_BIRDCODER_WEB_DEV_INGRESS_BIND',
          runtimeTargets: ['browser'],
          clientArchitectures: ['pc-web', 'h5'],
          required: true,
        });
        insertedBrowser = true;
      }
      continue;
    }
    if (
      processEntry.bindEnv === 'SDKWORK_BIRDCODER_PC_DEV_BIND'
      && (processEntry.id === 'h5-capacitor-renderer'
        || processEntry.id === 'pc-web-test-runner')
    ) {
      nextProcesses.push({
        ...processEntry,
        bindEnv: 'SDKWORK_BIRDCODER_WEB_DEV_INGRESS_BIND',
      });
      continue;
    }
    nextProcesses.push(processEntry);
  }

  return {
    ...profile,
    processes: nextProcesses,
    browserDeliveries: [birdcoderAdaptiveDelivery({ profileScriptSuffix: profileId.split('.')[0] })],
  };
}

function migrateBirdcoder() {
  const root = path.join(WORKSPACE, 'sdkwork-birdcoder');
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = readJson(topologyPath);
  const profiles = topology.orchestration?.profiles ?? {};
  for (const profileId of Object.keys(profiles)) {
    profiles[profileId] = migrateBirdcoderProfile(profiles[profileId], profileId);
  }
  writeJson(topologyPath, topology);

  for (const relative of [
    'etc/topology/standalone.development.env',
    'etc/topology/cloud.development.env',
  ]) {
    const envPath = path.join(root, relative);
    let content = fs.readFileSync(envPath, 'utf8');
    const previous = content.match(/^SDKWORK_BIRDCODER_PC_DEV_BIND=(.*)$/mu)?.[1]?.trim()
      || '127.0.0.1:5173';
    content = upsertEnvKey(content, 'SDKWORK_BIRDCODER_WEB_DEV_INGRESS_BIND', previous);
    content = upsertEnvKey(content, 'SDKWORK_BIRDCODER_PC_INTERNAL_DEV_PORT', '5175');
    content = upsertEnvKey(content, 'SDKWORK_BIRDCODER_H5_INTERNAL_DEV_PORT', '5176');
    content = removeEnvKey(content, 'SDKWORK_BIRDCODER_PC_DEV_BIND');
    content = content.replaceAll(
      'http://127.0.0.1:5173',
      `http://${previous.replace(/^([^:]+):(\d+)$/u, '$1:$2')}`,
    );
    // Keep ALLOWED_ORIGINS pointing at the unified ingress (already 5173).
    fs.writeFileSync(envPath, content, 'utf8');
  }
  console.log('migrated sdkwork-birdcoder adaptive web');
}

function aiotAdaptiveDelivery({ scriptSuffix }) {
  return {
    id: 'aiot-adaptive-web',
    applicationRoot: 'apps/sdkwork-aiot-pc',
    clientArchitectures: ['pc-web', 'h5'],
    originMode: 'same-origin',
    deliveryMode: 'dev-server-proxy',
    clientProcessId: 'aiot-browser',
    apiSurfaceId: 'application.public-ingress',
    preserveCanonicalPaths: true,
    tabletArchitecture: 'pc-web',
    renderers: {
      'pc-web': {
        applicationRoot: 'apps/sdkwork-aiot-pc',
        command: 'pnpm',
        args: ['exec', 'vite', '--host', '{host}', '--port', '{port}', '--strictPort'],
        defaultPort: 5175,
        portEnv: 'SDKWORK_AIOT_PC_INTERNAL_DEV_PORT',
        env: {
          VITE_SDKWORK_AIOT_APPLICATION_PUBLIC_HTTP_URL: '{httpOrigin}',
        },
      },
      h5: {
        applicationRoot: 'apps/sdkwork-aiot-h5',
        command: 'pnpm',
        args: ['exec', 'vite', '--host', '{host}', '--port', '{port}', '--strictPort'],
        defaultPort: 5176,
        portEnv: 'SDKWORK_AIOT_H5_INTERNAL_DEV_PORT',
        env: {
          VITE_SDKWORK_AIOT_APPLICATION_PUBLIC_HTTP_URL: '{httpOrigin}',
        },
      },
    },
  };
}

function migrateAiotProfile(profile, profileId) {
  if (!profile?.processes) {
    return profile;
  }
  const adaptiveProfiles = new Set([
    'standalone.development',
    'cloud.development',
    'standalone.test',
    'cloud.test',
  ]);
  if (!adaptiveProfiles.has(profileId)) {
    return profile;
  }

  const nextProcesses = [];
  let insertedBrowser = false;
  for (const processEntry of profile.processes) {
    if (processEntry.id === 'aiot-pc-web' || processEntry.id === 'aiot-h5') {
      if (!insertedBrowser) {
        nextProcesses.push({
          id: 'aiot-browser',
          role: 'client',
          applicationRoot: 'apps/sdkwork-aiot-pc',
          bindEnv: 'SDKWORK_AIOT_WEB_DEV_INGRESS_BIND',
          runtimeTargets: ['browser'],
          clientArchitectures: ['pc-web', 'h5'],
          required: true,
        });
        insertedBrowser = true;
      }
      continue;
    }
    nextProcesses.push(processEntry);
  }

  return {
    ...profile,
    processes: nextProcesses,
    browserDeliveries: [aiotAdaptiveDelivery({ scriptSuffix: profileId })],
  };
}

function migrateAiot() {
  const root = path.join(WORKSPACE, 'sdkwork-aiot');
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  const topology = readJson(topologyPath);
  const profiles = topology.orchestration?.profiles ?? {};
  for (const profileId of Object.keys(profiles)) {
    profiles[profileId] = migrateAiotProfile(profiles[profileId], profileId);
  }
  writeJson(topologyPath, topology);

  for (const relative of [
    'etc/topology/standalone.development.env',
    'etc/topology/cloud.development.env',
    'etc/topology/standalone.test.env',
    'etc/topology/cloud.test.env',
  ]) {
    const envPath = path.join(root, relative);
    if (!fs.existsSync(envPath)) {
      continue;
    }
    let content = fs.readFileSync(envPath, 'utf8');
    const isCloud = relative.includes('cloud.');
    const ingress = isCloud ? '127.0.0.1:5174' : '127.0.0.1:5174';
    content = upsertEnvKey(content, 'SDKWORK_AIOT_WEB_DEV_INGRESS_BIND', ingress);
    content = upsertEnvKey(content, 'SDKWORK_AIOT_PC_INTERNAL_DEV_PORT', '5175');
    content = upsertEnvKey(content, 'SDKWORK_AIOT_H5_INTERNAL_DEV_PORT', '5176');
    fs.writeFileSync(envPath, content, 'utf8');
  }

  const packagePath = path.join(root, 'package.json');
  const manifest = readJson(packagePath);
  for (const key of Object.keys(manifest.scripts ?? {})) {
    if (/^_sdkwork:client:(browser|h5)(?::|$)/u.test(key)) {
      delete manifest.scripts[key];
    }
  }
  writeJson(packagePath, manifest);

  // Drop hard-coded ports from app private hooks; Adaptive Web owns ports.
  for (const app of ['sdkwork-aiot-pc', 'sdkwork-aiot-h5']) {
    const appPackagePath = path.join(root, 'apps', app, 'package.json');
    if (!fs.existsSync(appPackagePath)) {
      continue;
    }
    const appManifest = readJson(appPackagePath);
    if (appManifest.scripts?.['_sdkwork:client:browser']) {
      delete appManifest.scripts['_sdkwork:client:browser'];
    }
    if (appManifest.scripts?.['_sdkwork:client:h5']) {
      delete appManifest.scripts['_sdkwork:client:h5'];
    }
    writeJson(appPackagePath, appManifest);
  }
  console.log('migrated sdkwork-aiot adaptive web');
}

migrateBirdcoder();
migrateAiot();
console.log('done');
