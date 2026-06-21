#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRAMEWORK_PACKAGE = '@sdkwork/iam-application-bootstrap';
const FRAMEWORK_PACKAGE_PATH = 'packages/common/iam/sdkwork-iam-application-bootstrap';
const REQUIRED_BOOTSTRAP_SCRIPT = 'admin:bootstrap:app';
const FORBIDDEN_BOOTSTRAP_HTTP_MARKERS = [
  '/backend/v3/api/iam/applications/register',
  '/backend/v3/api/iam/tenant-applications',
  '/backend/v3/api/iam/tenant_applications',
  '/backend/v3/api/iam/access-credentials',
  '/backend/v3/api/iam/access_credentials',
];
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'target', 'dist', 'build', '.turbo', 'generated']);

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root') {
      args.root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    }
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function listFiles(rootDir, predicate, maxDepth = 8, depth = 0, results = []) {
  if (depth > maxDepth || !fs.existsSync(rootDir)) {
    return results;
  }
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      listFiles(fullPath, predicate, maxDepth, depth + 1, results);
    } else if (predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findAppManifests(rootDir) {
  return listFiles(rootDir, (filePath) => path.basename(filePath) === 'sdkwork.app.config.json');
}

function findBootstrapScripts(rootDir) {
  return listFiles(rootDir, (filePath) => {
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.includes('/scripts/bootstrap/') && normalized.endsWith('.mjs');
  });
}

function packageJsonAt(rootDir) {
  const filePath = path.join(rootDir, 'package.json');
  return fs.existsSync(filePath) ? readJson(filePath) : null;
}

function hasFrameworkDependency(packageJson) {
  if (!packageJson) {
    return false;
  }
  const sections = [packageJson.dependencies, packageJson.devDependencies, packageJson.peerDependencies];
  return sections.some((section) => section && section[FRAMEWORK_PACKAGE]);
}

function validateManifestPermissions(manifestPath, failures) {
  let manifest;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    failures.push(`${manifestPath}: invalid sdkwork.app.config.json (${error.message})`);
    return;
  }

  const permissions =
    manifest.backend?.accessTokenPermissionScope ??
    manifest.backend?.permissionScope ??
    [];

  if (!Array.isArray(permissions) || permissions.length === 0) {
    failures.push(
      `${manifestPath}: backend.accessTokenPermissionScope (or backend.permissionScope) must be a non-empty string array for IAM bootstrap`,
    );
  }
}

function validateBootstrapScript(scriptPath, failures) {
  const text = readText(scriptPath);
  const relativePath = scriptPath.replace(/\\/g, '/');

  if (!text.includes(FRAMEWORK_PACKAGE)) {
    failures.push(`${relativePath}: bootstrap script must import ${FRAMEWORK_PACKAGE}`);
  }

  for (const marker of FORBIDDEN_BOOTSTRAP_HTTP_MARKERS) {
    if (text.includes(marker)) {
      failures.push(`${relativePath}: bootstrap script must not embed raw bootstrap HTTP path ${marker}`);
    }
  }
}

export function validateIamApplicationBootstrapStandard(rootDir) {
  const failures = [];
  const packageJson = packageJsonAt(rootDir);
  const manifests = findAppManifests(rootDir);
  const bootstrapScripts = findBootstrapScripts(rootDir);
  const hasFrameworkPackageDir = fs.existsSync(path.join(rootDir, FRAMEWORK_PACKAGE_PATH));

  if (hasFrameworkPackageDir) {
    const frameworkPackageJson = packageJsonAt(path.join(rootDir, FRAMEWORK_PACKAGE_PATH));
    if (!frameworkPackageJson || frameworkPackageJson.name !== FRAMEWORK_PACKAGE) {
      failures.push(`${FRAMEWORK_PACKAGE_PATH}/package.json must declare name ${FRAMEWORK_PACKAGE}`);
    }
    if (!packageJson?.scripts?.[REQUIRED_BOOTSTRAP_SCRIPT]) {
      failures.push(`root package.json must expose ${REQUIRED_BOOTSTRAP_SCRIPT} for IAM application bootstrap`);
    }
    if (!hasFrameworkDependency(packageJson)) {
      failures.push(`root package.json must depend on ${FRAMEWORK_PACKAGE}`);
    }
  }

  for (const manifestPath of manifests) {
    validateManifestPermissions(manifestPath, failures);
  }

  for (const scriptPath of bootstrapScripts) {
    validateBootstrapScript(scriptPath, failures);
  }

  if ((manifests.length > 0 || bootstrapScripts.length > 0) && !hasFrameworkDependency(packageJson) && !hasFrameworkPackageDir) {
    failures.push(
      `repository declares app bootstrap surfaces but does not depend on ${FRAMEWORK_PACKAGE}; add the framework package or remove local bootstrap duplication`,
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    summary: {
      manifests: manifests.length,
      bootstrapScripts: bootstrapScripts.length,
      hasFrameworkPackageDir,
    },
  };
}

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  const result = validateIamApplicationBootstrapStandard(root);
  if (!result.ok) {
    console.error('IAM application bootstrap standard failed:');
    for (const failure of result.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
  console.log(
    `IAM application bootstrap standard ok (${result.summary.manifests} manifest(s), ${result.summary.bootstrapScripts} bootstrap script(s))`,
  );
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  main();
}
