import { DEFAULT_MOBILE_UA_REGEX } from './constants.mjs';
import { surfaceExists } from './identity.mjs';

export function normalizeWeb(web) {
  if (web === undefined || web === null) {
    return null;
  }
  if (web === 'adaptive' || web === 'auto') {
    return { kind: 'adaptive', surfaces: ['pc', 'h5'] };
  }
  if (typeof web === 'string') {
    return { kind: 'single', surfaces: [web] };
  }
  if (Array.isArray(web)) {
    if (web.length === 2 && web.includes('pc') && web.includes('h5')) {
      return { kind: 'adaptive', surfaces: ['pc', 'h5'] };
    }
    if (web.length === 1) {
      return { kind: 'single', surfaces: [web[0]] };
    }
    return { kind: 'multi', surfaces: web };
  }
  if (typeof web === 'object') {
    if (web.auto) {
      return { kind: 'adaptive', surfaces: web.auto };
    }
    if (web.default || web.mobile) {
      const surfaces = [];
      if (web.default) surfaces.push(web.default);
      if (web.mobile && web.mobile !== web.default) surfaces.push(web.mobile);
      return { kind: 'adaptive', surfaces: surfaces.length ? surfaces : ['pc', 'h5'] };
    }
  }
  throw new Error(`unsupported web value: ${JSON.stringify(web)}`);
}

export function resolveWebMode(repoRoot, appId, webSpec) {
  const normalized = normalizeWeb(webSpec);
  if (!normalized) {
    return { mode: null, surfaces: [], warnings: [] };
  }

  const surfaces = normalized.surfaces ?? ['pc', 'h5'];
  const pcExists = surfaceExists(repoRoot, appId, 'pc');
  const h5Exists = surfaceExists(repoRoot, appId, 'h5');

  if (normalized.kind === 'single') {
    const surface = surfaces[0];
    return {
      mode: `single-${surface}`,
      surfaces: [surface],
      warnings: surfaceExists(repoRoot, appId, surface)
        ? []
        : [`surface "${surface}" directory missing: apps/${appId}-${surface}/`],
    };
  }

  if (pcExists && h5Exists) {
    return { mode: 'adaptive', surfaces: ['pc', 'h5'], warnings: [] };
  }
  if (pcExists && !h5Exists) {
    return {
      mode: 'collapse-pc',
      surfaces: ['pc'],
      warnings: ['h5 surface missing; collapsing to pc for all clients'],
    };
  }
  if (!pcExists && h5Exists) {
    return {
      mode: 'collapse-h5',
      surfaces: ['h5'],
      warnings: ['pc surface missing; collapsing to h5 for all clients'],
    };
  }
  return {
    mode: null,
    surfaces: [],
    warnings: [],
    errors: [`no web surfaces found for appId ${appId}; expected apps/${appId}-pc/ or apps/${appId}-h5/`],
  };
}

export function mobileUaRegex(overrides = {}) {
  return overrides?.web?.mobileUaRegex ?? DEFAULT_MOBILE_UA_REGEX;
}

export function tabletSurface(overrides = {}) {
  const tablet = overrides?.web?.tablet ?? 'pc';
  return tablet === 'h5' ? 'h5' : 'pc';
}

function escapeNginxRegex(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

export function buildAdaptiveMapBlocks(appId, overrides = {}) {
  const mapBase = nginxMapVariable(appId);
  const mobileRegex = mobileUaRegex(overrides);
  const rules = Array.isArray(overrides?.web?.rules) ? overrides.web.rules : [];

  const uaLines = [];
  for (const rule of rules) {
    const surface = rule?.surface === 'h5' ? 'h5' : 'pc';
    if (typeof rule?.userAgentRegex === 'string' && rule.userAgentRegex.trim()) {
      uaLines.push(`    "~*${rule.userAgentRegex.trim()}" ${surface};`);
    } else if (typeof rule?.userAgent === 'string' && rule.userAgent.trim()) {
      uaLines.push(`    "~*${escapeNginxRegex(rule.userAgent.trim())}" ${surface};`);
    }
  }
  uaLines.push(`    "~*${mobileRegex}" h5;`);
  if (tabletSurface(overrides) === 'h5') {
    uaLines.push('    "~*iPad" h5;');
  }
  uaLines.push('    default pc;');

  return [
    `map $http_user_agent $${mapBase}_surface {\n${uaLines.join('\n')}\n}`,
    `map $http_sec_ch_ua_mobile $${mapBase}_mobile_ch {
    default "";
    "?1" "1";
}

map $${mapBase}_mobile_ch $${mapBase}_surface_final {
    default $${mapBase}_surface;
    "1" h5;
}`,
  ];
}

export function nginxMapVariable(appId) {
  return `sdkwork_${appId.replace(/[^a-zA-Z0-9]+/g, '_')}`;
}
