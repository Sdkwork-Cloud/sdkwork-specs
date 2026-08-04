#!/usr/bin/env node
/**
 * Repairs pnpm-workspace.yaml files whose workspace package entries were
 * appended outside the `packages:` block (for example into `catalog:` or at
 * the file tail). Entries are moved back into the packages list and deduped.
 * Usage: node fix-workspace-yaml.mjs [root]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(process.argv[2] ?? ".");
const files = [];
function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", ".sdkwork", "dist", "target"].includes(entry.name)) {
        walk(path.join(dir, entry.name));
      }
    } else if (entry.name === "pnpm-workspace.yaml") {
      files.push(path.join(dir, entry.name));
    }
  }
}
walk(root);

function fix(file) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/u);
  const pkgIdx = lines.findIndex((line) => /^packages:\s*$/u.test(line));
  if (pkgIdx === -1) return "skip";
  const pkgEntries = new Set();
  for (const line of lines.slice(pkgIdx + 1)) {
    const stripped = line.trim();
    if (stripped.startsWith("- ")) pkgEntries.add(stripped);
    else if (stripped && !stripped.startsWith("-") && !stripped.startsWith("#")) break;
  }
  const appended = [];
  const kept = [];
  let inPkg = false;
  for (const line of lines) {
    const stripped = line.trim();
    if (/^packages:\s*$/u.test(line)) { inPkg = true; kept.push(line); continue; }
    if (stripped.startsWith('- "..') || stripped.startsWith("- ../")) {
      if (inPkg) kept.push(line);
      else if (!pkgEntries.has(stripped) && !appended.includes(stripped)) appended.push(stripped);
      continue;
    }
    if (inPkg && stripped && !stripped.startsWith("-") && !stripped.startsWith("#")) inPkg = false;
    kept.push(line);
  }
  if (appended.length === 0) return "clean";
  const out = [];
  let inBlock = false;
  let inserted = false;
  for (const line of kept) {
    const stripped = line.trim();
    if (/^packages:\s*$/u.test(line)) { inBlock = true; out.push(line); continue; }
    if (inBlock) {
      if (stripped && !stripped.startsWith("-") && !stripped.startsWith("#")) {
        if (!inserted) { for (const e of appended) out.push("  " + e); inserted = true; }
        inBlock = false;
      } else { out.push(line); continue; }
    }
    out.push(line);
  }
  if (!inserted) for (const e of appended) out.push("  " + e);
  writeFileSync(file, out.join("\n") + "\n");
  return `fixed ${appended.length}`;
}

let fixed = 0;
for (const file of files) {
  const status = fix(file);
  if (status !== "clean") { console.log(`${file}: ${status}`); fixed += 1; }
}
console.log(`total fixed: ${fixed}`);
