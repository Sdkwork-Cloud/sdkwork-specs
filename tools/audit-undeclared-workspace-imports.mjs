import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Audits workspace packages for @sdkwork/* imports that are not declared in
// their package.json dependency graph. Undeclared imports masked by consumer
// vite aliases are the technical debt this audit removes.

const root = path.resolve(process.argv[2] ?? ".");
const SKIP_DIRS = new Set(["node_modules", "dist", "generated", "tests", ".git", ".sdkwork", "target", "coverage", "external"]);

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
    } else if (/\.(ts|tsx)$/u.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
}

function findPackages(repoRoot) {
  const packages = [];
  const pkgFiles = [];
  walk(repoRoot, pkgFiles);
  // package.json discovery
  const seen = new Set();
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
      } else if (entry.name === "package.json" && !seen.has(full)) {
        seen.add(full);
        try {
          const pkg = JSON.parse(readFileSync(full, "utf8"));
          if (pkg.name) {
            packages.push({ dir, name: pkg.name, manifest: pkg });
          }
        } catch {
          // ignore malformed manifests
        }
      }
    }
  }
  return packages;
}

const packages = findPackages(root);
const violations = [];
for (const pkg of packages) {
  const srcDir = path.join(pkg.dir, "src");
  if (!existsSync(srcDir)) {
    continue;
  }
  const files = [];
  walk(srcDir, files);
  const imports = new Set();
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+["'](@sdkwork\/[^"']+)["']/gu)) {
      const spec = match[1];
      // Skip template-literal dynamic imports (e.g. `@sdkwork/${name}`) that
      // are not statically resolvable package imports.
      if (spec.includes("${")) {
        continue;
      }
      // Skip package self-references; Node resolves those through `exports`
      // without a node_modules link.
      if (spec === pkg.name || spec.startsWith(`${pkg.name}/`)) {
        continue;
      }
      const bare = spec.split("/").slice(0, 2).join("/");
      imports.add(bare);
    }
  }
  if (imports.size === 0) {
    continue;
  }
  const declared = new Set([
    ...Object.keys(pkg.manifest.dependencies ?? {}),
    ...Object.keys(pkg.manifest.peerDependencies ?? {}),
    ...Object.keys(pkg.manifest.devDependencies ?? {}),
  ]);
  const missing = [...imports].filter((spec) => !declared.has(spec)).sort();
  if (missing.length > 0) {
    violations.push({ name: pkg.name, dir: pkg.dir, missing });
  }
}

console.log(`packages audited: ${packages.length}`);
console.log(`packages with undeclared @sdkwork imports: ${violations.length}`);
for (const violation of violations.sort((a, b) => a.dir.localeCompare(b.dir))) {
  console.log(`- ${violation.name} (${violation.dir})`);
  for (const spec of violation.missing) {
    console.log(`    ${spec}`);
  }
}
