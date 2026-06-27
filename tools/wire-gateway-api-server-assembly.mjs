#!/usr/bin/env node
/**
 * Wire standalone/cloud gateway crates to sdkwork-<app>-gateway-assembly.
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.7
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  assemblyPackageName,
  readText,
  resolveApplicationCode,
} from './gateway-assembly-lib.mjs';
import { auditGatewayAlignmentRepo } from './audit-gateway-alignment-repo.mjs';

const HOST_FRAMEWORK_PATTERN =
  /let\s+(\w+)\s*=\s*Arc::new\((\w+)::new\(\)\.await\);[\s\S]*?\.merge\(build_\w+_router_with_framework\(\1\.clone\(\)\)\.await\)[\s\S]*?\.merge\(build_\w+_router_with_framework\(\1\)\.await\)/u;

function findGatewayCargoPath(root, applicationCode) {
  const names = [
    `sdkwork-${applicationCode}-standalone-gateway`,
    `sdkwork-${applicationCode}-cloud-gateway`,
  ];
  for (const base of ['crates', 'services']) {
    for (const name of names) {
      const cargoPath = path.join(root, base, name, 'Cargo.toml');
      if (fs.existsSync(cargoPath)) {
        return cargoPath;
      }
    }
  }
  return null;
}

function assemblyRelativePath(cargoPath, packageName) {
  const gatewayDir = path.dirname(cargoPath);
  const parentDir = path.dirname(gatewayDir);
  const assemblyDir = path.join(parentDir, packageName);
  return path.relative(gatewayDir, assemblyDir).split(path.sep).join('/');
}

function ensureAssemblyDependency(cargoPath, applicationCode) {
  const packageName = assemblyPackageName(applicationCode);
  const libName = packageName.replace(/-/gu, '_');
  let cargo = readText(cargoPath);
  const assemblyRelative = assemblyRelativePath(cargoPath, packageName);
  const depLine = `${libName} = { package = "${packageName}", path = "${assemblyRelative}" }`;

  if (cargo.includes(packageName)) {
    const broken = /path\s*=\s*"\.\.\/[^"]*\\/u.test(cargo);
    if (!broken) {
      return false;
    }
    cargo = cargo.replace(
      new RegExp(`${libName}\\s*=\\s*\\{[^}]+\\}`, 'u'),
      depLine,
    );
    fs.writeFileSync(cargoPath, cargo, 'utf8');
    return true;
  }

  if (cargo.includes('[dependencies]')) {
    cargo = cargo.replace(/\[dependencies\]\s*\n/u, `[dependencies]\n${depLine}\n`);
  } else {
    cargo += `\n[dependencies]\n${depLine}\n`;
  }
  fs.writeFileSync(cargoPath, cargo, 'utf8');
  return true;
}

function wireHostFrameworkMain(mainPath, applicationCode) {
  const source = readText(mainPath);
  if (source.includes('gateway_assembly::assemble_application_router')) {
    return false;
  }
  const match = HOST_FRAMEWORK_PATTERN.exec(source);
  if (!match) {
    return false;
  }
  const hostVar = match[1];
  const hostType = match[2];
  const libName = assemblyPackageName(applicationCode).replace(/-/gu, '_');
  let updated = source.replace(
    /^use sdkwork_routes_[^\n]+\n/gm,
    '',
  );
  updated = updated.replace(
    /^use axum::Router;\n/u,
    'use axum::Router;\n',
  );
  if (!updated.includes(`use ${libName}::assemble_application_router`)) {
    updated = updated.replace(
      /^(use axum::Router;\n)/u,
      `$1use ${libName}::assemble_application_router;\n`,
    );
  }
  const businessBlock = /let business = Router::new\(\)[\s\S]*?\.layer\(CorsLayer::permissive\(\)\);/u.exec(updated);
  if (!businessBlock) {
    return false;
  }
  updated = updated.replace(
    businessBlock[0],
    `let business = assemble_application_router(${hostVar}).await.router\n        .layer(CorsLayer::permissive());`,
  );
  fs.writeFileSync(mainPath, updated, 'utf8');
  return true;
}

function wireRepo(root) {
  const applicationCode = resolveApplicationCode(root);
  const auditBefore = auditGatewayAlignmentRepo(root);
  if (auditBefore.score === 'skip' || auditBefore.score === 'perfect') {
    return { repo: path.basename(root), changed: false, score: auditBefore.score };
  }

  let changed = false;
  const cargoPath = findGatewayCargoPath(root, applicationCode);
  if (cargoPath && ensureAssemblyDependency(cargoPath, applicationCode)) {
    changed = true;
  }

  const mainPath = cargoPath ? path.join(path.dirname(cargoPath), 'src', 'main.rs') : null;
  if (mainPath && fs.existsSync(mainPath) && wireHostFrameworkMain(mainPath, applicationCode)) {
    changed = true;
  }

  const auditAfter = auditGatewayAlignmentRepo(root);
  return {
    repo: path.basename(root),
    applicationCode,
    changed,
    score: auditAfter.score,
    warnings: auditAfter.warnings,
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
    console.log('Usage: node tools/wire-gateway-api-server-assembly.mjs [--workspace <path>] [--root <repo>]');
    process.exit(0);
  }

  const targets = values.root ? [path.resolve(values.root)] : discoverRepos(values.workspace);
  const results = targets.map((repoRoot) => wireRepo(repoRoot));
  const improved = results.filter((item) => item.score === 'perfect');
  const changed = results.filter((item) => item.changed);
  console.log(`wire-gateway-api-server-assembly: ${changed.length} repos changed, ${improved.length} perfect`);
  for (const item of results.filter((entry) => entry.score === 'warn' || entry.score === 'fail')) {
    if (item.warnings?.length) {
      console.log(`warn ${item.repo}: ${item.warnings.join('; ')}`);
    }
  }
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
