#!/usr/bin/env node
/**
 * Retire application `*-api-server` listener crates.
 * Renames to `sdkwork-api-<application-code>-standalone-gateway` and rewrites references.
 *
 * Authority: APPLICATION_GATEWAY_SPEC.md section 10, NAMING_SPEC.md section 4.3.1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { listWorkspaceRepositories } from './align-repository-docs-lib.mjs';
import { readText, resolveApplicationCode } from './api-assembly-lib.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'target',
  'target-alt',
  'target-rust-tests',
  'target-verify',
  'dist',
  'artifacts',
  '.pnpm-store',
  'vendor',
  'external',
  '.runtime',
]);

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.mjs',
  '.js',
  '.ts',
  '.tsx',
  '.rs',
  '.toml',
  '.yaml',
  '.yml',
  '.env',
  '.sql',
  '.sh',
  '.ps1',
  '.xml',
  '.html',
  '.css',
  '.cfg',
  '.ini',
  '.properties',
]);

/** Irregular crate renames (old package dir name → new package dir name). */
const CRATE_TARGET_BY_NAME = {
  'sdkwork-webserver-api-server': 'sdkwork-api-web-standalone-gateway',
  'sdkwork-deploy-api-server': 'sdkwork-api-deployments-standalone-gateway',
  'sdkwork-clawrouter-app-api-server': 'sdkwork-api-clawrouter-standalone-gateway',
  'sdkwork-clawrouter-admin-api-server': 'sdkwork-clawrouter-admin-gateway',
};

const PLATFORM_LISTENER_CRATE = 'sdkwork-api-cloud-gateway-api-server';

function usage() {
  return [
    'Usage: node tools/migrate-retire-api-server.mjs [--workspace <path>] [--repo <name>] [--dry-run]',
    '',
    'Renames *-api-server listener crates to *-standalone-gateway and updates references.',
    'Platform listener merges into sdkwork-api-cloud-gateway (listener module + bin).',
  ].join('\n');
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) {
      continue;
    }
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function shouldProcessFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return false;
  }
  if (file.includes(`${path.sep}node_modules${path.sep}`)) {
    return false;
  }
  if (file.includes(`${path.sep}target${path.sep}`)) {
    return false;
  }
  try {
    const { size } = fs.statSync(file);
    if (size > 2 * 1024 * 1024) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function toLibName(crateName) {
  return crateName.replace(/-/gu, '_');
}

function targetCrateName(oldCrateName, applicationCode) {
  if (CRATE_TARGET_BY_NAME[oldCrateName]) {
    return CRATE_TARGET_BY_NAME[oldCrateName];
  }
  if (oldCrateName === PLATFORM_LISTENER_CRATE) {
    return null;
  }
  return `sdkwork-api-${applicationCode}-standalone-gateway`;
}

function findApiServerCrates(repoRoot) {
  const hits = [];
  for (const base of ['crates', 'services']) {
    const baseDir = path.join(repoRoot, base);
    if (!fs.existsSync(baseDir)) {
      continue;
    }
    for (const name of fs.readdirSync(baseDir)) {
      if (!name.endsWith('-api-server') && name !== PLATFORM_LISTENER_CRATE) {
        continue;
      }
      if (!name.startsWith('sdkwork-')) {
        continue;
      }
      const full = path.join(baseDir, name);
      if (!fs.statSync(full).isDirectory()) {
        continue;
      }
      if (!fs.existsSync(path.join(full, 'Cargo.toml'))) {
        continue;
      }
      hits.push({ base, name, path: full });
    }
  }
  return hits;
}

function normalizeStandaloneCargo(cargoPath, targetCrateName, dryRun) {
  let cargo = readText(cargoPath);
  const appCode = targetCrateName.replace(/^sdkwork-|-standalone-gateway$/gu, '');
  const binName = targetCrateName;
  const libName = toLibName(targetCrateName);

  cargo = cargo.replace(/^name\s*=\s*"[^"]+"/mu, `name = "${targetCrateName}"`);
  if (/\[lib\]/u.test(cargo)) {
    cargo = cargo.replace(
      /(\[lib\][\s\S]*?^name\s*=\s*)"[^"]+"/mu,
      `$1"${libName}"`,
    );
  }

  const binBlocks = [...cargo.matchAll(/\[\[bin\]\][\s\S]*?(?=\n\[|\n*$)/gu)];
  let mainPath = 'src/main.rs';
  for (const block of binBlocks) {
    const pathMatch = /path\s*=\s*"([^"]+)"/u.exec(block[0]);
    if (pathMatch) {
      mainPath = pathMatch[1];
      break;
    }
  }

  for (const block of binBlocks) {
    cargo = cargo.replace(block[0], '');
  }

  const binSection = `\n[[bin]]\nname = "${binName}"\npath = "${mainPath}"\n`;
  if (cargo.includes('[dependencies]')) {
    cargo = cargo.replace(/\[dependencies\]/u, `${binSection}\n[dependencies]`);
  } else {
    cargo += binSection;
  }

  cargo = cargo.replace(/\n{3,}/gu, '\n\n');
  if (!dryRun) {
    fs.writeFileSync(cargoPath, cargo, 'utf8');
  }
  return `normalized bins → ${binName}`;
}

function updateWorkspaceMembers(repoRoot, oldMember, newMember, dryRun) {
  const cargoPath = path.join(repoRoot, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) {
    return null;
  }
  let cargo = readText(cargoPath);
  const oldQuoted = `"${oldMember}"`;
  if (!cargo.includes(oldQuoted)) {
    return null;
  }
  if (newMember) {
    cargo = cargo.split(oldQuoted).join(`"${newMember}"`);
    if (!dryRun) {
      fs.writeFileSync(cargoPath, cargo, 'utf8');
    }
    return `workspace member ${oldMember} → ${newMember}`;
  }
  cargo = cargo.replace(new RegExp(`\\s*${oldQuoted.replace(/\//gu, '\\/')},?\\n`, 'gu'), '\n');
  if (!dryRun) {
    fs.writeFileSync(cargoPath, cargo, 'utf8');
  }
  return `removed workspace member ${oldMember}`;
}

function buildReplacements(oldCrateName, newCrateName) {
  const pairs = [
    [oldCrateName, newCrateName],
    [toLibName(oldCrateName), toLibName(newCrateName)],
  ];
  const appFromOld = oldCrateName.replace(/^sdkwork-|-api-server$/gu, '');
  const appFromNew = newCrateName.replace(/^sdkwork-|-standalone-gateway$/gu, '');
  if (appFromOld !== appFromNew) {
    pairs.push([`sdkwork-${appFromOld}-api-server`, newCrateName]);
    pairs.push([`sdkwork_${appFromOld}_api_server`, toLibName(newCrateName)]);
  }
  return pairs;
}

function migratePlatformListener(repoRoot, crate, dryRun, actions) {
  const listenerLib = path.join(crate.path, 'src', 'lib.rs');
  const listenerMain = path.join(crate.path, 'src', 'main.rs');
  const gatewayCrate = path.join(repoRoot, 'crates', 'sdkwork-api-cloud-gateway');
  const gatewayCargo = path.join(gatewayCrate, 'Cargo.toml');
  if (!fs.existsSync(listenerMain) || !fs.existsSync(gatewayCargo)) {
    actions.push(`${path.basename(repoRoot)}: skip platform merge (missing paths)`);
    return;
  }

  const listenerDest = path.join(gatewayCrate, 'src', 'listener_main.rs');
  const libDest = path.join(gatewayCrate, 'src', 'service_config_loader.rs');
  if (!dryRun) {
    if (fs.existsSync(listenerLib)) {
      fs.copyFileSync(listenerLib, libDest);
    }
    fs.copyFileSync(listenerMain, listenerDest);
    let gatewayCargoText = readText(gatewayCargo);
    if (!gatewayCargoText.includes('[[bin]]')) {
      gatewayCargoText += `\n[[bin]]\nname = "sdkwork-api-cloud-gateway"\npath = "src/listener_main.rs"\n`;
      fs.writeFileSync(gatewayCargo, gatewayCargoText, 'utf8');
    }
    fs.rmSync(crate.path, { recursive: true, force: true });
  }
  updateWorkspaceMembers(
    repoRoot,
    'crates/sdkwork-api-cloud-gateway-api-server',
    null,
    dryRun,
  );
  const rootCargo = path.join(repoRoot, 'Cargo.toml');
  if (fs.existsSync(rootCargo)) {
    let cargo = readText(rootCargo);
    cargo = cargo.replace(/\s*"crates\/sdkwork-api-cloud-gateway-api-server",?\n/u, '\n');
    if (!dryRun) {
      fs.writeFileSync(rootCargo, cargo, 'utf8');
    }
  }
  actions.push(
    `${path.basename(repoRoot)}: platform listener merged into sdkwork-api-cloud-gateway (manual lib import fix may be required)`,
  );
}

function migrateRepo(repoRoot, { dryRun }) {
  const applicationCode = resolveApplicationCode(repoRoot);
  const actions = [];
  const replacementPairs = [];
  const crates = findApiServerCrates(repoRoot);

  for (const crate of crates) {
    if (crate.name === PLATFORM_LISTENER_CRATE) {
      migratePlatformListener(repoRoot, crate, dryRun, actions);
      replacementPairs.push(
        ...buildReplacements(PLATFORM_LISTENER_CRATE, 'sdkwork-api-cloud-gateway'),
      );
      replacementPairs.push(['sdkwork_api_cloud_gateway_api_server', 'sdkwork_api_cloud_gateway']);
      continue;
    }

    const newName = targetCrateName(crate.name, applicationCode);
    if (!newName) {
      continue;
    }

    const parentDir = path.dirname(crate.path);
    const targetPath = path.join(parentDir, newName);
    const oldMember = `${crate.base}/${crate.name}`;
    const newMember = `${crate.base}/${newName}`;

    if (fs.existsSync(targetPath) && path.resolve(targetPath) !== path.resolve(crate.path)) {
      actions.push(
        `${path.basename(repoRoot)}: retire ${oldMember} (${newMember} already exists)`,
      );
      if (!dryRun) {
        fs.rmSync(crate.path, { recursive: true, force: true });
      }
      const memberAction = updateWorkspaceMembers(repoRoot, oldMember, null, dryRun);
      if (memberAction) {
        actions.push(`${path.basename(repoRoot)}: ${memberAction}`);
      }
      const rootCargo = path.join(repoRoot, 'Cargo.toml');
      if (fs.existsSync(rootCargo)) {
        let cargo = readText(rootCargo);
        const oldQuoted = `"${oldMember}"`;
        if (cargo.includes(oldQuoted)) {
          cargo = cargo.replace(new RegExp(`\\s*${oldQuoted.replace(/\//gu, '\\/')},?\\n`, 'gu'), '\n');
          if (!dryRun) {
            fs.writeFileSync(rootCargo, cargo, 'utf8');
          }
        }
      }
      replacementPairs.push(...buildReplacements(crate.name, newName));
      continue;
    }

    if (path.resolve(crate.path) !== path.resolve(targetPath)) {
      if (dryRun) {
        actions.push(`${path.basename(repoRoot)}: would rename ${oldMember} → ${newMember}`);
      } else {
        try {
          fs.renameSync(crate.path, targetPath);
        } catch (error) {
          if (error?.code === 'EPERM' || error?.code === 'EBUSY') {
            fs.cpSync(crate.path, targetPath, { recursive: true });
            fs.rmSync(crate.path, { recursive: true, force: true });
          } else {
            throw error;
          }
        }
        actions.push(`${path.basename(repoRoot)}: renamed ${oldMember} → ${newMember}`);
      }
    } else {
      actions.push(`${path.basename(repoRoot)}: crate path already ${newName}`);
    }

    const cargoPath = path.join(targetPath, 'Cargo.toml');
    const norm = normalizeStandaloneCargo(cargoPath, newName, dryRun);
    actions.push(`${path.basename(repoRoot)}: ${norm}`);

    const memberAction = updateWorkspaceMembers(repoRoot, oldMember, newMember, dryRun);
    if (memberAction) {
      actions.push(`${path.basename(repoRoot)}: ${memberAction}`);
    }

    replacementPairs.push(...buildReplacements(crate.name, newName));
  }

  const uniquePairs = [];
  const seen = new Set();
  for (const [from, to] of replacementPairs) {
    const key = `${from}→${to}`;
    if (seen.has(key) || from === to) {
      continue;
    }
    seen.add(key);
    uniquePairs.push([from, to]);
  }
  uniquePairs.sort((a, b) => b[0].length - a[0].length);

  let changedFiles = 0;
  for (const file of walkFiles(repoRoot)) {
    if (!shouldProcessFile(file)) {
      continue;
    }
    if (file.includes('migrate-retire-api-server.mjs')) {
      continue;
    }
    let content = readText(file);
    let next = content;
    for (const [from, to] of uniquePairs) {
      next = next.split(from).join(to);
    }
    if (next !== content) {
      changedFiles += 1;
      if (!dryRun) {
        fs.writeFileSync(file, next, 'utf8');
      }
    }
  }

  return { actions, changedFiles };
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      repo: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const workspace = path.resolve(values.workspace);
  const dryRun = values['dry-run'];
  const repos = values.repo
    ? [path.join(workspace, values.repo)]
    : listWorkspaceRepositories(workspace, { prefix: 'sdkwork-' });

  let totalFiles = 0;
  for (const repoRoot of repos) {
    if (!fs.existsSync(repoRoot)) {
      continue;
    }
    const { actions, changedFiles } = migrateRepo(repoRoot, { dryRun });
    if (actions.length === 0 && changedFiles === 0) {
      continue;
    }
    console.log(`\n${path.basename(repoRoot)}${dryRun ? ' (dry-run)' : ''}`);
    for (const line of actions) {
      console.log(`  ${line}`);
    }
    console.log(`  text files touched: ${changedFiles}`);
    totalFiles += changedFiles;
  }

  console.log(`\nDone. Text files updated: ${totalFiles}${dryRun ? ' (dry-run)' : ''}`);
}

main();
