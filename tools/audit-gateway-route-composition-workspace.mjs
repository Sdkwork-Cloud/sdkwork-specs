#!/usr/bin/env node
/**
 * Workspace audit for gateway route composition: infra duplication, empty assemblies,
 * and platform collapsed-ingress violations.
 *
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.7.1–§5.7.3, HEALTH_CHECK_SPEC.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import {
  assemblyCrateDir,
  discoverRouteCrates,
  readText,
  resolveApplicationCode,
  scanAssemblyInfraMergeViolations,
  routeCratesUseDescriptorOnlyGatewayMount,
  usesKernelBridgeAssembly,
} from './gateway-assembly-lib.mjs';
import { validateGatewayAssembly } from './validate-gateway-assembly.mjs';

const INFRA_PATH_PATTERN = /["'`]\/(?:healthz|livez|readyz|metrics)["'`]/u;
const EMPTY_ASSEMBLY_PATTERN =
  /assemble_application_router[\s\S]{0,400}Router::new\(\)/u;
const PLATFORM_EMBED_INFRA_SOURCES = [
  'services/sdkwork-im-standalone-gateway/src/embedded_dependency_routes.rs',
  'crates/sdkwork-im-standalone-gateway/src/embedded_dependency_routes.rs',
];

function scanStandaloneDoubleInfra(root, applicationCode) {
  const errors = [];
  const candidates = [
    path.join(root, 'crates', `sdkwork-${applicationCode}-standalone-gateway`, 'src', 'main.rs'),
    path.join(root, 'services', `sdkwork-${applicationCode}-standalone-gateway`, 'src', 'main.rs'),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const text = readText(filePath);
    const assemblyInfra =
      /assemble_application_router/u.test(text)
      && /mount_(?:drive_|[a-z0-9_]+_)?infra_routes|assemble_multi_surface_router/u.test(text);
    const extraInfra =
      /mount_(?:drive_|[a-z0-9_]+_)?infra_routes|service_router\s*\(/u.test(text)
      && !/assemble_application_router/u.test(text.split('assemble_application_router')[0] ?? '');
    if (assemblyInfra && /mount_drive_infra_routes[\s\S]*assemble_application_router/u.test(text)) {
      errors.push(`${filePath}: merges standalone health_router and drive assembly infra`);
    }
    if (
      /assemble_application_router/u.test(text)
      && (text.match(/mount_(?:drive_|[a-z0-9_]+_)?infra_routes/gu) ?? []).length > 1
    ) {
      errors.push(`${filePath}: mounts infrastructure more than once around assembly`);
    }
    if (extraInfra && /health_router/u.test(text)) {
      errors.push(`${filePath}: standalone health_router likely duplicates assembly infra`);
    }
  }
  return errors;
}

function scanEmptyAssembly(root, applicationCode) {
  if (routeCratesUseDescriptorOnlyGatewayMount(root, applicationCode)) {
    return [];
  }
  const libPath = path.join(root, assemblyCrateDir(applicationCode), 'src', 'lib.rs');
  const bootstrapPath = path.join(root, assemblyCrateDir(applicationCode), 'src', 'bootstrap.rs');
  const libRs = readText(libPath);
  const bootstrapRs = readText(bootstrapPath);
  const combined = `${libRs}\n${bootstrapRs}`;
  if (!combined.trim()) {
    return [];
  }
  if (usesKernelBridgeAssembly(combined)) {
    return [];
  }
  if (
    /assemble_application_router[\s\S]*?ApplicationAssembly\s*\{\s*router:\s*(?:axum::)?Router::new\(\)\s*,?\s*\}/u.test(
      combined,
    )
    || /assemble_application_router[\s\S]*?Ok\(ApplicationAssembly[\s\S]*?router:\s*(?:axum::)?Router::new\(\)\s*,?\s*\}/u.test(
      combined,
    )
  ) {
    const hasRealBootstrap =
      /assemble_application_business_router\s*\(/u.test(combined)
      || /assemble_embedded_[a-z0-9_]+/u.test(combined)
      || /gateway_mount_business\s*\(/u.test(combined)
      || usesKernelBridgeAssembly(combined);
    if (!hasRealBootstrap) {
      return [`${assemblyCrateDir(applicationCode)} exports empty assemble_application_router`];
    }
  }
  if (EMPTY_ASSEMBLY_PATTERN.test(bootstrapRs) && /gateway_mount\(service\)/u.test(bootstrapRs)) {
    return [`${assemblyCrateDir(applicationCode)}/src/bootstrap.rs references undefined bootstrap state`];
  }
  return [];
}

function scanPlatformCloudGatewayEmbed(workspaceRoot) {
  const warnings = [];
  const runtimePath = path.join(
    workspaceRoot,
    'sdkwork-api-cloud-gateway',
    'crates',
    'sdkwork-api-cloud-gateway',
    'src',
    'runtime.rs',
  );
  const embedPath = path.join(
    workspaceRoot,
    'sdkwork-api-cloud-gateway',
    'crates',
    'sdkwork-api-cloud-gateway',
    'src',
    'embedded_dependency_routes.rs',
  );
  if (!fs.existsSync(runtimePath)) {
    return warnings;
  }
  const runtimeSource = readText(runtimePath);
  const embedSource = readText(embedPath);
  if (
    /GatewayMode::Embedded/u.test(runtimeSource)
    && !/embedded_dependency_routes/u.test(runtimeSource)
    && /build_embedded_sdkwork_iam_app_api_router/u.test(runtimeSource)
  ) {
    warnings.push(
      'sdkwork-api-cloud-gateway: embedded mode may only auto-wire IAM; use embedded_dependency_routes for gateway assemblies',
    );
  }
  if (embedSource.trim() && !/assemble_application_business_router/u.test(embedSource)) {
    warnings.push(
      'sdkwork-api-cloud-gateway/crates/sdkwork-api-cloud-gateway/src/embedded_dependency_routes.rs: no gateway assembly business routers wired',
    );
  }
  return warnings;
}

function scanPlatformEmbedInfra(workspaceRoot) {
  const warnings = [];
  const imRoot = path.join(workspaceRoot, 'sdkwork-im');
  for (const rel of PLATFORM_EMBED_INFRA_SOURCES) {
    const filePath = path.join(imRoot, rel);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const text = readText(filePath);
    if (
      /assemble_application_router/u.test(text)
      && !/assemble_application_business_router|build_served_unified_business_router/u.test(text)
    ) {
      warnings.push(
        `${rel}: embedded dependencies may merge domain assemblies with per-domain infra on one listener`,
      );
    }
  }
  return warnings;
}

export function auditGatewayRouteCompositionRepo(root) {
  const applicationCode = resolveApplicationCode(root);
  const routeCrates = discoverRouteCrates(root, applicationCode);
  if (routeCrates.length === 0) {
    return { skipped: true, applicationCode };
  }

  const errors = [];
  const warnings = [];
  const validation = validateGatewayAssembly(root);
  errors.push(...validation.errors);
  warnings.push(...validation.warnings);

  const bootstrapPath = path.join(root, assemblyCrateDir(applicationCode), 'src', 'bootstrap.rs');
  const bootstrapSource = readText(bootstrapPath);
  if (bootstrapSource.trim()) {
    errors.push(...scanAssemblyInfraMergeViolations(bootstrapSource, routeCrates));
  }
  errors.push(...scanStandaloneDoubleInfra(root, applicationCode));
  errors.push(...scanEmptyAssembly(root, applicationCode));

  for (const crate of routeCrates.filter((item) => item.mountsInfrastructure)) {
    if (!crate.hasGatewayMountBusiness && routeCrates.length > 1) {
      warnings.push(
        `${crate.packageName} mounts infrastructure but lacks gateway_mount_business (required for multi-surface assembly)`,
      );
    }
  }

  return {
    skipped: false,
    applicationCode,
    errors,
    warnings,
    routeCrates: routeCrates.length,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string' },
      prefix: { type: 'string', default: 'sdkwork-' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node tools/audit-gateway-route-composition-workspace.mjs --workspace <dir> [--prefix sdkwork-]',
    );
    process.exit(0);
  }

  const workspaceRoot = path.resolve(
    values.workspace
    || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
  );
  const repositories = listWorkspaceRepositories(workspaceRoot, { prefix: values.prefix });
  const failures = [];
  let checked = 0;

  for (const repoRoot of repositories) {
    checked += 1;
    const result = auditGatewayRouteCompositionRepo(repoRoot);
    if (result.skipped) {
      continue;
    }
    const repoName = path.basename(repoRoot);
    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log(`ok   ${repoName}`);
      continue;
    }
    if (result.errors.length === 0) {
      console.log(`warn ${repoName} (${result.warnings.length} warnings)`);
      for (const warning of result.warnings) {
        console.log(`  ~ ${warning}`);
      }
      continue;
    }
    console.log(`fail ${repoName} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
    for (const error of result.errors) {
      console.log(`  - ${error}`);
      failures.push(`${repoName}: ${error}`);
    }
    for (const warning of result.warnings) {
      console.log(`  ~ ${warning}`);
    }
  }

  const platformWarnings = [
    ...scanPlatformEmbedInfra(workspaceRoot),
    ...scanPlatformCloudGatewayEmbed(workspaceRoot),
  ];
  if (platformWarnings.length > 0) {
    console.log('\nPlatform collapsed-ingress warnings:');
    for (const warning of platformWarnings) {
      console.log(`  ~ ${warning}`);
    }
  }

  console.log(`\nRepositories checked: ${checked}`);
  console.log(`Failures: ${failures.length}`);
  if (failures.length > 0) {
    process.exit(1);
  }
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
