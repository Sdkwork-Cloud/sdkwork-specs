#!/usr/bin/env node
/**
 * Fail when authored workspace files still reference retired IAM package paths.
 * Run from sdkwork-space root: node sdkwork-specs/tools/check-iam-workspace-paths.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildForbiddenIamPathFragments } from "./iam-legacy-path-fragments.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const skipDirs = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  "build",
  ".pnpm",
  "generated",
  ".sdkwork",
]);
const textExtensions = new Set([".yaml", ".yml", ".json", ".ts", ".tsx", ".mjs", ".md", ".rs", ".toml"]);

const forbiddenFragments = buildForbiddenIamPathFragments();

const allowlistFiles = new Set([
  path.normalize("sdkwork-specs/tools/iam-legacy-path-fragments.mjs"),
  path.normalize("sdkwork-specs/tools/iam-workspace-paths.mjs"),
  path.normalize("sdkwork-specs/MIGRATION_SPEC.md"),
  path.normalize("sdkwork-specs/TEST_SPEC.md"),
  path.normalize("sdkwork-specs/SDKWORK_WORKSPACE_SPEC.md"),
  path.normalize("sdkwork-specs/APPLICATION_SPEC.md"),
  path.normalize("sdkwork-specs/MODULE_SPEC.md"),
  path.normalize("sdkwork-specs/COMPONENT_SPEC.md"),
  path.normalize("sdkwork-iam/tests/static/governance/iam-apps-layout-standard.test.mjs"),
  path.normalize("sdkwork-appbase/tests/static/governance/appbase-iam-extraction-surfaces.mjs"),
  path.normalize("sdkwork-appbase/docs/architecture/tech/TECH_ARCHITECTURE.md"),
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (textExtensions.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

const violations = [];
for (const file of walk(workspaceRoot)) {
  const rel = path.relative(workspaceRoot, file).replaceAll("\\", "/");
  if (allowlistFiles.has(path.normalize(rel))) continue;
  if (rel.endsWith("pnpm-lock.yaml")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const fragment of forbiddenFragments) {
    if (text.includes(fragment)) {
      violations.push(`${rel}: ${fragment}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`IAM workspace path standard failed with ${violations.length} violation(s):`);
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("IAM workspace path standard ok.");
