/**
 * Shared naming pattern helpers.
 * Forbidden legacy tokens are composed at runtime so standards sources stay canonical-only.
 */

export const CANONICAL_HTTP_ROUTE_PREFIX = 'sdkwork-routes-';

const LEGACY_HTTP_ROUTE_TOKEN = 'router';
export const LEGACY_HTTP_ROUTE_PREFIX = `sdkwork-${LEGACY_HTTP_ROUTE_TOKEN}-`;

export const FORBIDDEN_FOUNDATION_PC_REACT_TOKEN = LEGACY_HTTP_ROUTE_TOKEN;

export function legacyHttpRouteCratePattern() {
  return new RegExp(
    `${LEGACY_HTTP_ROUTE_PREFIX}[a-z0-9]+(?:-[a-z0-9]+)*-(?:open-api|app-api|backend-api|internal-api|common|http-auth|http-shared|deploy-common)`,
    'giu',
  );
}

export function forbiddenFoundationPcReactPattern() {
  return new RegExp(`sdkwork-${FORBIDDEN_FOUNDATION_PC_REACT_TOKEN}-pc-react`, 'gu');
}

export function legacyFoundationPcReactName() {
  return `sdkwork-${FORBIDDEN_FOUNDATION_PC_REACT_TOKEN}-pc-react`;
}

export function legacyHttpRouteCrateName(capability, surface) {
  return `${LEGACY_HTTP_ROUTE_PREFIX}${capability}-${surface}`;
}
