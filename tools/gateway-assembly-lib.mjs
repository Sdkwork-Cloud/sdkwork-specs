#!/usr/bin/env node
/**
 * Shared discovery helpers for gateway assembly materialize/validate tooling.
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.7, WEB_BACKEND_SPEC.md §4.2.1
 */
import fs from 'node:fs';
import path from 'node:path';

const ROUTE_CRATE_DIR_PATTERN = /^crates\/sdkwork-routes-([a-z0-9-]+)-/u;
const GATEWAY_MOUNT_PATTERN = /pub\s+(?:async\s+)?fn\s+gateway_mount\b/u;
const GATEWAY_MANIFEST_PATTERN =
  /pub\s+(?:async\s+)?fn\s+gateway_route_manifest\b|pub\s+const\s+GATEWAY_ROUTE_MANIFEST\b/u;
const FORBIDDEN_GATEWAY_MERGE_PATTERN =
  /(?:router\s*=\s*router\s*\.merge\s*\(|\.merge\s*\()\s*(?:sdkwork_routes_|sdkwork-routes-)/u;

export function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function readJson(filePath) {
  const text = readText(filePath);
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text);
}

export function resolveApplicationCode(root) {
  const base = path.basename(path.resolve(root));
  const match = /^sdkwork-([a-z0-9-]+)$/u.exec(base);
  if (match) {
    return match[1];
  }
  const appConfig = readJson(path.join(root, 'sdkwork.app.config.json'));
  const backendAppId = appConfig?.backend?.appId;
  if (typeof backendAppId === 'string') {
    const appIdMatch = /^sdkwork-([a-z0-9-]+)/u.exec(backendAppId);
    if (appIdMatch) {
      return appIdMatch[1];
    }
  }
  return base.replace(/[^a-z0-9-]/gu, '-');
}

export function assemblyCrateDir(applicationCode) {
  return `crates/sdkwork-${applicationCode}-gateway-assembly`;
}

export function assemblyPackageName(applicationCode) {
  return `sdkwork-${applicationCode}-gateway-assembly`;
}

export function parseCargoWorkspaceMembers(root) {
  const cargoToml = readText(path.join(root, 'Cargo.toml'));
  const members = [];
  const membersMatch = /\[workspace\][\s\S]*?members\s*=\s*\[([\s\S]*?)\]/u.exec(cargoToml);
  if (!membersMatch) {
    return members;
  }
  const body = membersMatch[1];
  for (const line of body.split('\n')) {
    const quoted = /"([^"]+)"/u.exec(line);
    if (quoted) {
      members.push(quoted[1].replace(/\\/gu, '/'));
    }
  }
  return members;
}

export function discoverRouteCrates(root, applicationCode) {
  const members = [...new Set(parseCargoWorkspaceMembers(root))];
  const prefix = `crates/sdkwork-routes-${applicationCode}-`;
  const routeMembers = members
    .filter((member) => member.startsWith(prefix))
    .filter((member) => !/-common$/u.test(path.basename(member)))
    .sort((a, b) => a.localeCompare(b));

  return routeMembers.map((memberDir) => {
    const crateRoot = path.join(root, memberDir);
    const cargoToml = readText(path.join(crateRoot, 'Cargo.toml'));
    const packageMatch = /^\s*name\s*=\s*"([^"]+)"/mu.exec(cargoToml);
    const packageName = packageMatch?.[1] ?? path.basename(memberDir);
    const libName = packageName.replace(/-/gu, '_');
    const libRs = readText(path.join(crateRoot, 'src', 'lib.rs'));
    const manifestRs = readText(path.join(crateRoot, 'src', 'manifest.rs'));
    const pathPrefix = extractPathPrefix(libRs, manifestRs);
    const surface = extractSurface(packageName);
    return {
      memberDir,
      packageName,
      libName,
      pathPrefix,
      surface,
      hasGatewayMount: GATEWAY_MOUNT_PATTERN.test(libRs),
      hasGatewayRouteManifest: GATEWAY_MANIFEST_PATTERN.test(libRs),
    };
  });
}

function extractSurface(packageName) {
  if (packageName.endsWith('-open-api')) {
    return 'open-api';
  }
  if (packageName.endsWith('-app-api')) {
    return 'app-api';
  }
  if (packageName.endsWith('-backend-api')) {
    return 'backend-api';
  }
  return 'unknown';
}

function extractPathPrefix(libRs, manifestRs) {
  const constMatch =
    /pub\s+const\s+(?:OPEN|APP|BACKEND)_API_PREFIX\s*:\s*&str\s*=\s*"([^"]+)"/u.exec(libRs) ??
    /pub\s+const\s+\w+_PREFIX\s*:\s*&str\s*=\s*"([^"]+)"/u.exec(libRs) ??
    /prefix\s*:\s*"([^"]+)"/u.exec(manifestRs);
  return constMatch?.[1] ?? null;
}

export function buildAssemblyManifest(root, applicationCode, routeCrates) {
  return {
    kind: 'sdkwork.gateway.assembly',
    schemaVersion: 1,
    applicationCode,
    packageName: assemblyPackageName(applicationCode),
    crateDir: assemblyCrateDir(applicationCode),
    generatedAt: new Date().toISOString(),
    routeCrates: routeCrates.map((crate, index) => ({
      packageName: crate.packageName,
      memberDir: crate.memberDir,
      libName: crate.libName,
      surface: crate.surface,
      pathPrefix: crate.pathPrefix,
      mountOrder: index,
      hasGatewayMount: crate.hasGatewayMount,
      hasGatewayRouteManifest: crate.hasGatewayRouteManifest,
    })),
  };
}

export function findGatewaySourceFiles(root, applicationCode) {
  const candidates = [
    path.join(root, 'crates', `sdkwork-${applicationCode}-standalone-gateway`, 'src'),
    path.join(root, 'crates', `sdkwork-${applicationCode}-cloud-gateway`, 'src'),
    path.join(root, 'services', `sdkwork-${applicationCode}-standalone-gateway`, 'src'),
    path.join(root, 'services', `sdkwork-${applicationCode}-cloud-gateway`, 'src'),
  ];
  const files = [];
  for (const dir of candidates) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        for (const nested of fs.readdirSync(full)) {
          if (nested.endsWith('.rs')) {
            files.push(path.join(full, nested));
          }
        }
      } else if (entry.name.endsWith('.rs')) {
        files.push(full);
      }
    }
  }
  return files;
}

export function scanForbiddenGatewayMerges(gatewaySourceFiles, assemblyCrateDir) {
  const hits = [];
  for (const filePath of gatewaySourceFiles) {
    const normalized = filePath.replace(/\\/gu, '/');
    if (normalized.includes(`${assemblyCrateDir}/`)) {
      continue;
    }
    const text = readText(filePath);
    if (FORBIDDEN_GATEWAY_MERGE_PATTERN.test(text)) {
      hits.push(normalized);
    }
  }
  return hits;
}

const ROUTE_BUILDER_PATTERN =
  /pub\s+(?:async\s+)?fn\s+build_[a-zA-Z0-9_]*router[a-zA-Z0-9_]*/u;

export function routeCrateExpectsDelegatableMount(root, memberDir) {
  for (const rel of ['src/lib.rs', 'src/routes.rs', 'src/account_router.rs', 'src/app_catalog_router.rs']) {
    const text = readText(path.join(root, memberDir, rel));
    if (ROUTE_BUILDER_PATTERN.test(text)) {
      return true;
    }
  }
  return false;
}

export function parseGatewayMountSignature(libRs) {
  const match = /pub\s+(async\s+)?fn\s+gateway_mount\s*\(([^)]*)\)/u.exec(libRs);
  if (!match) {
    return null;
  }
  return {
    async: Boolean(match[1]),
    params: match[2].trim(),
    paramNames: match[2]
      .trim()
      .split(',')
      .map((part) => part.trim().split(':')[0].trim())
      .filter(Boolean),
  };
}

export function discoverGatewayMounts(root, routeCrates) {
  return routeCrates.map((crate) => {
    const libRs = readText(path.join(root, crate.memberDir, 'src', 'lib.rs'));
    const mount = parseGatewayMountSignature(libRs);
    return { ...crate, mount };
  });
}
