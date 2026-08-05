#!/usr/bin/env node
/**
 * Checks that every `@sdkwork/<package>/<subpath>` import is covered by the
 * owning package's `exports` map. Subpath imports must be declared by the
 * package (APP_PC_ARCHITECTURE_SPEC.md section 2.0.1); consumer configs must
 * not remap them.
 *
 * Usage: node check-sdkwork-subpath-exports.mjs [root]
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? ".");
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", ".git", ".sdkwork", "target", "coverage", "external", ".pnpm", ".cargo", ".tools"]);

function walk(dir, out) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        walk(path.join(dir, entry.name), out);
      }
    } else if (/\.(ts|tsx)$/u.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

// collect package name -> dir for all @sdkwork packages
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

const files = [];
walk(root, files);
const violations = new Map(); // "pkg/subpath" -> Set(importer)
for (const file of files) {
  let source;
  try { source = readFileSync(file, "utf8"); } catch { continue; }
  for (const match of source.matchAll(/from\s+["'](@sdkwork\/[^"']+)["']/gu)) {
    const spec = match[1];
    const parts = spec.split("/");
    const pkg = parts.slice(0, 2).join("/");
    const subpath = parts.slice(2).join("/");
    if (!subpath || subpath.includes("${")) {
      continue;
    }
    const pkgDir = packageDirs.get(pkg);
    if (!pkgDir) {
      continue; // package not in this workspace tree; declaration audit covers it
    }
    let manifest;
    try { manifest = JSON.parse(readFileSync(path.join(pkgDir, "package.json"), "utf8")); } catch { continue; }
    const exportsMap = manifest.exports;
    if (!exportsMap) {
      continue; // legacy package without exports; node allows deep paths
    }
    const key = `./${subpath}`;
    if (!(key in exportsMap)) {
      if (!violations.has(`${pkg}/${subpath}`)) {
        violations.set(`${pkg}/${subpath}`, new Set());
      }
      violations.get(`${pkg}/${subpath}`).add(file);
    }
  }
}

console.log(`files scanned: ${files.length}`);
console.log(`subpath imports without exports coverage: ${violations.size}`);
for (const [spec, importers] of [...violations.entries()].sort()) {
  console.log(`- ${spec}`);
  for (const importer of [...importers].slice(0, 3)) {
    console.log(`    ${importer}`);
  }
}
process.exit(violations.size > 0 ? 1 : 0);
