import fs from 'node:fs';
import path from 'node:path';

import {
  CANONICAL_HTTP_ROUTE_PREFIX,
  LEGACY_HTTP_ROUTE_PREFIX,
  legacyFoundationPcReactName,
} from './naming-patterns.mjs';

const SKIP_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  '.pnpm-store',
  'target',
  'dist',
  'artifacts',
  '.next',
  '.turbo',
]);

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.json',
  '.mjs',
  '.mts',
  '.d.mts',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.rs',
  '.toml',
  '.yaml',
  '.yml',
  '.ps1',
  '.py',
  '.sh',
  '.sql',
  '.css',
  '.scss',
  '.html',
  '.vue',
  '.gradle',
  '.properties',
  '.lock',
  '.service',
  '.example',
]);

const SKIP_FILE_NAMES = new Set([
  'route-crate-naming.mjs',
  'naming-patterns.mjs',
  'pnpm-lock.yaml',
]);

export function transformRouteCrateNamingText(content) {
  let out = content;
  const shortLegacyRouteCrates = [
    ['sdkwork-router-app-api', 'sdkwork-routes-clawrouter-app-api'],
    ['sdkwork-router-backend-api', 'sdkwork-routes-clawrouter-backend-api'],
    ['sdkwork-router-open-api', 'sdkwork-routes-clawrouter-open-api'],
  ];
  for (const [from, to] of shortLegacyRouteCrates) {
    if (out.includes(from)) {
      out = out.split(from).join(to);
    }
  }
  out = out.replace(/sdkwork_router_app_api/gu, 'sdkwork_routes_clawrouter_app_api');
  out = out.replace(/sdkwork_router_backend_api/gu, 'sdkwork_routes_clawrouter_backend_api');
  out = out.replace(/sdkwork_router_open_api/gu, 'sdkwork_routes_clawrouter_open_api');
  out = out.replace(/sdkwork_routes_app_api/gu, 'sdkwork_routes_clawrouter_app_api');
  out = out.replace(/sdkwork_routes_backend_api/gu, 'sdkwork_routes_clawrouter_backend_api');
  out = out.replace(/sdkwork_routes_open_api/gu, 'sdkwork_routes_clawrouter_open_api');
  out = out.replace(
    new RegExp(
      `${LEGACY_HTTP_ROUTE_PREFIX}([a-z0-9]+(?:-[a-z0-9]+)*)-(open-api|app-api|backend-api|internal-api|common|http-auth|http-shared|deploy-common)`,
      'giu',
    ),
    'sdkwork-routes-$1-$2',
  );
  out = out.replace(/sdkwork-routes-product-/gu, 'sdkwork-routes-merchandise-');
  out = out.replace(/routes-product-/gu, 'routes-merchandise-');
  // Keep this scoped to sdkwork-router-* route crates only; a bare router- rule
  // false-positives on product ids such as clawrouter-pc-commons.
  if (out.includes('sdkwork-router-mobile-react')) {
    out = out.split('sdkwork-router-mobile-react').join('sdkwork-shell-mobile-react');
  }
  out = out.replace(/@sdkwork\/router-mobile-react/gu, '@sdkwork/shell-mobile-react');
  out = out.replace(/sdkwork_router_/gu, 'sdkwork_routes_');
  const legacyFoundation = legacyFoundationPcReactName();
  if (out.includes(legacyFoundation)) {
    out = out.split(legacyFoundation).join('sdkwork-shell-pc-react');
  }
  out = out.replace(/@sdkwork\/router-pc-react/gu, '@sdkwork/shell-pc-react');
  if (out.includes(LEGACY_HTTP_ROUTE_PREFIX)) {
    out = out.split(LEGACY_HTTP_ROUTE_PREFIX).join(CANONICAL_HTTP_ROUTE_PREFIX);
  }
  return out;
}

export function containsLegacyRouteCrateNaming(text) {
  return transformRouteCrateNamingText(text) !== text;
}

function readRepositoryTextFile(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.toString('utf16le'), encoding: 'utf16le' };
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    return { text: buf.toString('utf16be'), encoding: 'utf16be' };
  }
  if (buf.length >= 4 && buf[1] === 0 && buf[3] === 0) {
    return { text: buf.toString('utf16le'), encoding: 'utf16le' };
  }
  return { text: buf.toString('utf8'), encoding: 'utf8' };
}

function writeRepositoryTextFile(filePath, text, encoding = 'utf8') {
  if (encoding === 'utf16le') {
    fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
    return;
  }
  if (encoding === 'utf16be') {
    fs.writeFileSync(filePath, Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, 'utf16be')]));
    return;
  }
  fs.writeFileSync(filePath, text, 'utf8');
}

function shouldSkipDir(name) {
  return SKIP_DIR_NAMES.has(name);
}

function shouldScanFile(filePath) {
  const base = path.basename(filePath);
  if (SKIP_FILE_NAMES.has(base)) {
    return false;
  }
  if (base.startsWith('Dockerfile')) {
    return true;
  }
  if (base.endsWith('.txt') && /[\\/]generated[\\/]/u.test(filePath)) {
    return true;
  }
  const ext = path.extname(filePath);
  if (!TEXT_EXTENSIONS.has(ext)) {
    return false;
  }
  if (base === 'Cargo.lock') {
    return true;
  }
  return true;
}

export function walkRepositoryFiles(repoRoot, files = []) {
  if (!fs.existsSync(repoRoot)) {
    return files;
  }
  for (const name of fs.readdirSync(repoRoot)) {
    if (shouldSkipDir(name)) {
      continue;
    }
    const full = path.join(repoRoot, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkRepositoryFiles(full, files);
      continue;
    }
    if (shouldScanFile(full)) {
      files.push(full);
    }
  }
  return files;
}

export function collectLegacyDirectoryRenames(repoRoot) {
  const renames = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (shouldSkipDir(name)) {
        continue;
      }
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) {
        continue;
      }
      walk(full);
      const transformed = transformRouteCrateNamingText(name);
      if (transformed !== name) {
        renames.push({
          from: full,
          to: path.join(dir, transformed),
        });
      }
    }
  }
  walk(repoRoot);
  return renames.sort((a, b) => b.from.length - a.from.length);
}

function isDirectoryTreeEmpty(dir) {
  if (!fs.existsSync(dir)) {
    return true;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      if (!isDirectoryTreeEmpty(full)) {
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
}

export function isStaleLegacyDirectoryRename(rename) {
  if (!fs.existsSync(rename.to)) {
    return false;
  }
  return isDirectoryTreeEmpty(rename.from);
}

export function removeStaleLegacyDirectory(rename, dryRun = false) {
  if (!isStaleLegacyDirectoryRename(rename)) {
    return false;
  }
  if (!dryRun) {
    try {
      fs.rmSync(rename.from, { recursive: true, force: true });
    } catch {
      return false;
    }
  }
  return true;
}

export function auditRouteCrateNaming(repoRoot) {
  const issues = [];
  if (!fs.existsSync(repoRoot)) {
    return { root: repoRoot, skipped: true, issues: ['missing repository root'] };
  }
  if (!fs.existsSync(path.join(repoRoot, 'AGENTS.md'))) {
    return { root: repoRoot, skipped: true, issues: [] };
  }

  for (const file of walkRepositoryFiles(repoRoot)) {
    const rel = path.relative(repoRoot, file);
    const { text: before } = readRepositoryTextFile(file);
    if (containsLegacyRouteCrateNaming(before)) {
      issues.push(`legacy route-crate naming in ${rel}`);
    }
  }

  for (const rename of collectLegacyDirectoryRenames(repoRoot)) {
    if (isStaleLegacyDirectoryRename(rename)) {
      continue;
    }
    issues.push(
      `legacy directory name ${path.relative(repoRoot, rename.from)} -> ${path.basename(rename.to)}`,
    );
  }

  return { root: repoRoot, skipped: false, issues };
}

export function alignRouteCrateNaming(repoRoot, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const auditBefore = auditRouteCrateNaming(repoRoot);
  if (auditBefore.skipped) {
    return { ...auditBefore, changed: [], dryRun };
  }

  const changed = [];

  for (const file of walkRepositoryFiles(repoRoot)) {
    const { text: before, encoding } = readRepositoryTextFile(file);
    const after = transformRouteCrateNamingText(before);
    if (after === before) {
      continue;
    }
    const rel = path.relative(repoRoot, file);
    changed.push(`text ${rel}`);
    if (!dryRun) {
      const outEncoding = encoding === 'utf8' ? 'utf8' : 'utf8';
      writeRepositoryTextFile(file, after, outEncoding);
    }
  }

  for (const rename of collectLegacyDirectoryRenames(repoRoot)) {
    const relFrom = path.relative(repoRoot, rename.from);
    const relTo = path.relative(repoRoot, rename.to);
    if (removeStaleLegacyDirectory(rename, dryRun)) {
      changed.push(`remove-stale ${relFrom}`);
      continue;
    }
    changed.push(`rename ${relFrom} -> ${relTo}`);
    if (!dryRun) {
      try {
        fs.mkdirSync(path.dirname(rename.to), { recursive: true });
        fs.renameSync(rename.from, rename.to);
      } catch (error) {
        if (removeStaleLegacyDirectory(rename, false)) {
          changed.push(`remove-stale ${relFrom}`);
        } else {
          changed.push(`rename-failed ${relFrom}: ${error.code || error.message}`);
        }
      }
    }
  }

  const auditAfter = dryRun ? auditBefore : auditRouteCrateNaming(repoRoot);
  return {
    root: repoRoot,
    skipped: false,
    changed,
    dryRun,
    issuesBefore: auditBefore.issues.length,
    issuesAfter: auditAfter.issues.length,
    issues: auditAfter.issues,
  };
}
