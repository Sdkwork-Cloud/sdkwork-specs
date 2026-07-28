#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const CLOUD_FORBIDDEN_ROLES = [
  'api-standalone-gateway',
  'edge-runtime', 'database', 'redis', 'migration', 'seed', 'worker',
];
const GATEWAY_ROLES = new Set([
  'api-standalone-gateway',
]);
const DATA_STORE_ROLES = new Set(['database', 'redis']);
const PROCESS_ROLES = new Set([
  'client', 'api-standalone-gateway',
  'edge-runtime', 'database', 'redis', 'migration', 'seed', 'worker', 'tunnel',
]);
const CLIENT_ARCHITECTURES = new Set([
  'pc-web', 'h5', 'capacitor', 'flutter', 'tauri', 'electron',
  'android-native', 'ios-native', 'harmony-native', 'mini-program',
]);
const DEFAULT_CLIENT_ARCHITECTURES = Object.freeze({
  browser: 'pc-web',
  desktop: 'tauri',
  'capacitor-ios': 'capacitor',
  'capacitor-android': 'capacitor',
  'flutter-ios': 'flutter',
  'flutter-android': 'flutter',
  'android-native': 'android-native',
  'ios-native': 'ios-native',
  'harmony-native': 'harmony-native',
  'mini-program': 'mini-program',
});

function readEnv(file) {
  const values = new Map();
  if (!fs.existsSync(file)) return values;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) continue;
    values.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/u, '$2'));
  }
  return values;
}

function isRemoteUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

function urlOrigin(value, label) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
    return url.origin;
  } catch {
    throw new Error(`${label} must resolve to an absolute HTTP(S) URL`);
  }
}

function browserOriginFromBind(value, label) {
  const binding = String(value ?? '').trim();
  const bracketed = /^\[([^\]]+)\]:(\d+)$/u.exec(binding);
  const plain = /^([^:]+):(\d+)$/u.exec(binding);
  const match = bracketed ?? plain;
  if (!match) throw new Error(`${label} must resolve to <host>:<port>`);
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must resolve to a valid TCP port`);
  }
  const rawHost = match[1];
  const host = ['0.0.0.0', '::'].includes(rawHost) ? '127.0.0.1' : rawHost;
  const formattedHost = host.includes(':') ? `[${host}]` : host;
  return `http://${formattedHost}:${port}`;
}

function sameStringSet(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value) => right.includes(value));
}

function resolveBrowserDeliveries({
  activeProfile,
  profile,
  processes,
  env,
  resolvedBaseUrls,
  clientArchitecture,
}) {
  const ids = new Set();
  const declared = profile.browserDeliveries ?? [];
  for (const delivery of declared) {
    if (!/^[a-z0-9][a-z0-9.-]*$/u.test(String(delivery.id ?? ''))) {
      throw new Error(`${activeProfile} browser delivery ids must use lowercase dot/kebab tokens`);
    }
    if (ids.has(delivery.id)) {
      throw new Error(`${activeProfile} contains duplicate browser delivery ${delivery.id}`);
    }
    ids.add(delivery.id);
    if (!Array.isArray(delivery.clientArchitectures)
      || delivery.clientArchitectures.length === 0
      || new Set(delivery.clientArchitectures).size !== delivery.clientArchitectures.length
      || delivery.clientArchitectures.some((value) => !CLIENT_ARCHITECTURES.has(value))) {
      throw new Error(`${activeProfile} browser delivery ${delivery.id} requires canonical clientArchitectures`);
    }
  }
  return declared
    .filter((delivery) => (
      !clientArchitecture || delivery.clientArchitectures.includes(clientArchitecture)
    ))
    .map((delivery) => {
      if (delivery.originMode !== 'same-origin') {
        throw new Error(`${activeProfile} browser delivery ${delivery.id} must use originMode same-origin`);
      }
      if (delivery.apiSurfaceId !== 'application.public-ingress') {
        throw new Error(`${activeProfile} browser delivery ${delivery.id} must target application.public-ingress`);
      }
      if (activeProfile === 'standalone.development'
        && delivery.deliveryMode !== 'dev-server-proxy') {
        throw new Error(`${activeProfile} browser delivery ${delivery.id} must use dev-server-proxy`);
      }
      if (activeProfile === 'standalone.production'
        && delivery.deliveryMode !== 'gateway-static') {
        throw new Error(`${activeProfile} browser delivery ${delivery.id} must use gateway-static`);
      }
      const apiTarget = resolvedBaseUrls[delivery.apiSurfaceId];
      if (!apiTarget) {
        throw new Error(`${activeProfile} browser delivery ${delivery.id} cannot resolve ${delivery.apiSurfaceId}`);
      }
      const apiTargetOrigin = urlOrigin(
        apiTarget,
        `${activeProfile} browser delivery ${delivery.id} API target`,
      );

    if (delivery.deliveryMode === 'dev-server-proxy') {
      assertAbsentFields(
        delivery,
        ['hostProcessId', 'buildOutput', 'runtimeRootEnv', 'mountPath', 'spaFallback'],
        `${activeProfile} browser delivery ${delivery.id} dev-server-proxy`,
      );
        const client = processes.find((process) => process.id === delivery.clientProcessId);
        if (!client || client.role !== 'client' || !client.bindEnv) {
          throw new Error(`${activeProfile} browser delivery ${delivery.id} requires a selected client process with bindEnv`);
        }
        if (!sameStringSet(delivery.clientArchitectures, client.clientArchitectures)) {
          throw new Error(`${activeProfile} browser delivery ${delivery.id} must match its client process architectures`);
        }
        if (delivery.preserveCanonicalPaths !== true) {
          throw new Error(`${activeProfile} browser delivery ${delivery.id} must preserve canonical API paths`);
        }
        const browserVisibleOrigin = browserOriginFromBind(
          env.get(client.bindEnv),
          `${activeProfile} ${client.bindEnv}`,
        );
        return {
          id: delivery.id,
          applicationRoot: delivery.applicationRoot,
          clientArchitectures: delivery.clientArchitectures,
          originMode: delivery.originMode,
          deliveryMode: delivery.deliveryMode,
          apiSurfaceId: delivery.apiSurfaceId,
          browserVisibleOrigin,
          apiTargetOrigin,
          clientProcessId: delivery.clientProcessId,
          preserveCanonicalPaths: true,
        };
      }

    if (delivery.deliveryMode === 'gateway-static') {
      assertAbsentFields(
        delivery,
        ['clientProcessId', 'preserveCanonicalPaths'],
        `${activeProfile} browser delivery ${delivery.id} gateway-static`,
      );
        const host = processes.find((process) => process.id === delivery.hostProcessId);
        if (!host || host.role !== 'api-standalone-gateway') {
          throw new Error(`${activeProfile} browser delivery ${delivery.id} requires an api-standalone-gateway host process`);
        }
        const runtimeRoot = env.get(delivery.runtimeRootEnv);
        if (!runtimeRoot) {
          throw new Error(`${activeProfile} browser delivery ${delivery.id} requires ${delivery.runtimeRootEnv}`);
        }
        if (delivery.mountPath !== '/' || delivery.spaFallback !== '/index.html') {
          throw new Error(`${activeProfile} browser delivery ${delivery.id} requires root mount and /index.html SPA fallback`);
        }
        return {
          id: delivery.id,
          applicationRoot: delivery.applicationRoot,
          clientArchitectures: delivery.clientArchitectures,
          originMode: delivery.originMode,
          deliveryMode: delivery.deliveryMode,
          apiSurfaceId: delivery.apiSurfaceId,
          browserVisibleOrigin: apiTargetOrigin,
          apiTargetOrigin,
          hostProcessId: delivery.hostProcessId,
          buildOutput: delivery.buildOutput,
          runtimeRootEnv: delivery.runtimeRootEnv,
          runtimeRoot,
          mountPath: '/',
          spaFallback: '/index.html',
        };
      }

      throw new Error(`${activeProfile} browser delivery ${delivery.id} uses an unsupported deliveryMode`);
    });
}

function assertAbsentFields(value, fields, label) {
  for (const field of fields) {
    if (value[field] !== undefined) {
      throw new Error(`${label} must not declare ${field}`);
    }
  }
}

export function resolveRuntimePlan(repoRoot, options) {
  const root = path.resolve(repoRoot);
  const topologyPath = path.join(root, options.spec ?? 'specs/topology.spec.json');
  const topology = JSON.parse(fs.readFileSync(topologyPath, 'utf8'));
  if (topology.schemaVersion !== 5) {
    throw new Error('resolved runtime plans require topology schemaVersion 5');
  }
  const activeProfile = `${options.deploymentProfile}.${options.environment}`;
  const profile = topology.orchestration?.profiles?.[activeProfile];
  if (!profile) throw new Error(`missing orchestration profile ${activeProfile}`);
  const envRelative = topology.profileFiles?.[activeProfile];
  if (!envRelative) throw new Error(`missing profileFiles entry ${activeProfile}`);
  const envPath = path.join(root, envRelative);
  if (!fs.existsSync(envPath)) throw new Error(`missing profile config ${envRelative}`);
  const env = readEnv(envPath);
  const profileProcesses = profile.processes ?? [];
  const invalidProcesses = profileProcesses.filter((process) => !PROCESS_ROLES.has(process.role));
  if (invalidProcesses.length > 0) {
    throw new Error(`${activeProfile} contains a process without a canonical role`);
  }
  const clientArchitecture = options.clientArchitecture
    ?? DEFAULT_CLIENT_ARCHITECTURES[options.runtimeTarget]
    ?? null;
  const processes = profileProcesses.filter((process) => (
    (!Array.isArray(process.runtimeTargets)
      || process.runtimeTargets.includes(options.runtimeTarget))
    && (!Array.isArray(process.clientArchitectures)
      || process.clientArchitectures.includes(clientArchitecture))
  ));

  const resolvedBaseUrls = {};
  const endpointProvenance = {};
  const remoteSurfaces = [];
  for (const [surfaceId, surface] of Object.entries(topology.surfaces ?? {})) {
    if (options.deploymentProfile === 'standalone' && surfaceId === 'platform.api-gateway') {
      for (const key of new Set([surface.httpUrlEnv, surface.clientHttpEnv].filter(Boolean))) {
        if (env.has(key)) {
          throw new Error(
            `${activeProfile} must not resolve ${key}; standalone dependency APIs are embedded in application.public-ingress`,
          );
        }
      }
      continue;
    }
    if (!surface.httpUrlEnv) continue;
    const value = env.get(surface.httpUrlEnv);
    if (!value) continue;
    resolvedBaseUrls[surfaceId] = value;
    endpointProvenance[surfaceId] = {
      source: envRelative,
      key: surface.httpUrlEnv,
    };
    if (isRemoteUrl(value)) remoteSurfaces.push(surfaceId);
  }

  const localGatewayProcesses = processes.filter((process) => GATEWAY_ROLES.has(process.role));
  const forbiddenProcesses = options.deploymentProfile === 'cloud' && options.environment === 'development'
    ? processes.filter((process) => CLOUD_FORBIDDEN_ROLES.includes(process.role)).map((process) => process.id)
    : [];
  if (options.deploymentProfile === 'standalone' && options.environment === 'development'
    && topology.surfaces?.['application.public-ingress']) {
    const gateways = processes.filter((process) => process.role === 'api-standalone-gateway');
    if (gateways.length !== 1) {
      throw new Error(`${activeProfile} requires exactly one api-standalone-gateway role`);
    }
  }
  if (options.deploymentProfile === 'cloud' && options.environment === 'development') {
    for (const surfaceId of ['application.public-ingress', 'platform.api-gateway']) {
      if (topology.surfaces?.[surfaceId]?.httpUrlEnv && !resolvedBaseUrls[surfaceId]) {
        throw new Error(`${activeProfile} requires an explicit URL for ${surfaceId}`);
      }
    }
  }
  const healthChecks = (profile.healthSurfaces ?? []).map((surfaceId) => ({
    surfaceId,
    url: resolvedBaseUrls[surfaceId] ?? null,
    required: true,
  }));

  return {
    schemaVersion: 1,
    kind: 'sdkwork.runtime-plan',
    appId: topology.appId,
    activeProfile,
    deploymentProfile: options.deploymentProfile,
    environment: options.environment,
    runtimeTarget: options.runtimeTarget,
    clientArchitecture,
    localProcesses: processes,
    localGateway: localGatewayProcesses.length === 1
      ? {
          id: localGatewayProcesses[0].id,
          role: localGatewayProcesses[0].role,
          binary: localGatewayProcesses[0].binary ?? localGatewayProcesses[0].crate ?? null,
        }
      : null,
    remoteSurfaces,
    resolvedBaseUrls,
    endpointProvenance,
    browserDeliveries: resolveBrowserDeliveries({
      activeProfile,
      profile,
      processes,
      env,
      resolvedBaseUrls,
      clientArchitecture,
    }),
    localDataStores: processes
      .filter((process) => DATA_STORE_ROLES.has(process.role))
      .map((process) => ({ id: process.id, role: process.role })),
    healthChecks,
    configSources: [
      path.relative(root, topologyPath).replaceAll('\\', '/'),
      envRelative.replaceAll('\\', '/'),
    ],
    forbiddenProcessRoles: options.deploymentProfile === 'cloud' && options.environment === 'development'
      ? CLOUD_FORBIDDEN_ROLES
      : [],
    forbiddenProcesses,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: '.' },
      spec: { type: 'string' },
      'deployment-profile': { type: 'string' },
      environment: { type: 'string' },
      'runtime-target': { type: 'string' },
      'client-architecture': { type: 'string' },
      json: { type: 'boolean', default: false },
    },
  });
  if (!['standalone', 'cloud'].includes(values['deployment-profile'])) {
    throw new Error('--deployment-profile must be standalone or cloud');
  }
  if (!values.environment) throw new Error('--environment is required');
  if (!values['runtime-target']) throw new Error('--runtime-target is required');
  const plan = resolveRuntimePlan(values.root, {
    spec: values.spec,
    deploymentProfile: values['deployment-profile'],
    environment: values.environment,
    runtimeTarget: values['runtime-target'],
    clientArchitecture: values['client-architecture'],
  });
  if (plan.forbiddenProcesses.length > 0) {
    throw new Error(`resolved plan contains forbidden cloud development processes: ${plan.forbiddenProcesses.join(', ')}`);
  }
  console.log(JSON.stringify(plan, null, values.json ? 2 : 0));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`runtime plan resolution failed: ${error.message}`);
    process.exitCode = 1;
  }
}
