#!/usr/bin/env node
/**
 * Repairs subpath imports of @sdkwork packages that lack `exports` coverage
 * (APP_PC_ARCHITECTURE_SPEC.md section 2.0.1). For each uncovered subpath it
 * adds a source-mode exports entry when the owning package has a matching
 * src file, and reports paths that need manual review.
 *
 * Usage: node fix-sdkwork-subpath-exports.mjs [root]
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", ".git", ".sdkwork", "target", "coverage", "external", ".pnpm", ".cargo", ".tools"]);

function walk(dir, out, filter) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walk(path.join(dir, entry.name), out, filter);
      }
    } else if (filter(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

const packageDirs = new Map();
(function collect(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        collect(path.join(dir, entry.name));
      }
    } else if (entry.name === "package.json") {
      try {
        const manifest = JSON.parse(readFileSync(path.join(dir, entry.name), "utf8"));
        if (manifest.name?.startsWith("@sdkwork/")) {
          packageDirs.set(manifest.name, dir);
        }
      } catch { /* ignore */ }
    }
  }
})(root);

function resolveSourceTarget(pkgDir, subpath) {
  const candidates = [
    path.join(pkgDir, "src", `${subpath}.ts`),
    path.join(pkgDir, "src", `${subpath}.tsx`),
    path.join(pkgDir, "src", `${subpath}.mts`),
    path.join(pkgDir, "src", subpath, "index.ts"),
    path.join(pkgDir, "src", subpath, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return `./${path.relative(pkgDir, candidate).replaceAll("\\", "/")}`;
    }
  }
  return undefined;
}

const files = [];
walk(root, files, (name) => /\.(ts|tsx)$/u.test(name));
const missing = new Map(); // pkg -> Set(subpath) with importer samples
for (const file of files) {
  let source;
  try { source = readFileSync(file, "utf8"); } catch { continue; }
  for (const match of source.matchAll(/from\s+["'](@sdkwork\/[^"']+)["']/gu)) {
    const spec = match[1];
    if (spec.includes("${")) continue;
    const parts = spec.split("/");
    const pkg = parts.slice(0, 2).join("/");
    const subpath = parts.slice(2).join("/");
    if (!subpath) continue;
    const pkgDir = packageDirs.get(pkg);
    if (!pkgDir) continue;
    let manifest;
    try { manifest = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch { continue; }
    const key = `./${subpath}`;
    if (!manifest.exports || !(key in manifest.exports)) {
      if (!missing.has(pkg)) missing.set(pkg, new Map());
      if (!missing.get(pkg).has(key)) missing.get(pkg).set(key, []);
      if (missing.get(pkg).get(key).length < 2) {
        missing.get(pkg).get(key).push(file);
      }
    }
  }
}

let patched = 0;
let manual = 0;
for (const [pkg, subpaths] of [...missing.entries()].sort()) {
  const pkgDir = packageDirs.get(pkg);
  const manifest = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  manifest.exports ??= {};
  for (const [key, importers] of [...subpaths.entries()].sort()) {
    const subpath = key.slice(2);
    const target = resolveSourceTarget(pkgDir, subpath);
    if (target) {
      manifest.exports[key] = {
        types: target,
        import: target,
        default: target,
      };
      patched += 1;
      console.log(`patched ${pkg}${key} -> ${target}`);
    } else {
      manual += 1;
      console.log(`MANUAL ${pkg}${key} (no src file; e.g. ${importers[0]})`);
    }
  }
  const ordered = {};
  for (const k of Object.keys(manifest.exports).sort()) {
    ordered[k] = manifest.exports[k];
  }
  manifest.exports = ordered;
  writeFileSync(path.join(pkgDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`patched: ${patched}, manual review needed: ${manual}`);
