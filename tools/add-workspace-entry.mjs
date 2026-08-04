#!/usr/bin/env node
/**
 * Inserts a workspace package entry into the `packages:` list of a
 * pnpm-workspace.yaml (deduped, placed at the end of the list). Companion to
 * fix-workspace-yaml.mjs; avoids shell-escaping hazards of inline scripts.
 *
 * Usage: node add-workspace-entry.mjs <workspace-yaml-path> <entry-line>
 * Example: node add-workspace-entry.mjs ../sdkwork-x/pnpm-workspace.yaml '../sdkwork-iam/...'
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [yamlPath, entry] = process.argv.slice(2);
if (!yamlPath || !entry) {
  console.error("usage: add-workspace-entry.mjs <pnpm-workspace.yaml> <entry>");
  process.exit(2);
}

const lines = readFileSync(yamlPath, "utf8").split(/\r?\n/u);
const pkgIdx = lines.findIndex((line) => /^packages:\s*$/u.test(line));
if (pkgIdx === -1) {
  console.error(`add-workspace-entry: no packages block in ${yamlPath}`);
  process.exit(1);
}

const normalized = entry.startsWith('"') ? entry : `"${entry}"`;
const candidate = `  - ${normalized}`;
if (lines.some((line) => line.trim() === candidate.trim())) {
  console.log("already present");
  process.exit(0);
}

let end = pkgIdx + 1;
while (
  end < lines.length
  && (lines[end].trim() === "" || lines[end].startsWith(" ") || lines[end].startsWith("-"))
) {
  end += 1;
}
lines.splice(end, 0, candidate);
writeFileSync(yamlPath, `${lines.join("\n")}\n`);
console.log(`inserted ${candidate}`);
