#!/usr/bin/env node
/**
 * Materialize sdkwork-<application-code>-gateway-assembly from workspace discovery.
 * Authority: APPLICATION_GATEWAY_SPEC.md §5.7
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  assemblyCrateDir,
  assemblyPackageName,
  buildAssemblyManifest,
  discoverGatewayBusinessMounts,
  discoverGatewayMounts,
  discoverRouteCrates,
  readText,
  resolveApplicationCode,
} from './gateway-assembly-lib.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_ROOT = path.resolve(SPECS_ROOT, '..');

function usage() {
  return [
    'Usage: node tools/materialize-gateway-assembly.mjs [--root <repo>]',
    '',
    'Discovers crates/sdkwork-routes-<application-code>-* workspace members and writes',
    'crates/sdkwork-<application-code>-gateway-assembly/assembly-manifest.json plus',
    'generated Cargo.toml when the assembly crate does not yet exist.',
  ].join('\n');
}

function writeFileEnsuringDir(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function extractPreservedDependencies(cargoToml, applicationCode) {
  const depsSection = /\[dependencies\]([\s\S]*?)(?:\n\[|$)/u.exec(cargoToml);
  if (!depsSection) {
    return '';
  }
  const routePackagePattern = new RegExp(
    `package\\s*=\\s*"sdkwork-routes-${applicationCode}-`,
    'u',
  );
  const routeKeyPattern = new RegExp(`^\\s*sdkwork_routes_${applicationCode.replace(/-/gu, '_')}`, 'u');

  return depsSection[1]
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      if (/^\s*axum\.workspace\s*=/u.test(line)) {
        return false;
      }
      if (/^\s*tokio\s*=/u.test(line)) {
        return false;
      }
      if (/^\s*sqlx\.workspace\s*=/u.test(line)) {
        return false;
      }
      if (routeKeyPattern.test(line) || routePackagePattern.test(line)) {
        return false;
      }
      return true;
    })
    .join('\n');
}

function readWorkspacePackageFields(repoRoot) {
  const cargoPath = path.join(repoRoot, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) {
    return {};
  }
  const raw = fs.readFileSync(cargoPath, 'utf8').replace(/^\uFEFF/u, '');
  const fields = {};
  const section = raw.match(/\[workspace\.package\]([\s\S]*?)(?:\n\[|$)/u);
  if (!section) {
    return fields;
  }
  for (const line of section[1].split('\n')) {
    const match = line.match(/^(\w+)\s*=/u);
    if (match) {
      fields[match[1]] = true;
    }
  }
  return fields;
}

function resolveAssemblyBootstrapDeps(mounts, workspaceDepNames) {
  const lines = [];
  const withMount = mounts.filter((item) => item.mount);
  const paramBlob = withMount.map((item) => item.mount.params).join(',');
  if (paramBlob.includes('sqlx::AnyPool') && workspaceDepNames.has('sqlx')) {
    lines.push('sqlx.workspace = true');
  }
  if (paramBlob.includes('AccountServiceHost')) {
    if (workspaceDepNames.has('sdkwork-account-service-host')) {
      lines.push('sdkwork-account-service-host = { workspace = true }');
    }
  }
  return lines;
}

function readWorkspaceDependencyNames(repoRoot) {
  const cargoPath = path.join(repoRoot, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) {
    return new Set();
  }
  const raw = fs.readFileSync(cargoPath, 'utf8').replace(/^\uFEFF/u, '');
  const section = raw.match(/\[workspace\.dependencies\]([\s\S]*?)(?:\n\[|$)/u);
  if (!section) {
    return new Set();
  }
  const names = new Set();
  for (const line of section[1].split('\n')) {
    const match = line.match(/^([^\s#=]+)\s*=/u);
    if (match) {
      names.add(match[1]);
    }
  }
  return names;
}

function renderCargoToml(
  applicationCode,
  routeCrates,
  preservedDeps = '',
  workspaceFields = {},
  bootstrapDeps = [],
) {
  const packageName = assemblyPackageName(applicationCode);
  const licenseLine = workspaceFields.license ? 'license.workspace = true\n' : '';
  const depLines = routeCrates
    .map((crate) => {
      const relPath = path.posix.relative(assemblyCrateDir(applicationCode), crate.memberDir);
      return `${crate.libName} = { package = "${crate.packageName}", path = "${relPath}" }`;
    })
    .join('\n');
  const preservedBlock = preservedDeps.trim() ? `${preservedDeps.trim()}\n` : '';
  const bootstrapDepBlock =
    bootstrapDeps.length > 0 ? `${[...new Set(bootstrapDeps)].join('\n')}\n` : '';

  return `[package]
name = "${packageName}"
edition.workspace = true
${licenseLine}version.workspace = true
description = "Generated gateway assembly for sdkwork-${applicationCode} application HTTP plane."

[lib]
name = "${packageName.replace(/-/gu, '_')}"
path = "src/lib.rs"

[dependencies]
axum.workspace = true
tokio = { version = "1.48", features = ["macros", "rt-multi-thread"] }
${bootstrapDepBlock}${preservedBlock}${depLines ? `${depLines}\n` : ''}`;
}

function renderLibRs(applicationCode, routeCrates, bootstrapExists) {
  if (bootstrapExists) {
    return `//! Gateway assembly for sdkwork-${applicationCode}.
//! Application bootstrap lives in \`bootstrap.rs\`; route inventory is in \`assembly-manifest.json\`.

mod bootstrap;
mod generated;

pub use bootstrap::{assemble_application_router, ApplicationAssembly};

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
`;
  }

  const mountLines = routeCrates
    .filter((crate) => crate.hasGatewayMount)
    .map((crate) => `    router = router.merge(${crate.libName}::gateway_mount());`)
    .join('\n');

  if (mountLines) {
    return `//! Generated gateway assembly for sdkwork-${applicationCode}.

mod generated;

pub struct ApplicationAssembly {
    pub router: axum::Router,
}

pub async fn assemble_application_router() -> ApplicationAssembly {
    let mut router = axum::Router::new();
${mountLines}
    ApplicationAssembly { router }
}

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
`;
  }

  return `//! Gateway assembly scaffold for sdkwork-${applicationCode}.
//! Implement \`bootstrap.rs\` with application-specific service wiring until every route crate exports \`gateway_mount\`.

mod bootstrap;
mod generated;

pub use bootstrap::{assemble_application_router, ApplicationAssembly};

pub fn assembly_route_count() -> usize {
    generated::ROUTE_CRATE_COUNT
}
`;
}

function renderGeneratedRs(routeCrates) {
  const names = routeCrates.map((crate) => `    "${crate.packageName}",`).join('\n');
  return `//! Generated route inventory. Do not edit by hand; run pnpm gateway:assembly:materialize.

pub const ROUTE_CRATE_COUNT: usize = ${routeCrates.length};

#[allow(dead_code)]
pub const ROUTE_CRATE_PACKAGES: &[&str] = &[
${names}
];
`;
}

function bootstrapHasTodoMacro(bootstrapSource) {
  return bootstrapSource
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .some((line) => /todo!\s*\(/u.test(line));
}

function normalizeMountParams(params) {
  return params
    .split(',')
    .map((part) => part.trim().replace(/,\s*$/u, ''))
    .filter(Boolean)
    .join(', ');
}

function bootstrapNeedsRegeneration(bootstrapSource) {
  if (!bootstrapSource.trim() || bootstrapHasTodoMacro(bootstrapSource)) {
    return true;
  }
  if (!/Generated gateway bootstrap/u.test(bootstrapSource)) {
    return false;
  }
  const signatureMatch = /fn\s+assemble_application_router\s*\(([^)]*)\)/u.exec(bootstrapSource);
  const signatureParams = signatureMatch
    ? signatureMatch[1]
        .split(',')
        .map((part) => part.trim().split(':')[0].trim())
        .filter(Boolean)
    : [];
  const mountCalls = [...bootstrapSource.matchAll(/gateway_mount\(([^)]*)\)/gu)];
  for (const match of mountCalls) {
    const args = match[1]
      .split(',')
      .map((part) => part.trim().split('.')[0].trim())
      .filter(Boolean);
    for (const arg of args) {
      if (arg && !signatureParams.includes(arg)) {
        return true;
      }
    }
  }
  if (
    /gateway_mount\(pool\)\.await/u.test(bootstrapSource)
    && /gateway_mount\(pool\.clone\(\)\)/u.test(bootstrapSource)
  ) {
    return true;
  }
  return false;
}

function shouldPreserveBootstrap(bootstrapPath) {
  if (!fs.existsSync(bootstrapPath)) {
    return false;
  }
  const bootstrap = readText(bootstrapPath);
  if (bootstrapNeedsRegeneration(bootstrap)) {
    return false;
  }
  return bootstrap.trim().length > 0;
}

function renderBootstrapRs(applicationCode, mounts, root, routeCrates) {
  const withMount = mounts.filter((item) => item.mount);
  if (withMount.length === 0) {
    return renderBootstrapEmpty(applicationCode);
  }

  const infraSurfaces = routeCrates.filter((crate) => crate.mountsInfrastructure);
  const useBusinessMounts = withMount.length > 1 && infraSurfaces.length > 0;
  const businessMounts = useBusinessMounts
    ? discoverGatewayBusinessMounts(root, routeCrates).filter((item) => item.mount)
    : [];
  const activeMounts =
    useBusinessMounts && businessMounts.length > 0 ? businessMounts : withMount;
  const mountFn =
    useBusinessMounts && businessMounts.length > 0 ? 'gateway_mount_business' : 'gateway_mount';

  const paramSets = [
    ...new Set(activeMounts.map((item) => normalizeMountParams(item.mount.params))),
  ];
  const sharedParams = paramSets.length === 1 ? paramSets[0] : '';
  const needsAsync = activeMounts.some((item) => item.mount.async);
  const extraUses = new Set();
  if (useBusinessMounts && businessMounts.length > 0) {
    extraUses.add('use sdkwork_web_bootstrap::assemble_multi_surface_router;');
  }
  for (const item of activeMounts) {
    const libPath = path.join(root, item.memberDir, 'src', 'lib.rs');
    const libRs = fs.existsSync(libPath) ? readText(libPath) : '';
    for (const typeChunk of item.mount.params.split(',')) {
      if (typeChunk.includes('sqlx::AnyPool')) {
        extraUses.add('use sqlx::AnyPool;');
      }
      if (typeChunk.includes('Arc<')) {
        extraUses.add('use std::sync::Arc;');
      }
      const hostType = /Arc<([A-Za-z0-9_]+)>/u.exec(typeChunk)?.[1];
      if (hostType) {
        const importMatch = new RegExp(
          `^use\\s+([A-Za-z0-9_]+::${hostType})\\s*;`,
          'mu',
        ).exec(libRs);
        if (importMatch) {
          extraUses.add(`use ${importMatch[1]};`);
        } else {
          const hostCrate = `sdkwork_${applicationCode.replace(/-/gu, '_')}_service_host`;
          extraUses.add(`use ${hostCrate}::${hostType};`);
        }
      }
      if (typeChunk.includes('AccountServiceHost')) {
        extraUses.add('use sdkwork_account_service_host::AccountServiceHost;');
      }
    }
  }

  const mergeLines = activeMounts.map((item) => {
    const args = item.mount.paramNames
      .map((name) => {
        if (!sharedParams) {
          return name;
        }
        const occurrences = activeMounts.filter((other) =>
          other.mount.paramNames.includes(name),
        ).length;
        if (occurrences > 1) {
          return `${name}.clone()`;
        }
        return name;
      })
      .join(', ');
    const call = item.mount.async
      ? `${item.libName}::${mountFn}(${args}).await`
      : `${item.libName}::${mountFn}(${args})`;
    return `    router = router.merge(${call});`;
  });

  const bodyLines =
    useBusinessMounts && businessMounts.length > 0
      ? [
          '    let mut business = Router::new();',
          ...mergeLines.map((line) => line.replace('router = router.merge', 'business = business.merge')),
          '    let router = assemble_multi_surface_router(',
          '        [business],',
          '        sdkwork_web_bootstrap::ServiceRouterConfig::default().with_always_ready(),',
          '    );',
        ]
      : mergeLines;

  const fnSigParams = sharedParams ? sharedParams : '';
  const fnKeyword = needsAsync ? 'pub async fn' : 'pub fn';
  const extraUseBlock = [...extraUses].sort().join('\n');

  return `//! Generated gateway bootstrap for sdkwork-${applicationCode}.
//! Regenerated by pnpm gateway:assembly:materialize.
//!
//! Multi-surface merges mount shared infrastructure routes once at the assembly layer
//! so \`/healthz\`, \`/livez\`, \`/readyz\`, and \`/metrics\` are not duplicated per surface.

use axum::Router;
${extraUseBlock ? `${extraUseBlock}\n` : ''}
pub struct ApplicationAssembly {
    pub router: Router,
}

${fnKeyword} assemble_application_router(${fnSigParams}) -> ApplicationAssembly {
${useBusinessMounts && businessMounts.length > 0 ? '' : '    let mut router = Router::new();\n'}${bodyLines.join('\n')}
    ApplicationAssembly { router }
}
`;
}

function renderBootstrapEmpty(applicationCode) {
  return `//! Gateway bootstrap for sdkwork-${applicationCode}.

use axum::Router;

pub struct ApplicationAssembly {
    pub router: Router,
}

pub fn assemble_application_router() -> ApplicationAssembly {
    ApplicationAssembly {
        router: Router::new(),
    }
}
`;
}

export function materializeGatewayAssembly(root) {
  const applicationCode = resolveApplicationCode(root);
  const routeCrates = discoverRouteCrates(root, applicationCode);
  if (routeCrates.length === 0) {
    return {
      ok: false,
      applicationCode,
      message: `no crates/sdkwork-routes-${applicationCode}-* workspace members found`,
    };
  }

  const crateDir = path.join(root, assemblyCrateDir(applicationCode));
  const bootstrapPath = path.join(crateDir, 'src', 'bootstrap.rs');
  const preserveBootstrap = shouldPreserveBootstrap(bootstrapPath);
  const existingCargoToml = readText(path.join(crateDir, 'Cargo.toml'));
  const preservedDeps = extractPreservedDependencies(existingCargoToml, applicationCode);
  const manifest = buildAssemblyManifest(root, applicationCode, routeCrates);
  const mounts = discoverGatewayMounts(root, routeCrates);
  const workspaceDeps = readWorkspaceDependencyNames(root);
  const bootstrapDeps = resolveAssemblyBootstrapDeps(mounts, workspaceDeps);

  writeFileEnsuringDir(path.join(crateDir, 'assembly-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileEnsuringDir(
    path.join(crateDir, 'Cargo.toml'),
    renderCargoToml(
      applicationCode,
      routeCrates,
      preservedDeps,
      readWorkspacePackageFields(root),
      bootstrapDeps,
    ),
  );
  writeFileEnsuringDir(path.join(crateDir, 'src', 'generated.rs'), renderGeneratedRs(routeCrates));
  const bootstrapReady =
    fs.existsSync(bootstrapPath) && !bootstrapNeedsRegeneration(readText(bootstrapPath));
  writeFileEnsuringDir(
    path.join(crateDir, 'src', 'lib.rs'),
    renderLibRs(applicationCode, routeCrates, bootstrapReady),
  );

  if (!preserveBootstrap) {
    writeFileEnsuringDir(bootstrapPath, renderBootstrapRs(applicationCode, mounts, root, routeCrates));
  }

  return {
    ok: true,
    applicationCode,
    crateDir: assemblyCrateDir(applicationCode),
    routeCrates: routeCrates.length,
    bootstrapPreserved: preserveBootstrap,
    bootstrapRegenerated: !preserveBootstrap,
  };
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: DEFAULT_ROOT },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const root = path.resolve(values.root);
  const result = materializeGatewayAssembly(root);
  if (!result.ok) {
    console.error(`gateway-assembly:materialize skipped for ${root}: ${result.message}`);
    process.exit(0);
  }

  console.log(
    `gateway-assembly:materialize wrote ${result.crateDir} (${result.routeCrates} route crates${
      result.bootstrapPreserved ? ', bootstrap preserved' : ''
    })`,
  );
}

const entry = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === entry) {
  main();
}
