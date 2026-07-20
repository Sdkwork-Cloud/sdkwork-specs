#!/usr/bin/env node
/**
 * Align topology application.public-ingress to sdkwork-*-standalone-gateway binaries.
 * Authority: APPLICATION_GATEWAY_SPEC.md section 5, APP_RUNTIME_TOPOLOGY_SPEC.md section 8.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { readText } from './api-assembly-lib.mjs';
import { validateRepository } from './check-single-http-ingress.mjs';

const DECOMPOSED_INGRESS_BINARY =
  /(?:^|-)(?:app-api|backend-api|open-api|admin-api|api-server)$/u;

function findGatewayCrateDir(repoRoot, appId) {
  const appCode = appId.replace(/^sdkwork-/u, '');
  const preferred = [
    path.join(repoRoot, 'crates', `sdkwork-api-${appCode}-standalone-gateway`),
    path.join(repoRoot, 'crates', `sdkwork-${appCode}-standalone-gateway`),
    path.join(repoRoot, 'services', `sdkwork-${appCode}-standalone-gateway`),
  ];
  for (const candidate of preferred) {
    if (fs.existsSync(path.join(candidate, 'Cargo.toml'))) {
      return candidate;
    }
  }
  for (const base of ['crates', 'services']) {
    const dir = path.join(repoRoot, base);
    if (!fs.existsSync(dir)) {
      continue;
    }
    const standalone = fs
      .readdirSync(dir)
      .find((entry) => /-standalone-gateway$/u.test(entry) && fs.existsSync(path.join(dir, entry, 'Cargo.toml')));
    if (standalone) {
      return path.join(dir, standalone);
    }
  }
  return null;
}

function standaloneGatewayBinary(appId) {
  return `sdkwork-api-${appId.replace(/^sdkwork-/u, '')}-standalone-gateway`;
}

function ensureStandaloneBinAlias(gatewayCrateDir, standaloneBinary) {
  const cargoPath = path.join(gatewayCrateDir, 'Cargo.toml');
  const cargo = readText(cargoPath);
  if (new RegExp(`^name\\s*=\\s*"${standaloneBinary}"`, 'mu').test(cargo)) {
    return false;
  }
  const mainBin = /\[\[bin\]\]\s*\nname\s*=\s*"([^"]+)"\s*\npath\s*=\s*"([^"]+)"/u.exec(cargo);
  const mainPath = mainBin?.[2] ?? 'src/main.rs';
  const alias = `\n[[bin]]\nname = "${standaloneBinary}"\npath = "${mainPath}"\n`;
  fs.writeFileSync(cargoPath, `${cargo.trimEnd()}\n${alias}`, 'utf8');
  return true;
}

function shouldMigrateIngressBinary(binary) {
  if (!binary) {
    return false;
  }
  if (/-standalone-gateway$/u.test(binary)) {
    return false;
  }
  return DECOMPOSED_INGRESS_BINARY.test(binary) || /-app-api$/u.test(binary);
}

function alignTopologySpec(repoRoot) {
  const topologyPath = path.join(repoRoot, 'specs', 'topology.spec.json');
  if (!fs.existsSync(topologyPath)) {
    return { changed: false, reason: 'no topology.spec.json' };
  }

  const spec = JSON.parse(readText(topologyPath).replace(/^\uFEFF/u, ''));
  const appId = spec.appId ?? path.basename(repoRoot);
  const gatewayCrateDir = findGatewayCrateDir(repoRoot, appId);
  if (!gatewayCrateDir) {
    return { changed: false, reason: 'no gateway crate' };
  }

  const gatewayCrate = path.basename(gatewayCrateDir);
  const standaloneBinary = standaloneGatewayBinary(appId);
  let changed = false;

  const profiles = spec.orchestration?.profiles ?? {};
  for (const profile of Object.values(profiles)) {
    for (const processEntry of profile.processes ?? []) {
      if (processEntry.id !== 'application.public-ingress') {
        continue;
      }
      if (!shouldMigrateIngressBinary(String(processEntry.binary ?? ''))) {
        continue;
      }
      if (processEntry.binary !== standaloneBinary) {
        processEntry.binary = standaloneBinary;
        changed = true;
      }
      if (processEntry.crate !== gatewayCrate) {
        processEntry.crate = gatewayCrate;
        changed = true;
      }
    }
  }

  if (spec.components?.applicationServer) {
    const component = spec.components.applicationServer;
    if (shouldMigrateIngressBinary(String(component.binary ?? ''))) {
      if (component.binary !== standaloneBinary) {
        component.binary = standaloneBinary;
        changed = true;
      }
      if (component.crate !== gatewayCrate) {
        component.crate = gatewayCrate;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(topologyPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  }

  const binAdded = ensureStandaloneBinAlias(gatewayCrateDir, standaloneBinary);
  return {
    changed: changed || binAdded,
    appId,
    gatewayCrate,
    standaloneBinary,
    binAdded,
    topologyUpdated: changed,
  };
}

function discoverRepos(workspaceRoot) {
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspaceRoot, entry.name));
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..') },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/align-topology-public-ingress.mjs [--workspace <path>] [--root <repo>]');
    process.exit(0);
  }

  const targets = values.root ? [path.resolve(values.root)] : discoverRepos(values.workspace);
  let changedCount = 0;
  for (const repoRoot of targets) {
    const result = alignTopologySpec(repoRoot);
    if (!result.changed) {
      continue;
    }
    changedCount += 1;
    const validation = validateRepository(repoRoot);
    console.log(
      `aligned ${path.basename(repoRoot)} -> ${result.standaloneBinary} (${validation.warnings.length} ingress warnings remain)`,
    );
  }
  console.log(`align-topology-public-ingress: ${changedCount} repositories updated`);
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
