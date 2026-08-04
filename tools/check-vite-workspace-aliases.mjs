#!/usr/bin/env node
/**
 * Checks that PC application vite configs do not declare package-specifier
 * aliases (scoped like `@sdkwork/*`, or unscoped like `react`, `i18next`,
 * `lucide-react`, `sdkwork-drive-pc-core`). Package imports MUST resolve
 * through pnpm workspace linking and package `exports` maps
 * (APP_PC_ARCHITECTURE_SPEC.md section 2.0.1), never through consumer
 * `resolve.alias` entries. Project-internal path aliases such as `"@"` or
 * `"@/..."` are allowed and not reported.
 *
 * Usage:
 *   node check-vite-workspace-aliases.mjs --root <repository-root>
 *   node check-vite-workspace-aliases.mjs --root . --json
 *
 * Exit code 0 when no violations are found, 1 otherwise. Third-party projects
 * under `external/` are excluded; the rule gates SDKWork-owned application
 * roots.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = { root: process.cwd(), json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      args.root = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--json") {
      args.json = true;
    }
  }
  return args;
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "generated",
  ".git",
  ".sdkwork",
  "target",
  "coverage",
  "external",
]);

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), out);
      }
    } else if (/^vite\.config\.(ts|mts|js|mjs)$/u.test(entry.name) || /^vitest\.config\.(ts|mts|js|mjs)$/u.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function findPackageAliasKeys(source) {
  const keys = new Set();
  // Package-specifier shapes: @scope/name[/subpath] or bare name[/subpath].
  // Excludes project-internal path aliases such as "@" and "@/components".
  const packageKey = /^\s*["']((?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(?:\/[a-zA-Z0-9._-]+)*)["']\s*:/gmu;
  for (const match of source.matchAll(packageKey)) {
    const key = match[1];
    if (key.startsWith("@/") || key === "@") {
      continue;
    }
    keys.add(key);
  }
  return [...keys].sort();
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.root)) {
    console.error(`check-vite-workspace-aliases: root does not exist: ${args.root}`);
    process.exit(2);
  }

  const configFiles = [];
  walk(args.root, configFiles);
  const violations = [];
  for (const file of configFiles) {
    const source = readFileSync(file, "utf8");
    const keys = findPackageAliasKeys(source);
    if (keys.length > 0) {
      violations.push({ file, aliases: keys });
    }
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ configs: configFiles.length, violations }, null, 2)}\n`);
  } else {
    if (violations.length > 0) {
      console.error(`check-vite-workspace-aliases: ${violations.length} vite config(s) declare package-specifier aliases`);
      for (const violation of violations) {
        console.error(`- ${violation.file}`);
        for (const alias of violation.aliases) {
          console.error(`    ${alias}`);
        }
      }
      console.error(
        "Package imports must resolve through pnpm workspace links and package exports maps; remove these aliases and complete the workspace dependency graph.",
      );
    } else {
      console.log(`check-vite-workspace-aliases: OK (${configFiles.length} vite config(s) checked, no package-specifier aliases)`);
    }
  }

  process.exit(violations.length > 0 ? 1 : 0);
}

main();
