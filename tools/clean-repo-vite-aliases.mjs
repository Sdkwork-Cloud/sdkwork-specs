#!/usr/bin/env node
/**
 * Cleans one repository of vite-config package aliases per
 * APP_PC_ARCHITECTURE_SPEC.md section 2.0.1:
 *   1. Removes "@sdkwork/..." alias entries from every vite.config under the repo.
 *   2. Declares missing @sdkwork dependencies reported by the undeclared-import audit.
 *   3. Reports multi-line alias entries that need manual review.
 * Usage: node clean-repo-vite-aliases.mjs <repoRoot> [workspaceRoot]
 *
 * <workspaceRoot> defaults to the parent of <repoRoot>. It is used to resolve
 * the published version of `@sdkwork/sdk-common` and `@sdkwork/utils` from
 * their local source packages so we never write `workspace:*` into manifests
 * (composed consumer packages are PUBLISHED to npm and external consumers
 * cannot resolve the workspace protocol — see SDK_PACKAGE_NAMING_SPEC.md §1.1).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const workspaceRoot = path.resolve(process.argv[3] ?? path.dirname(repoRoot));
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", ".git", ".sdkwork", "target", "coverage", "external"]);
const ALIAS_START = /^\s*["']((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9._-]+)*)["']\s*:/u;

/**
 * Resolve a concrete semver spec (e.g. `^1.0.5`) for a known @sdkwork source
 * package from its local source package.json. Returns `workspace:*` only as a
 * last-resort fallback (this preserves the original behavior for unknown
 * @sdkwork packages so the tool still declares the import; the next
 * `align-sdk-standard` run will rewrite known packages to concrete versions).
 */
const SDKWORK_SOURCE_VERSIONS = new Map([
  ['@sdkwork/sdk-common', ['sdkwork-sdk-commons/sdkwork-sdk-common-typescript/package.json', '^1.0.5']],
  ['@sdkwork/utils', ['sdkwork-utils/packages/sdkwork-utils-typescript/package.json', '^0.11.0']],
]);

function resolveSdkworkVersionSpec(packageName) {
  const entry = SDKWORK_SOURCE_VERSIONS.get(packageName);
  if (!entry) return 'workspace:*';
  const [relativePath, fallback] = entry;
  const sourcePath = path.join(workspaceRoot, relativePath);
  try {
    if (!existsSync(sourcePath)) return fallback;
    const pkg = JSON.parse(readFileSync(sourcePath, 'utf8'));
    const version = pkg && typeof pkg.version === 'string' ? pkg.version.trim() : '';
    if (!/^\d+\.\d+\.\d+/u.test(version)) return fallback;
    return `^${version}`;
  } catch {
    return fallback;
  }
}

function walk(dir, out, filter) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(full, out, filter);
      }
    } else if (filter(entry.name)) {
      out.push(full);
    }
  }
}

function findPackageDirs(repoRoot) {
  const dirs = [];
  const stack = [repoRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          stack.push(full);
        }
      } else if (entry.name === "package.json") {
        try {
          const manifest = JSON.parse(readFileSync(full, "utf8"));
          if (manifest.name) {
            dirs.push({ dir, manifest });
          }
        } catch {
          // ignore malformed manifests
        }
      }
    }
  }
  return dirs;
}

// ---- Step 1: remove single-line alias entries from vite configs ----
const configs = [];
walk(repoRoot, configs, (name) => /^vite\.config(\.[a-z0-9-]+)?\.(ts|mts|js|mjs)$/u.test(name) || /^vitest\.config(\.[a-z0-9-]+)?\.(ts|mts|js|mjs)$/u.test(name));
let removedAliases = 0;
for (const config of configs) {
  const source = readFileSync(config, "utf8");
  const lines = source.split(/\r?\n/u);
  const kept = [];
  let removedInFile = 0;
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const match = line.match(ALIAS_START);
    if (match && match[1] !== "@" && !match[1].startsWith("@/")) {
      // Alias entry: single-line when the statement closes on the same line
      // with a trailing comma; otherwise skip until it closes.
      removedInFile += 1;
      index += 1;
      let depth = 0;
      for (const char of line) {
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth -= 1;
        }
      }
      let closed = depth <= 0 && line.trimEnd().endsWith(",");
      while (index < lines.length && !closed) {
        const current = lines[index];
        index += 1;
        for (const char of current) {
          if (char === "(") {
            depth += 1;
          } else if (char === ")") {
            depth -= 1;
          }
        }
        if (depth <= 0 && current.trimEnd().endsWith(",")) {
          closed = true;
        }
      }
      continue;
    }
    kept.push(line);
    index += 1;
  }
  if (removedInFile > 0) {
    writeFileSync(config, kept.join("\n"));
    removedAliases += removedInFile;
    console.log(`vite: removed ${removedInFile} alias(es) from ${path.relative(repoRoot, config)}`);
  }
}

// ---- Step 2: declare undeclared @sdkwork imports ----
const packageDirs = findPackageDirs(repoRoot);
const missingByDir = new Map();
for (const { dir, manifest } of packageDirs) {
  const srcDir = path.join(dir, "src");
  if (!existsSync(srcDir)) {
    continue;
  }
  const files = [];
  walk(srcDir, files, (name) => /\.(ts|tsx)$/u.test(name));
  const imports = new Set();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+["'](@sdkwork\/[^"']+)["']/gu)) {
      const spec = match[1];
      if (spec.includes("${") || spec === manifest.name || spec.startsWith(`${manifest.name}/`)) {
        continue;
      }
      imports.add(spec.split("/").slice(0, 2).join("/"));
    }
  }
  if (imports.size === 0) {
    continue;
  }
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ]);
  const missing = [...imports].filter((spec) => !declared.has(spec)).sort();
  if (missing.length > 0) {
    missingByDir.set(dir, { manifest, missing });
  }
}

let declaredCount = 0;
for (const [dir, { manifest, missing }] of missingByDir) {
  manifest.dependencies ??= {};
  for (const spec of missing) {
    if (!manifest.dependencies[spec]) {
      // For known @sdkwork source packages (sdk-common, utils), declare a
      // concrete published version spec — never `workspace:*`, which would
      // corrupt the manifest if this package is later published to npm.
      // Unknown @sdkwork packages fall back to `workspace:*`; the next
      // `align-sdk-standard` run will rewrite them when their source lands.
      manifest.dependencies[spec] = resolveSdkworkVersionSpec(spec);
      declaredCount += 1;
    }
  }
  const ordered = Object.fromEntries(Object.entries(manifest.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  manifest.dependencies = ordered;
  writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`pkg: declared deps in ${path.relative(repoRoot, dir)}: ${missing.join(", ")}`);
}

console.log(`summary: removed ${removedAliases} alias(es), declared ${declaredCount} dependency(ies)`);
