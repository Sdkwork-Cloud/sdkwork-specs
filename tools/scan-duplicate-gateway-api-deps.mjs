#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import {
  assemblyPackageName,
  findGatewaySourceFiles,
  isAllowedHostRouteDep,
  isApplicationOwnedRouteDep,
  readText,
  resolveApplicationCode,
  scanForbiddenGatewayMerges,
  apiServerUsesSplitSurfaceBinsOnly,
} from './gateway-assembly-lib.mjs';

function gatewayHostCargoPaths(root, applicationCode) {
  const names = [
    `sdkwork-${applicationCode}-standalone-gateway`,
    `sdkwork-${applicationCode}-cloud-gateway`,
  ];
  const paths = [];
  for (const base of ['crates', 'services']) {
    for (const name of names) {
      const cargoPath = path.join(root, base, name, 'Cargo.toml');
      if (fs.existsSync(cargoPath)) {
        paths.push(cargoPath);
      }
    }
  }
  return paths;
}

function listRouteCrateDeps(cargo) {
  return [...new Set(
    [...cargo.matchAll(/(?:^|\n)(sdkwork[-_][a-z0-9_-]*routes[a-z0-9_-]*)\s*=/gimu)]
      .map((match) => match[1].replace(/_/g, '-')),
  )];
}

function usesAssemblyInSource(sourceFiles, applicationCode) {
  const libName = assemblyPackageName(applicationCode).replace(/-/g, '_');
  const patterns = [
    new RegExp(`${libName}::assemble_application_router`, 'u'),
    new RegExp(`${libName}::assemble_application_business_router`, 'u'),
    /assemble_application_router\s*\(/u,
    /assemble_application_business_router\s*\(/u,
  ];
  for (const filePath of sourceFiles) {
    const source = readText(filePath);
    if (patterns.some((pattern) => pattern.test(source))) {
      return true;
    }
  }
  return false;
}

export function scanDuplicateGatewayApiDepsRepo(root) {
  const applicationCode = resolveApplicationCode(root);
  const assemblyName = assemblyPackageName(applicationCode);
  const issues = [];
  const warnings = [];
  const splitSurfaceTransitional = apiServerUsesSplitSurfaceBinsOnly(root, applicationCode);

  for (const cargoPath of gatewayHostCargoPaths(root, applicationCode)) {
    const cargo = readText(cargoPath);
    if (!cargo.includes(assemblyName)) {
      continue;
    }
    const routeDeps = listRouteCrateDeps(cargo).filter(
      (dep) => isApplicationOwnedRouteDep(dep, applicationCode)
        && !isAllowedHostRouteDep(dep, applicationCode),
    );
    if (routeDeps.length === 0) {
      continue;
    }
    if (splitSurfaceTransitional) {
      warnings.push(
        `${path.basename(path.dirname(cargoPath))}/Cargo.toml: transitional split-surface still depends on application route crates (${routeDeps.join(', ')})`,
      );
      continue;
    }
    const host = path.basename(path.dirname(cargoPath));
    issues.push(
      `${host}/Cargo.toml: duplicate deps — gateway-assembly and application route crates (${routeDeps.join(', ')})`,
    );
  }

  const sourceFiles = findGatewaySourceFiles(root, applicationCode);
  const assemblyDir = `crates/sdkwork-${applicationCode}-gateway-assembly`;
  const mergeHits = scanForbiddenGatewayMerges(sourceFiles, assemblyDir);
  for (const hit of mergeHits) {
    issues.push(`forbidden hand route merge with assembly present: ${hit}`);
  }

  const hasAssemblyHost = gatewayHostCargoPaths(root, applicationCode).some((cargoPath) => {
    return readText(cargoPath).includes(assemblyName);
  });
  if (hasAssemblyHost && !splitSurfaceTransitional && !usesAssemblyInSource(sourceFiles, applicationCode)) {
    warnings.push('gateway host depends on assembly but source never calls assemble_application_router');
  }

  return { applicationCode, issues, warnings };
}

function main() {
  const workspaceRoot = path.resolve(
    process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'),
  );
  let fail = 0;
  for (const repoRoot of listWorkspaceRepositories(workspaceRoot, { prefix: 'sdkwork-' })) {
    const report = scanDuplicateGatewayApiDepsRepo(repoRoot);
    if (report.issues.length === 0 && report.warnings.length === 0) {
      continue;
    }
    console.log(path.basename(repoRoot));
    for (const issue of report.issues) {
      console.log(`  - ${issue}`);
      fail += 1;
    }
    for (const warning of report.warnings) {
      console.log(`  ~ ${warning}`);
    }
  }
  if (fail > 0) {
    process.exit(1);
  }
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
