#!/usr/bin/env node
/**
 * Add gateway_mount and gateway_route_manifest exports to route crates.
 * Authority: WEB_BACKEND_SPEC.md §4.2.1
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  discoverRouteCrates,
  readText,
  resolveApplicationCode,
} from './gateway-assembly-lib.mjs';

const BUILD_FN_PATTERN =
  /pub\s+(async\s+)?fn\s+(build_[a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:->\s*([^{;]+))?/gu;
const ROOT_MANIFEST_FN_PATTERN =
  /pub\s+fn\s+([a-zA-Z0-9_]*manifest[a-zA-Z0-9_]*)\s*\(\s*\)\s*->\s*([^\n{]+)/u;

function usage() {
  return [
    'Usage: node tools/align-gateway-mount-exports.mjs [--root <repo>] [--dry-run]',
    '',
    'Adds gateway_mount and gateway_route_manifest to route crates missing them.',
  ].join('\n');
}

function pickManifestFn(manifestExports) {
  const names = manifestExports
    .split(',')
    .map((part) => part.trim().split(/\s+as\s+/u).pop().trim());
  const preferred = [
    'app_route_manifest',
    'backend_route_manifest',
    'open_route_manifest',
    'iam_app_api_route_manifest',
    'route_manifest',
    'http_route_manifest',
    'claw_router_app_http_route_manifest',
  ];
  for (const candidate of preferred) {
    if (names.includes(candidate)) {
      return candidate;
    }
  }
  return names.find((name) => name.includes('manifest')) ?? null;
}

function findManifestExport(crateRoot) {
  const libRs = readText(path.join(crateRoot, 'src', 'lib.rs'));
  const manifestUse = /pub\s+use\s+manifest::\{([^}]+)\}/u.exec(libRs);
  if (manifestUse) {
    const name = pickManifestFn(manifestUse[1]);
    if (name) {
      const manifestRs = readText(path.join(crateRoot, 'src', 'manifest.rs'));
      const signature = new RegExp(
        `pub\\s+fn\\s+${name}\\s*\\(\\s*\\)\\s*->\\s*([^\\n{]+)`,
        'u',
      ).exec(manifestRs);
      return {
        fn: name,
        returnType: signature?.[1]?.trim() ?? 'sdkwork_web_core::HttpRouteManifest',
      };
    }
  }

  const httpManifestUse = /pub\s+use\s+http_route_manifest::\{([^}]+)\}/u.exec(libRs);
  if (httpManifestUse) {
    const name = pickManifestFn(httpManifestUse[1]);
    if (name) {
      const manifestRs = readText(path.join(crateRoot, 'src', 'http_route_manifest.rs'));
      const signature = new RegExp(
        `pub\\s+fn\\s+${name}\\s*\\(\\s*\\)\\s*->\\s*([^\\n{]+)`,
        'u',
      ).exec(manifestRs);
      return {
        fn: name,
        returnType: signature?.[1]?.trim() ?? 'sdkwork_web_core::HttpRouteManifest',
      };
    }
  }

  for (const file of ['src/manifest.rs', 'src/http_route_manifest.rs', 'src/lib.rs']) {
    const text = readText(path.join(crateRoot, file));
    const match = /pub\s+fn\s+([a-zA-Z0-9_]*route_manifest[a-zA-Z0-9_]*)\s*\(\s*\)\s*->\s*([^\n{]+)/u.exec(
      text,
    );
    if (match) {
      return { fn: match[1], returnType: match[2].trim() };
    }
  }

  const rootManifest = ROOT_MANIFEST_FN_PATTERN.exec(libRs);
  if (rootManifest) {
    return { fn: rootManifest[1], returnType: rootManifest[2].trim() };
  }

  return null;
}

function ensureAxumDependency(crateRoot) {
  const cargoPath = path.join(crateRoot, 'Cargo.toml');
  const cargoToml = readText(cargoPath);
  if (/^\s*axum(?:\.workspace)?\s*=/mu.test(cargoToml)) {
    return false;
  }
  const updated = cargoToml.replace(
    /\[dependencies\]\s*\n/u,
    '[dependencies]\naxum = { version = "0.8", features = ["macros"] }\n',
  );
  fs.writeFileSync(cargoPath, updated, 'utf8');
  return true;
}

function scoreBuildCandidate(candidate) {
  let score = 0;
  const name = candidate.name;
  if (name === 'build_public_app') {
    score += 90;
  }
  if (name === 'build_protected_router_with_pool') {
    score += 85;
  }
  if (/_from_env$/u.test(name)) {
    score += candidate.async ? 80 : 40;
  }
  if (/with_framework/u.test(name)) {
    score += candidate.async ? 75 : 35;
  }
  if (/build_.*_router$/u.test(name)) {
    score += 60;
  }
  if (candidate.returnType.includes('Result<')) {
    score -= 50;
  }
  if (candidate.params) {
    score += 5;
  }
  if (candidate.source.endsWith('routes.rs')) {
    score += 2;
  }
  return score;
}

function findPreferredBuildFn(crateRoot) {
  const candidates = [];
  for (const rel of ['src/lib.rs', 'src/routes.rs', 'src/account_router.rs', 'src/app_catalog_router.rs']) {
    const text = readText(path.join(crateRoot, rel));
    if (!text) {
      continue;
    }
    let match;
    while ((match = BUILD_FN_PATTERN.exec(text)) !== null) {
      candidates.push({
        async: Boolean(match[1]),
        name: match[2],
        params: match[3].trim(),
        returnType: (match[4] || 'axum::Router').trim(),
        source: rel,
      });
    }
    BUILD_FN_PATTERN.lastIndex = 0;
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => scoreBuildCandidate(right) - scoreBuildCandidate(left))[0];
}

function renderStubGatewayExports(manifest) {
  const lines = [];
  if (manifest) {
    lines.push(`pub fn gateway_route_manifest() -> ${manifest.returnType} {`);
    lines.push(`    ${manifest.fn}()`);
    lines.push('}');
    lines.push('');
  }
  lines.push('pub fn gateway_mount() -> axum::Router {');
  lines.push('    axum::Router::new()');
  lines.push('}');
  return lines.join('\n');
}

function normalizeRouterReturnType(returnType) {
  const trimmed = returnType.trim();
  if (trimmed.includes('Result<')) {
    return 'axum::Router';
  }
  if (/^axum::Router\b/u.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/\bRouter\b/u, 'axum::Router');
}

function renderGatewayExports(manifest, buildFn) {
  const lines = [];
  if (manifest) {
    lines.push(`pub fn gateway_route_manifest() -> ${manifest.returnType} {`);
    lines.push(`    ${manifest.fn}()`);
    lines.push('}');
    lines.push('');
  }

  const fnKeyword = buildFn.async ? 'pub async fn' : 'pub fn';
  const params = buildFn.params ? buildFn.params : '';
  const returnType = normalizeRouterReturnType(buildFn.returnType);
  lines.push(`${fnKeyword} gateway_mount(${params}) -> ${returnType} {`);
  const callArgs = buildFn.params
    ? buildFn.params
        .split(',')
        .map((part) => part.trim().split(':')[0].trim())
        .filter(Boolean)
        .join(', ')
    : '';
  const invocation = buildFn.async
    ? `${buildFn.name}(${callArgs}).await`
    : `${buildFn.name}(${callArgs})`;
  if (buildFn.returnType.includes('Result<')) {
    lines.push(`    ${invocation}.expect("gateway_mount failed to build route crate router")`);
  } else {
    lines.push(`    ${invocation}`);
  }
  lines.push('}');
  return lines.join('\n');
}

function serviceHostImport(typeName) {
  if (!typeName.endsWith('ServiceHost')) {
    return null;
  }
  const prefix = typeName.slice(0, -'ServiceHost'.length);
  const snake = prefix
    .replace(/([A-Z])/gu, (match, letter, index) => (index === 0 ? '' : '_') + letter.toLowerCase())
    .toLowerCase();
  return `use sdkwork_${snake}_service_host::${typeName};`;
}

function hasBareRouterReference(source) {
  return /(^|[^\w:])Router(?:<|\b)/u.test(source);
}

function removeUnusedAxumRouterImport(source) {
  const withoutImport = source.replace(/^\s*use axum::Router;\r?\n\r?\n?/mu, '');
  if (withoutImport !== source && !hasBareRouterReference(withoutImport)) {
    return withoutImport;
  }
  return source;
}

function normalizeGatewayMountSource(source) {
  return removeUnusedAxumRouterImport(source.replace(/axum::axum::Router/gu, 'axum::Router'));
}

function gatewayMountImportLines(libRs, gatewayExports) {
  const imports = [];
  if (!/\buse axum::Router\b/u.test(libRs) && hasBareRouterReference(gatewayExports)) {
    imports.push('use axum::Router;');
  }
  if (/\bArc</u.test(gatewayExports) && !/\buse std::sync::Arc\b/u.test(libRs)) {
    imports.push('use std::sync::Arc;');
  }
  for (const match of gatewayExports.matchAll(/Arc<([A-Za-z0-9_]+)>/gu)) {
    const importLine = serviceHostImport(match[1]);
    if (importLine && !libRs.includes(importLine)) {
      imports.push(importLine);
    }
  }
  for (const match of gatewayExports.matchAll(/\b(SqlitePool|PgPool)\b/gu)) {
    const importLine = `use sqlx::${match[1]};`;
    if (!libRs.includes(importLine)) {
      imports.push(importLine);
    }
  }
  return imports;
}

function appendGatewayExports(libRs, gatewayExports) {
  const imports = gatewayMountImportLines(libRs, gatewayExports);
  const importBlock = imports.length > 0 ? `\n\n${imports.join('\n')}` : '';
  return `${libRs.trimEnd()}${importBlock}\n\n${gatewayExports}\n`;
}

export function alignGatewayMountExports(root, { dryRun = false } = {}) {
  const applicationCode = resolveApplicationCode(root);
  const routeCrates = discoverRouteCrates(root, applicationCode);
  const results = [];

  for (const crate of routeCrates) {
    const crateRoot = path.join(root, crate.memberDir);
    const libPath = path.join(crateRoot, 'src', 'lib.rs');
    const libRs = readText(libPath);
    const normalizedLibRs = normalizeGatewayMountSource(libRs);

    if (crate.hasGatewayMount) {
      if (normalizedLibRs !== libRs) {
        if (!dryRun) {
          fs.writeFileSync(libPath, normalizedLibRs, 'utf8');
        }
        results.push({
          packageName: crate.packageName,
          status: dryRun ? 'would-update-existing' : 'updated-existing',
          reason: 'normalized gateway_mount signature',
        });
        continue;
      }
      results.push({ packageName: crate.packageName, status: 'skipped', reason: 'already has gateway_mount' });
      continue;
    }

    const manifest = findManifestExport(crateRoot);
    const buildFn = findPreferredBuildFn(crateRoot);

    if (!buildFn) {
      const gatewayExports = manifest
        ? renderStubGatewayExports(manifest)
        : 'pub fn gateway_mount() -> axum::Router {\n    axum::Router::new()\n}';
      const updated = appendGatewayExports(libRs, gatewayExports);
      if (!dryRun) {
        ensureAxumDependency(crateRoot);
        fs.writeFileSync(libPath, updated, 'utf8');
      }
      results.push({
        packageName: crate.packageName,
        status: dryRun ? 'would-update-stub' : 'updated-stub',
        buildFn: 'Router::new()',
        manifestFn: manifest?.fn ?? null,
      });
      continue;
    }

    const gatewayExports = renderGatewayExports(manifest, buildFn);
    const updated = appendGatewayExports(libRs, gatewayExports);
    if (!dryRun) {
      fs.writeFileSync(libPath, updated, 'utf8');
    }
    results.push({
      packageName: crate.packageName,
      status: dryRun ? 'would-update' : 'updated',
      buildFn: buildFn.name,
      manifestFn: manifest?.fn ?? null,
    });
  }

  return { applicationCode, routeCrates: routeCrates.length, results };
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const root = path.resolve(values.root);
  const report = alignGatewayMountExports(root, { dryRun: values['dry-run'] });
  let updated = 0;
  let failed = 0;

  for (const item of report.results) {
    if (
      item.status === 'updated'
      || item.status === 'would-update'
      || item.status === 'updated-existing'
      || item.status === 'would-update-existing'
    ) {
      updated += 1;
      console.log(
        `${item.status.startsWith('would-update') ? 'plan' : 'ok'}   ${item.packageName} (${
          item.buildFn ?? item.reason
        }${item.manifestFn ? `, ${item.manifestFn}` : ''})`,
      );
      continue;
    }
    if (item.status === 'failed') {
      failed += 1;
      console.error(`fail ${item.packageName}: ${item.reason}`);
      continue;
    }
    console.log(`skip ${item.packageName}: ${item.reason}`);
  }

  console.log(
    `\nalign-gateway-mount-exports for sdkwork-${report.applicationCode}: ${updated} updated, ${failed} failed`,
  );
  if (failed > 0) {
    process.exit(1);
  }
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
