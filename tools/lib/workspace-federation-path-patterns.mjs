import fs from 'node:fs';
import path from 'node:path';

import {
  FOUNDATION_REPOSITORY_NAMES,
  SHARED_PACKAGE_FAMILY_REPOSITORIES,
  inferApplicationCode,
} from './align-packages-layout.mjs';

export const LEGACY_FAMILY_TARGET_SUFFIX = {
  'packages/common': '-common',
  'packages/pc-react': '-pc',
  'packages/mobile-react': '-h5',
  'packages/mobile-flutter': '-flutter-mobile',
  'packages/mini-program': '-mini-program',
  'packages/android-native': '-android-mobile',
  'packages/ios-native': '-ios-mobile',
  'packages/harmony-native': '-harmony-mobile',
};

const QUOTE_PATTERN = /^(\s*-\s*)(['"])(.+)\2\s*$/;
const UNQUOTED_PATTERN = /^(\s*-\s*)(?!['"])(.+?)\s*$/;

function readJson(filePath) {
  const text = readText(filePath).replace(/^\uFEFF/u, '');
  return JSON.parse(text);
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isDirectory(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch {
    return false;
  }
}

export function keepsRepositoryRootPackages(repoName) {
  return FOUNDATION_REPOSITORY_NAMES.has(repoName)
    || SHARED_PACKAGE_FAMILY_REPOSITORIES.has(repoName);
}

export function parseWorkspacePackageLine(line) {
  const quoted = line.match(QUOTE_PATTERN);
  if (quoted) {
    return {
      indent: quoted[1],
      quote: quoted[2],
      entry: quoted[3],
      line,
    };
  }

  const unquoted = line.match(UNQUOTED_PATTERN);
  if (!unquoted) {
    return null;
  }

  return {
    indent: unquoted[1],
    quote: '"',
    entry: unquoted[2].trim(),
    line,
  };
}

export function workspaceEntryExists(repoRoot, entry) {
  if (entry.startsWith('!')) {
    return true;
  }

  if (!entry.startsWith('.') && !/^(apps|packages|sdks)\//u.test(entry)) {
    return true;
  }

  const normalized = entry.replace(/\\/g, '/');
  const absolute = path.resolve(repoRoot, normalized);

  if (!normalized.includes('*')) {
    return pathExists(absolute);
  }

  if (normalized.endsWith('/*')) {
    const parent = absolute.slice(0, -2);
    return isDirectory(parent) && fs.readdirSync(parent).length > 0;
  }

  const starIndex = normalized.indexOf('*');
  const prefix = normalized.slice(0, starIndex);
  const suffix = normalized.slice(starIndex + 1);
  const parentDir = path.resolve(repoRoot, prefix.replace(/\/$/u, '') || '.');
  if (!isDirectory(parentDir)) {
    if (prefix.includes('/')) {
      const dirname = path.dirname(path.resolve(repoRoot, `${prefix}x`));
      if (!isDirectory(dirname)) {
        return false;
      }
      const globPrefix = path.basename(prefix);
      return fs.readdirSync(dirname).some((name) => {
        if (!name.startsWith(globPrefix)) {
          return false;
        }
        if (!suffix) {
          return true;
        }
        return pathExists(path.join(dirname, name, suffix.replace(/^\//u, '')));
      });
    }
    return false;
  }

  return fs.readdirSync(parentDir).length > 0;
}

export const KNOWN_SIBLING_REPO_ALIASES = {
  'craw-chat': 'sdkwork-im',
};

function normalizeSiblingRepoName(repoName) {
  return KNOWN_SIBLING_REPO_ALIASES[repoName] ?? repoName;
}

function splitSiblingEntry(entry) {
  const normalized = entry.replace(/\\/g, '/');
  const match = normalized.match(/^\.\.\/([^/]+)\/(.+)$/u);
  if (!match) {
    return null;
  }
  return {
    siblingRepo: normalizeSiblingRepoName(match[1]),
    restPath: match[2],
    originalSiblingRepo: match[1],
  };
}

function resolveSiblingRepoRoot(baseDir, siblingRepoName) {
  let current = baseDir;
  while (true) {
    const candidate = path.join(current, siblingRepoName);
    if (isDirectory(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function extractSiblingReference(entry) {
  const normalized = entry.replace(/\\/g, '/');
  const match = normalized.match(/(?:\.\.\/)+([^/]+)\/(.+)$/u);
  if (!match) {
    return null;
  }
  return {
    siblingRepo: normalizeSiblingRepoName(match[1]),
    restPath: match[2],
    originalSiblingRepo: match[1],
  };
}

function rewritePathInsideApplicationRepo(restPath, repoRoot) {
  if (keepsRepositoryRootPackages(path.basename(repoRoot))) {
    return null;
  }

  const applicationCode = inferApplicationCode(repoRoot);
  const normalizedRest = restPath.replace(/\\/g, '/');

  for (const [legacyFamily, suffix] of Object.entries(LEGACY_FAMILY_TARGET_SUFFIX)) {
    const prefix = `${legacyFamily}/`;
    if (!normalizedRest.startsWith(prefix)) {
      continue;
    }

    const tail = normalizedRest.slice(prefix.length);
    if (!tail) {
      return null;
    }

    const appRoot = `apps/sdkwork-${applicationCode}${suffix}`;
    let canonicalTail;
    if (tail.endsWith('/*')) {
      canonicalTail = 'packages/*';
    } else if (tail.includes('/')) {
      canonicalTail = `packages/${tail.split('/').at(-1)}`;
    } else {
      canonicalTail = `packages/${tail}`;
    }

    return `${appRoot}/${canonicalTail}`;
  }

  return null;
}

function toPosixRelative(fromDir, targetPath) {
  return path.relative(fromDir, targetPath).replace(/\\/g, '/');
}

export function rewriteLegacyPathEntry(entry, baseDir, repoRoot = baseDir) {
  if (workspaceEntryExists(baseDir, entry)) {
    return null;
  }

  const repoRelative = path.relative(repoRoot, path.resolve(baseDir, entry)).replace(/\\/g, '/');
  const internalFromRepoRelative = rewritePathInsideApplicationRepo(repoRelative, repoRoot);
  if (internalFromRepoRelative && workspaceEntryExists(repoRoot, internalFromRepoRelative)) {
    return toPosixRelative(baseDir, path.join(repoRoot, internalFromRepoRelative));
  }

  const internalRewrite = rewritePathInsideApplicationRepo(entry.replace(/\\/g, '/'), repoRoot);
  if (internalRewrite && workspaceEntryExists(repoRoot, internalRewrite)) {
    return internalRewrite;
  }

  const sibling = extractSiblingReference(entry);
  if (!sibling) {
    return null;
  }

  if (sibling.originalSiblingRepo !== sibling.siblingRepo) {
    const aliasedRest = `${sibling.siblingRepo}/${sibling.restPath}`;
    const aliasedSiblingRoot = resolveSiblingRepoRoot(baseDir, sibling.siblingRepo);
    if (aliasedSiblingRoot) {
      const aliasedAbsolute = path.join(aliasedSiblingRoot, sibling.restPath);
      if (pathExists(aliasedAbsolute)) {
        return toPosixRelative(baseDir, aliasedAbsolute);
      }
    }
  }

  const siblingRoot = resolveSiblingRepoRoot(baseDir, sibling.siblingRepo);
  if (!siblingRoot) {
    return null;
  }

  const rewrittenRest = rewritePathInsideApplicationRepo(sibling.restPath, siblingRoot);
  if (!rewrittenRest) {
    return null;
  }

  const absolute = path.join(siblingRoot, rewrittenRest);
  if (!workspaceEntryExists(siblingRoot, rewrittenRest)) {
    return null;
  }

  return toPosixRelative(baseDir, absolute);
}

export function rewriteLegacySiblingEntry(entry, consumerRepoRoot) {
  return rewriteLegacyPathEntry(entry, consumerRepoRoot, consumerRepoRoot);
}

export function isLegacySiblingWorkspaceEntry(entry) {
  const sibling = extractSiblingReference(entry);
  if (!sibling) {
    return false;
  }
  if (keepsRepositoryRootPackages(sibling.siblingRepo)) {
    return false;
  }
  return Object.keys(LEGACY_FAMILY_TARGET_SUFFIX).some((legacyFamily) => (
    sibling.restPath.replace(/\\/g, '/').startsWith(`${legacyFamily}/`)
  ));
}

function listPackageJsonWorkspaceFiles(repoRoot) {
  const results = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
        continue;
      }
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (entry.name !== 'package.json') {
        continue;
      }
      try {
        const manifest = readJson(absolute);
        if (Array.isArray(manifest.workspaces) && manifest.workspaces.length > 0) {
          results.push(absolute);
        }
      } catch {
        // ignore invalid json
      }
    }
  }
  walk(repoRoot);
  return results;
}

function alignPackageJsonWorkspaces(packageJsonPath, repoRoot, dryRun) {
  const actions = [];
  const manifest = readJson(packageJsonPath);
  const baseDir = path.dirname(packageJsonPath);
  const seen = new Set();
  const nextWorkspaces = [];

  for (const entry of manifest.workspaces) {
    const rewritten = rewriteLegacyPathEntry(entry, baseDir, repoRoot);
    const target = rewritten ?? entry;
    if (!workspaceEntryExists(baseDir, target) && rewritten) {
      actions.push(`skip unresolved package.json workspace entry: ${entry}`);
      nextWorkspaces.push(entry);
      continue;
    }
    if (rewritten && rewritten !== entry) {
      actions.push(`rewrite ${path.relative(repoRoot, packageJsonPath)} workspace ${entry} -> ${rewritten}`);
    }
    if (!rewritten && !workspaceEntryExists(baseDir, entry)) {
      if (entry === 'packages/*' || entry.startsWith('!packages/')) {
        actions.push(`remove obsolete package.json workspace entry: ${entry}`);
        continue;
      }
    }
    if (seen.has(target)) {
      actions.push(`remove duplicate package.json workspace entry: ${entry}`);
      continue;
    }
    seen.add(target);
    nextWorkspaces.push(target);
  }

  const changed = JSON.stringify(manifest.workspaces) !== JSON.stringify(nextWorkspaces);
  if (changed && !dryRun) {
    manifest.workspaces = nextWorkspaces;
    writeJson(packageJsonPath, manifest);
  }
  return { changed, actions };
}

function alignPackageScripts(repoRoot, dryRun) {
  const actions = [];
  let changed = false;

  function alignManifest(packageJsonPath) {
    let manifest;
    try {
      manifest = readJson(packageJsonPath);
    } catch {
      return;
    }
  let localChanged = false;

  for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
    if (typeof command !== 'string' || !command.includes('packages/')) {
      continue;
    }
    let nextCommand = command;
    const fragments = command.match(/packages\/(?:common|pc-react|mobile-react|mobile-flutter)\/[^/\s]+?\/[^/\s"']+/gu) ?? [];
    for (const fragment of fragments) {
      const rewritten = rewriteLegacyPathEntry(fragment, repoRoot, repoRoot);
      if (rewritten && rewritten !== fragment) {
        nextCommand = nextCommand.split(fragment).join(rewritten);
      }
    }
    if (nextCommand !== command) {
      manifest.scripts[scriptName] = nextCommand;
      actions.push(`rewrite ${path.relative(repoRoot, packageJsonPath)} script ${scriptName}`);
      localChanged = true;
    }
  }

    if (localChanged) {
      changed = true;
      if (!dryRun) {
        writeJson(packageJsonPath, manifest);
      }
    }
  }

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
        continue;
      }
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (entry.name === 'package.json') {
        alignManifest(absolute);
      }
    }
  }

  walk(repoRoot);
  return { changed, actions };
}

const TSCONFIG_PATH_SUFFIX = /(\/(?:src|dist)\/(?:index\.(?:tsx?|ts)|[^/]+\.(?:tsx?|ts|d\.ts)|\*\/index\.d\.ts))$/u;
const LEGACY_PACKAGE_PATH_PATTERN = /(?:^|\/)packages\/(?:common|pc-react|mobile-react)\//u;

function splitTsconfigPathEntry(entry) {
  const normalized = entry.replace(/\\/g, '/');
  const match = normalized.match(TSCONFIG_PATH_SUFFIX);
  if (match) {
    return {
      root: normalized.slice(0, -match[1].length),
      suffix: match[1],
    };
  }
  return { root: normalized, suffix: '' };
}

function tsconfigEntryExists(contextDir, entry) {
  return pathExists(path.resolve(contextDir, entry.replace(/\\/g, '/')));
}

export function rewriteTsconfigPathEntry(entry, contextDir, repoRoot) {
  const { root, suffix } = splitTsconfigPathEntry(entry);
  const rewrittenRoot = rewriteLegacyPathEntry(root, contextDir, repoRoot)
    ?? rewriteLegacyDirectoryRoot(root, contextDir, repoRoot);
  if (!rewrittenRoot || rewrittenRoot === root) {
    return null;
  }

  const candidate = `${rewrittenRoot}${suffix}`;
  if (!tsconfigEntryExists(contextDir, candidate)) {
    return null;
  }

  return candidate;
}

function rewriteLegacyDirectoryRoot(root, contextDir, repoRoot) {
  if (keepsRepositoryRootPackages(path.basename(repoRoot))) {
    return null;
  }

  const normalized = root.replace(/\\/g, '/').replace(/^\.\//u, '');
  for (const [legacyFamily, suffix] of Object.entries(LEGACY_FAMILY_TARGET_SUFFIX)) {
    const prefix = `${legacyFamily}/`;
    if (!normalized.startsWith(prefix)) {
      continue;
    }

    const tail = normalized.slice(prefix.length);
    if (tail.includes('/')) {
      continue;
    }

    const applicationCode = inferApplicationCode(repoRoot);
    const appRoot = `apps/sdkwork-${applicationCode}${suffix}/packages`;
    if (!isDirectory(path.join(repoRoot, appRoot))) {
      continue;
    }

    return toPosixRelative(contextDir, path.join(repoRoot, appRoot));
  }

  return null;
}

function splitTsconfigGlobEntry(entry) {
  const normalized = entry.replace(/\\/g, '/');
  const globIndex = normalized.search(/\/(\*\*|\*)/u);
  if (globIndex >= 0) {
    return {
      root: normalized.slice(0, globIndex),
      suffix: normalized.slice(globIndex),
    };
  }
  return { root: normalized, suffix: '' };
}

function rewriteTsconfigGlobEntry(entry, contextDir, repoRoot) {
  const { root, suffix } = splitTsconfigGlobEntry(entry);
  const rewrittenRoot = rewriteLegacyPathEntry(root, contextDir, repoRoot)
    ?? rewriteLegacyDirectoryRoot(root, contextDir, repoRoot);
  if (!rewrittenRoot || rewrittenRoot === root) {
    return null;
  }

  const candidate = `${rewrittenRoot}${suffix}`;
  const absoluteGlobRoot = path.resolve(contextDir, rewrittenRoot);
  if (!isDirectory(absoluteGlobRoot)) {
    return null;
  }

  return candidate;
}

function rewriteTsconfigReference(entry, contextDir, repoRoot) {
  if (entry.includes('*')) {
    return rewriteTsconfigGlobEntry(entry, contextDir, repoRoot);
  }
  return rewriteTsconfigPathEntry(entry, contextDir, repoRoot);
}

function collectTsconfigStringFields(json) {
  const fields = [];
  for (const fieldName of ['include', 'exclude', 'files']) {
    const values = json?.[fieldName];
    if (!Array.isArray(values)) {
      continue;
    }
    for (const entry of values) {
      if (typeof entry === 'string') {
        fields.push({ fieldName, entry });
      }
    }
  }

  const paths = json?.compilerOptions?.paths;
  if (paths && typeof paths === 'object') {
    for (const [alias, entries] of Object.entries(paths)) {
      if (!Array.isArray(entries)) {
        continue;
      }
      for (const entry of entries) {
        if (typeof entry === 'string') {
          fields.push({
            fieldName: `paths["${alias}"]`,
            entry,
            alias,
            isPathMapping: true,
          });
        }
      }
    }
  }

  return fields;
}

function tsconfigPathMappingContextDir(json, filePath) {
  const configDir = path.dirname(filePath);
  const baseUrl = json?.compilerOptions?.baseUrl;
  if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
    return configDir;
  }
  return path.resolve(configDir, baseUrl.replace(/\\/g, '/'));
}

function inspectTsconfigReference(fieldName, entry, contextDir, repoRoot, relPath) {
  if (tsconfigEntryExists(contextDir, entry)) {
    return null;
  }

  const suggested = rewriteTsconfigReference(entry, contextDir, repoRoot);
  if (suggested && suggested !== entry) {
    return {
      kind: fieldName.startsWith('paths') ? 'stale-tsconfig-path' : 'stale-tsconfig-reference',
      severity: 'error',
      path: relPath,
      alias: fieldName.startsWith('paths') ? fieldName.slice(7, -2) : undefined,
      entry,
      suggested,
      detail: `${fieldName} should use canonical path ${suggested}`,
    };
  }

  if (LEGACY_PACKAGE_PATH_PATTERN.test(entry.replace(/\\/g, '/'))) {
    return {
      kind: 'broken-tsconfig-reference',
      severity: 'error',
      path: relPath,
      alias: fieldName.startsWith('paths') ? fieldName.slice(7, -2) : undefined,
      entry,
      suggested: null,
      detail: `${fieldName} references legacy package layout that no longer resolves`,
    };
  }

  return null;
}

function listTsconfigFiles(repoRoot) {
  const results = [];
  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target' || entry.name === 'dist') {
        continue;
      }
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (/^tsconfig.*\.json$/u.test(entry.name)) {
        results.push(absolute);
      }
    }
  }
  walk(repoRoot);
  return results;
}

export function scanTsconfigFederationPaths(repoRoot) {
  const issues = [];
  for (const filePath of listTsconfigFiles(repoRoot)) {
    let json;
    try {
      json = readJson(filePath);
    } catch {
      continue;
    }

    const contextDir = path.dirname(filePath);
    const pathMappingContextDir = tsconfigPathMappingContextDir(json, filePath);
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');

    for (const { fieldName, entry, isPathMapping } of collectTsconfigStringFields(json)) {
      const entryContextDir = isPathMapping ? pathMappingContextDir : contextDir;
      const issue = inspectTsconfigReference(fieldName, entry, entryContextDir, repoRoot, relPath);
      if (issue) {
        issues.push(issue);
      }
    }
  }
  return issues;
}

function alignTsconfigField(json, fieldName, contextDir, repoRoot, relPath, dryRun, actions) {
  const values = json[fieldName];
  if (!Array.isArray(values)) {
    return false;
  }

  let fileChanged = false;
  json[fieldName] = values.map((entry) => {
    if (typeof entry !== 'string' || tsconfigEntryExists(contextDir, entry)) {
      return entry;
    }

    const suggested = rewriteTsconfigReference(entry, contextDir, repoRoot);
    if (!suggested || suggested === entry) {
      return entry;
    }

    fileChanged = true;
    actions.push(`rewrite ${relPath} ${fieldName}: ${entry} -> ${suggested}`);
    return suggested;
  });

  return fileChanged;
}

function alignTsconfigFederationPaths(repoRoot, dryRun) {
  const actions = [];
  let changed = false;

  for (const filePath of listTsconfigFiles(repoRoot)) {
    let json;
    try {
      json = readJson(filePath);
    } catch {
      continue;
    }

    const contextDir = path.dirname(filePath);
    const pathMappingContextDir = tsconfigPathMappingContextDir(json, filePath);
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
    let fileChanged = false;

    for (const fieldName of ['include', 'exclude', 'files']) {
      fileChanged = alignTsconfigField(json, fieldName, contextDir, repoRoot, relPath, dryRun, actions)
        || fileChanged;
    }

    const paths = json?.compilerOptions?.paths;
    if (paths && typeof paths === 'object') {
      for (const [alias, entries] of Object.entries(paths)) {
        if (!Array.isArray(entries)) {
          continue;
        }

        const updatedEntries = entries.map((entry) => {
          if (typeof entry !== 'string' || tsconfigEntryExists(pathMappingContextDir, entry)) {
            return entry;
          }

          const suggested = rewriteTsconfigReference(entry, pathMappingContextDir, repoRoot);
          if (!suggested || suggested === entry) {
            return entry;
          }

          fileChanged = true;
          actions.push(`rewrite ${relPath} paths["${alias}"]: ${entry} -> ${suggested}`);
          return suggested;
        });

        paths[alias] = updatedEntries;
      }
    }

    if (fileChanged) {
      changed = true;
      if (!dryRun) {
        writeJson(filePath, json);
      }
    }
  }

  return { changed, actions };
}

export function scanWorkspaceFederationPaths(repoRoot, options = {}) {
  const mode = options.mode ?? 'enforce';
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  const issues = scanTsconfigFederationPaths(repoRoot);

  if (!fs.existsSync(workspacePath)) {
    return { workspacePath, issues, lines: [] };
  }

  const lines = readText(workspacePath).split(/\r?\n/u);

  for (const line of lines) {
    const parsed = parseWorkspacePackageLine(line);
    if (!parsed) {
      continue;
    }

    const rewritten = rewriteLegacySiblingEntry(parsed.entry, repoRoot);
    if (rewritten && workspaceEntryExists(repoRoot, rewritten)) {
      if (!workspaceEntryExists(repoRoot, parsed.entry) || parsed.entry !== rewritten) {
        issues.push({
          kind: 'stale-sibling-workspace-path',
          severity: 'error',
          path: 'pnpm-workspace.yaml',
          entry: parsed.entry,
          suggested: rewritten,
          detail: `workspace entry should use canonical architecture-qualified path ${rewritten}`,
        });
      }
      continue;
    }

    if (mode === 'audit' && !workspaceEntryExists(repoRoot, parsed.entry)) {
      issues.push({
        kind: 'missing-workspace-path',
        severity: 'info',
        path: 'pnpm-workspace.yaml',
        entry: parsed.entry,
        suggested: rewritten,
        detail: rewritten
          ? `workspace entry does not resolve; suggested ${rewritten}`
          : 'workspace entry does not resolve on disk',
      });
    }
  }

  return { workspacePath, issues, lines };
}

export function alignWorkspaceFederationPaths(repoRoot, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const actions = [];
  let changed = false;

  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (fs.existsSync(workspacePath)) {
    const yamlResult = alignPnpmWorkspaceFile(repoRoot, dryRun);
    changed = changed || yamlResult.changed;
    actions.push(...yamlResult.actions);
  }

  for (const packageJsonPath of listPackageJsonWorkspaceFiles(repoRoot)) {
    const packageResult = alignPackageJsonWorkspaces(packageJsonPath, repoRoot, dryRun);
    changed = changed || packageResult.changed;
    actions.push(...packageResult.actions);
  }

  const scriptResult = alignPackageScripts(repoRoot, dryRun);
  changed = changed || scriptResult.changed;
  actions.push(...scriptResult.actions);

  const tsconfigResult = alignTsconfigFederationPaths(repoRoot, dryRun);
  changed = changed || tsconfigResult.changed;
  actions.push(...tsconfigResult.actions);

  return {
    repoRoot,
    changed,
    actions,
    issuesAfter: scanWorkspaceFederationPaths(repoRoot).issues,
  };
}

function alignPnpmWorkspaceFile(repoRoot, dryRun) {
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  const { issues, lines } = scanWorkspaceFederationPaths(repoRoot);
  const suggestionByEntry = new Map(
    issues
      .filter((issue) => issue.suggested)
      .map((issue) => [issue.entry, issue.suggested]),
  );

  const actions = [];
  const seen = new Set();
  const updatedLines = [];

  for (const line of lines) {
    const parsed = parseWorkspacePackageLine(line);
    if (!parsed) {
      updatedLines.push(line);
      continue;
    }

    const rewritten = suggestionByEntry.get(parsed.entry)
      ?? rewriteLegacySiblingEntry(parsed.entry, repoRoot);

    if (rewritten && workspaceEntryExists(repoRoot, rewritten)) {
      if (parsed.entry === rewritten) {
        if (!seen.has(parsed.entry)) {
          seen.add(parsed.entry);
          updatedLines.push(line);
        } else {
          actions.push(`remove duplicate workspace entry: ${parsed.entry}`);
        }
        continue;
      }

      if (!seen.has(rewritten)) {
        seen.add(rewritten);
        updatedLines.push(`${parsed.indent}${parsed.quote}${rewritten}${parsed.quote}`);
        actions.push(`rewrite ${parsed.entry} -> ${rewritten}`);
      } else {
        actions.push(`remove stale duplicate after rewrite: ${parsed.entry}`);
      }
      continue;
    }

    if (!workspaceEntryExists(repoRoot, parsed.entry)) {
      if (parsed.entry === 'packages/*' || parsed.entry === 'packages/**' || parsed.entry.startsWith('!packages/')) {
        actions.push(`remove obsolete workspace entry: ${parsed.entry}`);
        continue;
      }
    }

    if (workspaceEntryExists(repoRoot, parsed.entry)) {
      if (!seen.has(parsed.entry)) {
        seen.add(parsed.entry);
        updatedLines.push(line);
      } else {
        actions.push(`remove duplicate workspace entry: ${parsed.entry}`);
      }
      continue;
    }

    updatedLines.push(line);
  }

  const original = lines.join('\n');
  const updated = `${updatedLines.join('\n').replace(/\s+$/u, '')}\n`;
  const changed = updated !== original;

  if (changed && !dryRun) {
    fs.writeFileSync(workspacePath, updated);
  }

  return { changed, actions };
}
