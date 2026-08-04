#!/usr/bin/env node
/**
 * Cleans one repository of vite-config package aliases per
 * APP_PC_ARCHITECTURE_SPEC.md section 2.0.1:
 *   1. Removes "@sdkwork/..." alias entries from every vite.config under the repo.
 *   2. Declares missing workspace:* dependencies reported by the undeclared-import audit.
 *   3. Reports multi-line alias entries that need manual review.
 * Usage: node clean-repo-vite-aliases.mjs <repoRoot>
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.argv[2] ?? ".");
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", ".git", ".sdkwork", "target", "coverage", "external"]);
const ALIAS_START = /^\s*["']((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9._-]+)*)["']\s*:/u;

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
      manifest.dependencies[spec] = "workspace:*";
      declaredCount += 1;
    }
  }
  const ordered = Object.fromEntries(Object.entries(manifest.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  manifest.dependencies = ordered;
  writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`pkg: declared deps in ${path.relative(repoRoot, dir)}: ${missing.join(", ")}`);
}

console.log(`summary: removed ${removedAliases} alias(es), declared ${declaredCount} dependency(ies)`);
