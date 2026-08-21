/**
 * Retired nginx-compat table/key diagnostics shared by the TOML validator and
 * nginx.conf import tool. Dual-read is forbidden; callers MUST fail closed.
 *
 * Authority: SDKWORK_WEBSERVER_SPEC.md §4.1
 */

export const RETIRED_COMPATIBILITY_DIAGNOSTIC =
  'retired; migrate to [nginx] (nginx.enabled, nginx.profile) per SDKWORK_WEBSERVER_SPEC.md §4.1';

export const RETIRED_NGINX_PROFILE_DIAGNOSTIC = 'retired; rename to nginx.profile';

/**
 * @param {object} doc parsed server.toml subset
 * @returns {{ path: string, message: string }[]}
 */
export function retiredNginxDiagnostics(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return errors;
  }
  if (doc.compatibility !== undefined) {
    errors.push({ path: 'compatibility', message: RETIRED_COMPATIBILITY_DIAGNOSTIC });
  }
  if (doc.nginx?.nginxProfile !== undefined) {
    errors.push({ path: 'nginx.nginxProfile', message: RETIRED_NGINX_PROFILE_DIAGNOSTIC });
  }
  return errors;
}

/**
 * Keys under `[nginx]` that are retired and must not be reported as generic
 * unknown keys (a dedicated migration diagnostic is emitted instead).
 * @param {object} doc
 * @returns {Set<string>}
 */
export function retiredNginxKeys(doc) {
  const keys = new Set();
  if (doc?.nginx?.nginxProfile !== undefined) {
    keys.add('nginxProfile');
  }
  return keys;
}

/**
 * Import / activation gate: retired shapes block nginx.conf activation.
 * @param {object} doc
 * @returns {{ blocked: boolean, reason: string | null }}
 */
export function retiredNginxActivationBlock(doc) {
  const first = retiredNginxDiagnostics(doc)[0];
  if (!first) {
    return { blocked: false, reason: null };
  }
  if (first.path === 'compatibility') {
    return {
      blocked: true,
      reason: 'retired [compatibility] table; migrate to [nginx] (nginx.enabled)',
    };
  }
  return {
    blocked: true,
    reason: 'retired nginx.nginxProfile; rename to nginx.profile',
  };
}
