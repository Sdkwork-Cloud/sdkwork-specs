import fs from 'node:fs';
import path from 'node:path';

export function loadProfileEnv(repoRoot, topology, profileId) {
  const envRel = topology?.profileFiles?.[profileId];
  if (!envRel) {
    return {};
  }
  const envPath = path.join(repoRoot, envRel);
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export function normalizeUpstream(bind) {
  if (typeof bind !== 'string' || !bind) {
    return null;
  }
  let normalized = bind;
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }
  // Bind addresses use 0.0.0.0; Nginx upstream targets must use loopback.
  return normalized.replace(/^http:\/\/0\.0\.0\.0:/, 'http://127.0.0.1:');
}

export function resolveSurfaceBind(topology, profileEnv, surfaceId, overrides = {}) {
  const overrideUpstreams = overrides?.proxy?.upstreams ?? {};
  if (overrideUpstreams[surfaceId]) {
    return normalizeUpstream(overrideUpstreams[surfaceId]);
  }

  const surface = topology?.surfaces?.[surfaceId];
  if (!surface?.bindEnv) {
    return null;
  }

  if (profileEnv[surface.bindEnv]) {
    return normalizeUpstream(profileEnv[surface.bindEnv]);
  }

  if (surfaceId === 'application.public-ingress' && overrides?.proxy?.bind) {
    return normalizeUpstream(overrides.proxy.bind);
  }

  if (topology?.defaults?.gatewayBind) {
    return normalizeUpstream(topology.defaults.gatewayBind);
  }

  return null;
}

export function resolveDomainSurfaceId(topology, domain) {
  const normalized = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
  for (const [surfaceId, config] of Object.entries(topology?.cloudPublicHosts ?? {})) {
    const host = config?.httpHost;
    if (typeof host === 'string' && host.trim().toLowerCase() === normalized) {
      return surfaceId;
    }
  }
  return 'application.public-ingress';
}
