#!/usr/bin/env node
/**
 * Validate gateway assembly parity and thin-gateway merge rules.
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.7, TEST_SPEC.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  assemblyCrateDir,
  buildAssemblyManifest,
  discoverRouteCrates,
  findGatewaySourceFiles,
  readJson,
  readText,
  resolveApplicationCode,
  scanAssemblyInfraMergeViolations,
  scanForbiddenGatewayMerges,
  assemblyMountRouteCrates,
  usesKernelBridgeAssembly,
} from './gateway-assembly-lib.mjs';
import { classifyRouteRegistry } from './lib/route-registry.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = path.resolve(SPECS_ROOT, '..');

function usage() {
  return [
    'Usage: node tools/validate-gateway-assembly.mjs [--root <repo>] [--strict]',
    '',
    'Fails when route crates exist without an assembly crate, assembly-manifest.json drifts,',
    'or standalone/cloud gateway sources hand-merge sdkwork route crates.',
  ].join('\n');
}

function compareManifests(expected, actual) {
  const errors = [];
  const expectedPackages = expected.routeCrates.map((item) => item.packageName).sort();
  const actualPackages = (actual?.routeCrates ?? []).map((item) => item.packageName).sort();
  if (JSON.stringify(expectedPackages) !== JSON.stringify(actualPackages)) {
    errors.push(
      `assembly-manifest.json route crate list drift (expected ${expectedPackages.length}, got ${actualPackages.length})`,
    );
  }
  if (actual?.packageName && actual.packageName !== expected.packageName) {
    errors.push(`assembly-manifest.json packageName mismatch: ${actual.packageName}`);
  }
  return errors;
}

export function validateGatewayAssembly(root, { strict = false } = {}) {
  const applicationCode = resolveApplicationCode(root);
  const routeCrates = discoverRouteCrates(root, applicationCode);
  if (routeCrates.length === 0) {
    return { ok: true, skipped: true, applicationCode, message: 'no route crates' };
  }

  const errors = [];
  const warnings = [];
  const crateDir = assemblyCrateDir(applicationCode);
  const crateRoot = path.join(root, crateDir);

  if (!fs.existsSync(crateRoot)) {
    errors.push(`missing ${crateDir}`);
    return { ok: false, applicationCode, errors, warnings };
  }

  const manifestPath = path.join(crateRoot, 'assembly-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    errors.push(`missing ${crateDir}/assembly-manifest.json (run gateway:assembly:materialize)`);
  } else {
    const expected = buildAssemblyManifest(root, applicationCode, routeCrates);
    const actual = readJson(manifestPath);
    errors.push(...compareManifests(expected, actual));
  }

  const bootstrapPath = path.join(crateRoot, 'src', 'bootstrap.rs');
  const bootstrapSource = readText(bootstrapPath);

  const withoutMount = assemblyMountRouteCrates(routeCrates).filter(
    (crate) => !crate.hasGatewayMount,
  );
  const kernelBridge = usesKernelBridgeAssembly(bootstrapSource);
  if (withoutMount.length > 0 && !kernelBridge) {
    warnings.push(
      `${withoutMount.length} route crates missing gateway_mount: ${withoutMount
        .map((crate) => crate.packageName)
        .join(', ')}`,
    );
  } else if (withoutMount.length > 0 && kernelBridge) {
    warnings.push(
      `${withoutMount.length} route crates use kernel-bridge composition instead of gateway_mount (approved for sdkwork-agents)`,
    );
  }

  const gatewayFiles = findGatewaySourceFiles(root, applicationCode);
  const mergeHits = scanForbiddenGatewayMerges(gatewayFiles, crateDir);
  for (const hit of mergeHits) {
    errors.push(`forbidden hand route merge in gateway source: ${hit}`);
  }

  if (bootstrapSource.trim()) {
    errors.push(...scanAssemblyInfraMergeViolations(bootstrapSource, routeCrates));
  }

  errors.push(...classifyRouteRegistry(root).map((issue) => `${issue.kind}: ${issue.detail}`));

  if (strict && warnings.length > 0) {
    errors.push(...warnings.map((warning) => `strict: ${warning}`));
  }

  return {
    ok: errors.length === 0,
    applicationCode,
    routeCrates: routeCrates.length,
    errors,
    warnings,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: DEFAULT_ROOT },
      strict: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const root = path.resolve(values.root);
  const result = validateGatewayAssembly(root, { strict: values.strict });
  if (result.skipped) {
    console.log(`gateway-assembly:validate skipped for ${root} (${result.message})`);
    process.exit(0);
  }

  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`error: ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `gateway-assembly:validate passed for sdkwork-${result.applicationCode} (${result.routeCrates} route crates)`,
  );
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
