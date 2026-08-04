#!/usr/bin/env node
/**
 * Scans every application root under the workspace for build-config package
 * aliases. Beyond vite and vitest config files, this covers other bundler
 * config shapes (rollup, tsup, rspack, webpack, farm, rsbuild) so no app
 * carries a package-import remap outside the pnpm workspace + package exports
 * model (APP_PC_ARCHITECTURE_SPEC.md section 2.0.1).
 *
 * Usage: node scan-app-build-configs.mjs [root]
 * Prints one report line per app root and per violating config; exits 1 when
 * violations exist.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "generated",
  ".git",
  ".sdkwork",
  "target",
  "coverage",
  "external",
  ".pnpm",
]);

const BUILD_CONFIG_RE =
  /^(vite|vitest|rollup|tsup|rspack|webpack|farm|rsbuild|esbuild|microbundle)\.config(\.[a-z0-9-]+)?\.(ts|mts|cts|js|mjs|cjs)$/u;

const PACKAGE_KEY_RE = /^\s*["']((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9._-]+)*)["']\s*:/gmu;

function walk(dir, configs, manifests) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walk(full, configs, manifests);
      }
    } else if (BUILD_CONFIG_RE.test(entry.name)) {
      configs.push(full);
    } else if (entry.name === "package.json") {
      manifests.push(full);
    }
  }
}

function findPackageAliasKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(PACKAGE_KEY_RE)) {
    const key = match[1];
    if (key === "@" || key.startsWith("@/")) {
      continue;
    }
    keys.add(key);
  }
  return [...keys].sort();
}

const configs = [];
const manifests = [];
walk(root, configs, manifests);

const appRoots = new Map(); // config file -> nearest manifest dir (app root)
for (const config of configs) {
  let dir = path.dirname(config);
  let appDir = null;
  while (dir && dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, "package.json"))) {
      appDir = dir;
      break;
    }
    dir = path.dirname(dir);
  }
  appRoots.set(config, appDir);
}

const violations = [];
for (const config of configs) {
  const source = readFileSync(config, "utf8");
  const keys = findPackageAliasKeys(source);
  if (keys.length > 0) {
    violations.push({ config, keys, appDir: appRoots.get(config) });
  }
}

console.log(`apps/packages scanned: ${manifests.length}`);
console.log(`build config files scanned: ${configs.length}`);
console.log(`build configs with package aliases: ${violations.length}`);
for (const violation of violations.sort((a, b) => a.config.localeCompare(b.config))) {
  console.log(`- ${violation.config}`);
  console.log(`    app: ${violation.appDir ?? "(no package.json ancestor)"}`);
  for (const key of violation.keys) {
    console.log(`    ${key}`);
  }
}
process.exit(violations.length > 0 ? 1 : 0);
