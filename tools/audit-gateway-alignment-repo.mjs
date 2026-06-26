#!/usr/bin/env node
/**
 * Per-repository gateway dependency-management alignment report.
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.6–5.7, DEPENDENCY_MANAGEMENT_SPEC.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assemblyCrateDir,
  assemblyPackageName,
  discoverRouteCrates,
  findGatewaySourceFiles,
  readText,
  resolveApplicationCode,
  routeCrateExpectsDelegatableMount,
  scanForbiddenGatewayMerges,
} from './gateway-assembly-lib.mjs';
import { validateGatewayAssembly } from './validate-gateway-assembly.mjs';

function hasPackageScript(root, name) {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return false;
  }
  try {
    const pkg = JSON.parse(readText(packagePath).replace(/^\uFEFF/u, ''));
    return Boolean(pkg.scripts?.[name]);
  } catch {
    return false;
  }
}

function hasGatewayScripts(root) {
  return (
    fs.existsSync(path.join(root, 'scripts', 'gateway', 'assembly-materialize.mjs'))
    && fs.existsSync(path.join(root, 'scripts', 'gateway', 'assembly-validate.mjs'))
  );
}

function hasWorkspaceMember(root, applicationCode) {
  const cargoToml = readText(path.join(root, 'Cargo.toml'));
  if (!cargoToml.includes('[workspace]')) {
    return null;
  }
  return cargoToml.includes(`"${assemblyCrateDir(applicationCode)}"`);
}

function hasStandaloneOrCloudGateway(root, applicationCode) {
  const candidates = [
    path.join(root, 'crates', `sdkwork-${applicationCode}-standalone-gateway`),
    path.join(root, 'crates', `sdkwork-${applicationCode}-cloud-gateway`),
    path.join(root, 'services', `sdkwork-${applicationCode}-standalone-gateway`),
    path.join(root, 'services', `sdkwork-${applicationCode}-cloud-gateway`),
    path.join(root, 'crates', `sdkwork-${applicationCode}-api-server`),
    path.join(root, 'services', `sdkwork-${applicationCode}-api-server`),
  ];
  const found = {};
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      found[path.basename(candidate)] = true;
    }
  }
  return found;
}

function bootstrapHasTodoMacro(bootstrapSource) {
  return bootstrapSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .some((line) => /todo!\s*\(/u.test(line));
}

function topologyIngressWarnings(root) {
  const topologyPath = path.join(root, 'specs', 'topology.spec.json');
  if (!fs.existsSync(topologyPath)) {
    return [];
  }
  const warnings = [];
  const text = readText(topologyPath);
  const decomposedPattern =
    /(?:^|[-_])(?:api-server|app-api|backend-api|open-api|admin-api)(?:[-_.]|$)/u;
  for (const line of text.split('\n')) {
    if (!line.includes('application.public-ingress')) {
      continue;
    }
    const processMatch = /"process(?:Id|Name)"\s*:\s*"([^"]+)"/u.exec(line)
      ?? /"binary"\s*:\s*"([^"]+)"/u.exec(line);
    if (processMatch && decomposedPattern.test(processMatch[1])) {
      warnings.push(`topology uses decomposed ingress process: ${processMatch[1]}`);
    }
  }
  return [...new Set(warnings)];
}

function countStubMounts(root, routeCrates) {
  let stubCount = 0;
  for (const crate of routeCrates) {
    if (!routeCrateExpectsDelegatableMount(root, crate.memberDir)) {
      continue;
    }
    const libRs = readText(path.join(root, crate.memberDir, 'src', 'lib.rs'));
    const mountBody = /pub\s+(?:async\s+)?fn\s+gateway_mount[\s\S]*?\{([\s\S]*?)^\}/mu.exec(libRs);
    if (!mountBody) {
      continue;
    }
    if (/Router::new\(\)/u.test(mountBody[1]) && !/build_/u.test(mountBody[1])) {
      stubCount += 1;
    }
  }
  return stubCount;
}

export function auditGatewayAlignmentRepo(root) {
  const applicationCode = resolveApplicationCode(root);
  const routeCrates = discoverRouteCrates(root, applicationCode);
  const issues = [];
  const warnings = [];

  if (routeCrates.length === 0) {
    return {
      applicationCode,
      category: 'no-route-crates',
      routeCrates: 0,
      score: 'skip',
      issues,
      warnings,
    };
  }

  const validation = validateGatewayAssembly(root);
  issues.push(...validation.errors);
  warnings.push(...validation.warnings);

  const assemblyDir = path.join(root, assemblyCrateDir(applicationCode));
  if (!fs.existsSync(assemblyDir)) {
    issues.push(`missing ${assemblyCrateDir(applicationCode)}`);
  }
  if (!fs.existsSync(path.join(assemblyDir, 'assembly-manifest.json'))) {
    issues.push('missing assembly-manifest.json');
  }

  const workspaceMember = hasWorkspaceMember(root, applicationCode);
  if (workspaceMember === false) {
    issues.push('gateway-assembly not in Cargo workspace members');
  }

  if (!hasGatewayScripts(root)) {
    issues.push('missing scripts/gateway/assembly-*.mjs');
  }
  if (!hasPackageScript(root, 'gateway:assembly:materialize')) {
    warnings.push('missing pnpm gateway:assembly:materialize');
  }
  if (!hasPackageScript(root, 'gateway:assembly:validate')) {
    warnings.push('missing pnpm gateway:assembly:validate');
  }

  const gatewayCrates = hasStandaloneOrCloudGateway(root, applicationCode);
  const hasAssemblyDep = Object.keys(gatewayCrates).some((name) => {
    if (!name.includes('gateway') && !name.includes('api-server')) {
      return false;
    }
    const cargoPath = path.join(
      root,
      name.includes('standalone') || name.includes('cloud') || name.includes('api-server')
        ? (fs.existsSync(path.join(root, 'crates', name)) ? 'crates' : 'services')
        : 'crates',
      name,
      'Cargo.toml',
    );
    const cargo = readText(cargoPath);
    return cargo.includes(assemblyPackageName(applicationCode));
  });

  if (Object.keys(gatewayCrates).length > 0 && !hasAssemblyDep) {
    warnings.push('gateway/api-server crate does not depend on gateway-assembly');
  }

  const mergeHits = scanForbiddenGatewayMerges(
    findGatewaySourceFiles(root, applicationCode),
    assemblyCrateDir(applicationCode),
  );
  for (const hit of mergeHits) {
    issues.push(`forbidden hand route merge: ${hit}`);
  }

  const stubCount = countStubMounts(root, routeCrates);
  if (stubCount > 0) {
    warnings.push(`${stubCount} route crates use stub gateway_mount (Router::new())`);
  }

  const bootstrapPath = path.join(assemblyDir, 'src', 'bootstrap.rs');
  if (fs.existsSync(bootstrapPath)) {
    const bootstrap = readText(bootstrapPath);
    if (bootstrapHasTodoMacro(bootstrap)) {
      issues.push('gateway-assembly bootstrap.rs still contains todo!()');
    }
  } else if (routeCrates.some((crate) => crate.hasGatewayMount)) {
    const allStub = stubCount === routeCrates.length;
    if (allStub) {
      warnings.push('no bootstrap.rs; all route mounts are stubs');
    }
  }

  warnings.push(...topologyIngressWarnings(root));

  const score = issues.length === 0
    ? (warnings.length === 0 ? 'perfect' : 'warn')
    : 'fail';

  return {
    applicationCode,
    category: 'route-crates',
    routeCrates: routeCrates.length,
    gatewayCrates: Object.keys(gatewayCrates),
    score,
    issues,
    warnings,
  };
}

function main() {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const report = auditGatewayAlignmentRepo(root);
  console.log(JSON.stringify(report, null, 2));
  if (report.score === 'fail') {
    process.exit(1);
  }
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
