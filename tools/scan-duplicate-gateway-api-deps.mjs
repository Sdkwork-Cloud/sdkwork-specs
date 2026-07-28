#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import {
  assemblyPackageName,
  findGatewaySourceFiles,
  readText,
  resolveApplicationCode,
  scanForbiddenGatewayMerges,
} from './api-assembly-lib.mjs';

function gatewayHostCargoPaths(root, applicationCode) {
  const names = [
    `sdkwork-api-${applicationCode}-standalone-gateway`,
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

function listRuntimeDependencyPackages(cargo) {
  const dependencies = [];
  let section = '';
  let tableDependency = null;
  for (const rawLine of cargo.split(/\r?\n/u)) {
    const line = rawLine.replace(/\s+#.*$/u, '').trim();
    const sectionMatch = /^\[([^\]]+)\]$/u.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      tableDependency = /^dependencies\.([A-Za-z0-9_-]+)$/u.exec(section)?.[1]
        ?? /^target\..+\.dependencies\.([A-Za-z0-9_-]+)$/u.exec(section)?.[1]
        ?? null;
      if (tableDependency) dependencies.push(tableDependency.replaceAll('_', '-'));
      continue;
    }
    if (tableDependency) {
      const packageOverride = /^package\s*=\s*"([^"]+)"/u.exec(line)?.[1];
      if (packageOverride) dependencies.push(packageOverride.replaceAll('_', '-'));
      continue;
    }
    if (section !== 'dependencies' && !/^target\..+\.dependencies$/u.test(section)) {
      continue;
    }
    const dependencyMatch = /^([A-Za-z0-9_-]+)(?:\.workspace)?\s*=\s*(.+)$/u.exec(line);
    if (!dependencyMatch) continue;
    const packageOverride = /\bpackage\s*=\s*"([^"]+)"/u.exec(dependencyMatch[2])?.[1];
    dependencies.push((packageOverride ?? dependencyMatch[1]).replaceAll('_', '-'));
  }
  return [...new Set(dependencies)];
}

function isAssemblyPackage(packageName) {
  return /^sdkwork-api-[a-z0-9-]+-assembly$/u.test(packageName);
}

function isAssemblyOwnedImplementation(packageName) {
  if (packageName === 'sdkwork-database-sqlx') return false;
  return packageName.startsWith('sdkwork-routes-')
    || /^sdkwork-[a-z0-9-]+-service$/u.test(packageName)
    || /^sdkwork-[a-z0-9-]+-repository-[a-z0-9-]+$/u.test(packageName)
    || /^sdkwork-[a-z0-9-]+-database-host$/u.test(packageName);
}

function usesAssemblyInSource(sourceFiles, applicationCode) {
  const libName = assemblyPackageName(applicationCode).replace(/-/g, '_');
  const patterns = [
    new RegExp(
      `${libName}::(?:assemble_api_(?:business_)?router(?:_[a-z0-9_]+)?|ApiAssembly::from_environment)\\b`,
      'u',
    ),
    /\bassemble_api_(?:business_)?router(?:_[a-z0-9_]+)?\s*\(/u,
    /\bApiAssembly::from_environment\s*\(/u,
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
  for (const cargoPath of gatewayHostCargoPaths(root, applicationCode)) {
    const cargo = readText(cargoPath);
    const runtimeDependencies = listRuntimeDependencyPackages(cargo);
    if (!runtimeDependencies.some(isAssemblyPackage)) {
      continue;
    }
    const host = path.basename(path.dirname(cargoPath));
    const implementationDeps = runtimeDependencies.filter(isAssemblyOwnedImplementation);
    if (implementationDeps.length > 0) {
      issues.push(
        `${host}/Cargo.toml: thin standalone gateway bypasses API assemblies with direct `
        + `route/service/repository/database implementation dependencies (${implementationDeps.join(', ')})`,
      );
    }
  }

  const sourceFiles = findGatewaySourceFiles(root, applicationCode);
  const assemblyDir = `crates/sdkwork-api-${applicationCode}-assembly`;
  const mergeHits = scanForbiddenGatewayMerges(sourceFiles, assemblyDir);
  for (const hit of mergeHits) {
    issues.push(`forbidden hand route merge with assembly present: ${hit}`);
  }

  const hasAssemblyHost = gatewayHostCargoPaths(root, applicationCode).some((cargoPath) => {
    return readText(cargoPath).includes(assemblyName);
  });
  if (hasAssemblyHost && !usesAssemblyInSource(sourceFiles, applicationCode)) {
    warnings.push('gateway host depends on assembly but source never calls assemble_api_router');
  }

  return { applicationCode, issues, warnings };
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      workspace: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/scan-duplicate-gateway-api-deps.mjs (--root <application> | --workspace <workspace>)');
    return;
  }
  if (Boolean(values.root) === Boolean(values.workspace)) {
    console.error('exactly one of --root or --workspace is required');
    process.exitCode = 2;
    return;
  }
  if (values.root) {
    const root = path.resolve(values.root);
    const report = scanDuplicateGatewayApiDepsRepo(root);
    for (const issue of report.issues) console.error(`- ${issue}`);
    for (const warning of report.warnings) console.warn(`~ ${warning}`);
    if (report.issues.length > 0) process.exitCode = 1;
    else console.log(`duplicate gateway API dependency check passed for ${path.basename(root)}`);
    return;
  }

  const workspaceRoot = path.resolve(values.workspace);
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
    process.exitCode = 1;
  }
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
