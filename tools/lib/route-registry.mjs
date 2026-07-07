import fs from 'node:fs';
import path from 'node:path';
import {
  openApiAuthorityEntries,
  walkOpenApiFiles,
} from './http-response-envelope-patterns.mjs';
import {
  openApiOperationEntriesFromText,
} from './openapi-operation-utils.mjs';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'artifacts', 'target', 'dist', 'build', '.pnpm-store', '.tmp']);

export function normalizeRoutePath(routePath) {
  const raw = String(routePath ?? '').trim();
  if (!raw) return '';
  const withoutQuery = raw.split(/[?#]/u, 1)[0];
  const withCanonicalParams = withoutQuery
    .replace(/\/+/gu, '/')
    .replace(/\{[^}/]+\}/gu, '{param}')
    .replace(/<[^>/]+>/gu, '{param}')
    .replace(/(^|\/):[A-Za-z_][A-Za-z0-9_]*/gu, '$1{param}');
  if (withCanonicalParams.length > 1 && withCanonicalParams.endsWith('/')) {
    return withCanonicalParams.slice(0, -1);
  }
  return withCanonicalParams || '/';
}

export function classifyRoutePathCollisions(routes) {
  const groups = new Map();
  const issues = [];
  for (const route of routes) {
    if (!route?.method || !route?.path) continue;
    const listener = route.listener ?? route.surface ?? 'default';
    const method = String(route.method).toUpperCase();
    const normalizedPath = normalizeRoutePath(route.path);
    const key = `${listener}\0${method}\0${normalizedPath}`;
    const entries = groups.get(key) ?? [];
    entries.push({ ...route, listener, method, normalizedPath });
    groups.set(key, entries);
  }

  issues.push(...classifyReservedRoutePathOwners([...groups.values()].flat()));
  for (const entries of groups.values()) {
    const declarations = collapseEquivalentRepresentations(entries);
    if (declarations.length <= 1) continue;
    if (declarations.every((entry) => hasOverrideAdr(entry))) continue;
    const first = declarations[0];
    const sources = declarations
      .map((entry) => `${entry.source}${entry.operationId ? `#${entry.operationId}` : ''}`)
      .join(', ');
    issues.push({
      kind: 'duplicate-route-path',
      detail: `${first.listener} ${first.method} ${first.normalizedPath} is declared by multiple route sources: ${sources}`,
      routes: declarations,
    });
  }
  return issues;
}

export function collectRouteRegistry(root) {
  const routes = [];
  routes.push(...collectOpenApiRoutes(root));
  routes.push(...collectRouteManifestRoutes(root));
  return routes.sort((left, right) => routeSortKey(left).localeCompare(routeSortKey(right)));
}

export function classifyRouteRegistry(root) {
  return classifyRoutePathCollisions(collectRouteRegistry(root));
}

function collectOpenApiRoutes(root) {
  const routes = [];
  for (const authority of openApiAuthorityEntries(walkOpenApiFiles(root))) {
    const text = readText(authority.file);
    if (text == null) continue;
    const parsed = openApiOperationEntriesFromText(text);
    const rel = toPosix(path.relative(root, authority.file));
    for (const entry of parsed.entries) {
      routes.push({
        sourceKind: 'openapi',
        projectionKind: openApiProjectionKind(rel),
        source: rel,
        repo: authority.repo,
        surface: authority.surface,
        method: entry.method.toUpperCase(),
        path: entry.routePath,
        operationId: entry.operation.operationId,
        routeCrate: entry.operation['x-sdkwork-source-route-crate'],
        overrideAdr: entry.operation['x-sdkwork-route-override-adr'],
      });
    }
  }
  return routes;
}

function collectRouteManifestRoutes(root) {
  const routes = [];
  for (const file of walkRouteManifestFiles(root)) {
    const manifest = readJson(file);
    if (!manifest || !isRouteManifest(manifest)) continue;
    const rel = toPosix(path.relative(root, file));
    const manifestSurface = manifest.surface ?? manifest.apiSurface ?? surfaceFromPath(file);
    const routeCrate = manifest.packageName ?? manifest.crate ?? manifest.crateName ?? manifest.name;
    const entries = Array.isArray(manifest.routes) ? manifest.routes : [];
    for (const route of entries) {
      routes.push({
        sourceKind: 'route-manifest',
        projectionKind: 'route-manifest',
        source: rel,
        surface: route.apiSurface ?? route.surface ?? manifestSurface,
        method: route.method,
        path: route.path ?? route.fullPath,
        operationId: route.operationId,
        routeCrate,
        overrideAdr: route['x-sdkwork-route-override-adr'] ?? route.overrideAdr,
      });
    }
  }
  return routes;
}

function collapseEquivalentRepresentations(entries) {
  const declarations = [];
  for (const entry of entries) {
    const equivalent = declarations.find((candidate) => representsSameRouteDeclaration(candidate, entry));
    if (equivalent) {
      equivalent.source = `${equivalent.source}, ${entry.source}`;
      equivalent.overrideAdr = equivalent.overrideAdr ?? entry.overrideAdr;
      equivalent.routeCrate = equivalent.routeCrate ?? entry.routeCrate;
      continue;
    }
    declarations.push({ ...entry });
  }
  return declarations;
}

function representsSameRouteDeclaration(left, right) {
  if (!left.operationId || left.operationId !== right.operationId) return false;
  if (left.routeCrate && right.routeCrate && left.routeCrate !== right.routeCrate) return false;
  if (left.sourceKind === 'openapi' && right.sourceKind === 'openapi') return true;
  if (isEquivalentOpenApiProjection(left, right)) return true;
  if (left.sourceKind === right.sourceKind) return false;
  return true;
}

function isEquivalentOpenApiProjection(left, right) {
  if (left.sourceKind !== 'openapi' || right.sourceKind !== 'openapi') return false;
  if (left.projectionKind === right.projectionKind) return false;
  const projectionKinds = new Set([left.projectionKind, right.projectionKind]);
  return projectionKinds.has('api-authority')
    && (projectionKinds.has('sdk-authority') || projectionKinds.has('generated-authority'));
}

function openApiProjectionKind(source) {
  if (/^apis\//u.test(source)) return 'api-authority';
  if (/^sdks\/[^/]+\/openapi\//u.test(source)) return 'sdk-authority';
  if (/^generated\/openapi\//u.test(source)) return 'generated-authority';
  if (/\/specs\/openapi\//u.test(source)) return 'api-authority';
  if (/\/sdks\/[^/]+\/openapi\//u.test(source)) return 'sdk-authority';
  if (/\/generated\/openapi\//u.test(source)) return 'generated-authority';
  return 'source-authority';
}

function hasOverrideAdr(route) {
  const adr = route.overrideAdr ?? route['x-sdkwork-route-override-adr'] ?? route.allowedOverrideAdr;
  return typeof adr === 'string' && /^ADR-[0-9A-Za-z_-]+/u.test(adr.trim());
}

function classifyReservedRoutePathOwners(routes) {
  const issues = [];
  for (const route of routes) {
    if (route.method !== 'GET') continue;
    if (!isReservedHealthRoutePath(route.normalizedPath)) continue;
    if (isApprovedHealthRouteOwner(route)) continue;
    issues.push({
      kind: 'reserved-route-path-owner',
      detail: `${route.listener} ${route.method} ${route.normalizedPath} is reserved for the standard health/readiness route owner; ${route.source}${route.operationId ? `#${route.operationId}` : ''} must use a capability-specific path or mount the standard health route component`,
      routes: [route],
    });
  }
  return issues;
}

function isReservedHealthRoutePath(routePath) {
  return /^\/(?:app|backend)\/v3\/api\/system\/(?:health|ready)$/u.test(routePath);
}

function isApprovedHealthRouteOwner(route) {
  const ownerText = [
    route.routeCrate,
    route.source,
  ].filter(Boolean).join(' ').toLowerCase();
  return /(?:^|[/_-])(?:routes|router)?-?health(?:$|[/_-])/u.test(ownerText)
    || /(?:^|[/_-])system-health(?:$|[/_-])/u.test(ownerText)
    || /(?:^|[/_-])readiness(?:$|[/_-])/u.test(ownerText);
}

function walkRouteManifestFiles(root, acc = []) {
  if (!fs.existsSync(root)) return acc;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkRouteManifestFiles(full, acc);
      continue;
    }
    if (/\.route-manifest\.json$/u.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function isRouteManifest(manifest) {
  return typeof manifest.kind === 'string'
    && /^sdkwork\.(?:http\.)?route[.-]manifest$/u.test(manifest.kind);
}

function surfaceFromPath(filePath) {
  const norm = toPosix(filePath);
  const match = norm.match(/\/_route-manifests\/([^/]+)\//u);
  return match?.[1] ?? 'default';
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJson(filePath) {
  const text = readText(filePath);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function routeSortKey(route) {
  return [
    route.surface ?? '',
    route.method ?? '',
    normalizeRoutePath(route.path),
    route.source ?? '',
    route.operationId ?? '',
  ].join('\0');
}

function toPosix(filePath) {
  return filePath.replace(/\\/gu, '/');
}
