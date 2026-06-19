#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const REQUIRED_ROOT_SCRIPTS = ['dev', 'build', 'test', 'check', 'verify', 'clean'];

const ALLOWED_FIRST_SEGMENTS = new Set([
  'dev',
  'start',
  'preview',
  'build',
  'test',
  'check',
  'verify',
  'clean',
  'typecheck',
  'lint',
  'format',
  'release',
  'deploy',
  'db',
  'api',
  'sdk',
  'gateway',
  'topology',
  'workflow',
  'sbom',
  'nginx',
  'docker',
  'desktop',
  'tauri',
  'android',
  'ios',
  'harmony',
  'flutter',
  'mini-program',
  'docs',
  'perf',
  'migrate',
  'install',
  'admin',
  'models',
  'downloads',
  'skills',
  'app-store',
  'smoke',
]);

const RETIRED_SCRIPT_TOKENS = new Set(['self-hosted', 'cloud-hosted', 'hosting', 'deploymentMode']);
const DEPLOYMENT_PROFILES = new Set(['standalone', 'cloud']);

function usage() {
  return [
    'Usage: node tools/check-pnpm-script-standard.mjs --root <repo> [--product-prefix a,b,c]',
    '',
    'Validates SDKWork repository root package.json scripts against PNPM_SCRIPT_SPEC.md.',
  ].join('\n');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function splitCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fail(message, details = []) {
  console.error(`pnpm script standard failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function isPackageJsonGenerated(packagePath) {
  const normalized = packagePath.replaceAll(path.sep, '/');
  return normalized.includes('/generated/') || normalized.includes('/.sdkwork/manual-backups/');
}

function validateGatewayName(scriptName, issues) {
  const parts = scriptName.split(':');
  if (parts[0] !== 'gateway' || parts.length < 3) return;
  if (DEPLOYMENT_PROFILES.has(parts[1])) {
    issues.push(
      `${scriptName}: use gateway:<action>[:deploymentProfile], for example gateway:${parts[2]}:${parts[1]}`,
    );
  }
}

function validateRootScripts(root, productPrefixes) {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    fail(`missing root package.json at ${packagePath}`);
  }

  const manifest = readJson(packagePath);
  const scripts = manifest.scripts || {};
  const scriptNames = Object.keys(scripts).sort();
  const issues = [];

  for (const required of REQUIRED_ROOT_SCRIPTS) {
    if (!scripts[required]) {
      issues.push(`missing required root script "${required}"`);
    }
  }

  for (const scriptName of scriptNames) {
    const first = scriptName.split(':')[0];
    if (!ALLOWED_FIRST_SEGMENTS.has(first)) {
      issues.push(`${scriptName}: first segment "${first}" is not a standard public namespace`);
    }
    if (productPrefixes.includes(first)) {
      issues.push(`${scriptName}: product-prefixed public root scripts are forbidden`);
    }
    for (const token of scriptName.split(':')) {
      if (RETIRED_SCRIPT_TOKENS.has(token)) {
        issues.push(`${scriptName}: retired token "${token}" must not appear in public scripts`);
      }
    }
    validateGatewayName(scriptName, issues);
  }

  if (issues.length > 0) {
    fail(`${path.relative(process.cwd(), packagePath)} is not compliant`, issues);
  }

  return { packagePath, scriptCount: scriptNames.length };
}

function validatePackageLocalScripts(root) {
  const packagePaths = [];
  const ignoredDirs = new Set(['node_modules', '.pnpm', 'target', 'dist', '.vite']);

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.name === 'package.json') {
        packagePaths.push(path.join(dir, entry.name));
      }
    }
  }

  walk(root);
  const issues = [];

  for (const packagePath of packagePaths) {
    if (packagePath === path.join(root, 'package.json')) continue;
    if (isPackageJsonGenerated(packagePath)) continue;

    const manifest = readJson(packagePath);
    const scripts = manifest.scripts || {};
    for (const scriptName of Object.keys(scripts)) {
      for (const token of scriptName.split(':')) {
        if (RETIRED_SCRIPT_TOKENS.has(token)) {
          issues.push(`${path.relative(root, packagePath)}#${scriptName}: retired token "${token}"`);
        }
      }
    }
  }

  if (issues.length > 0) {
    fail('package-local scripts are not compliant', issues);
  }

  return packagePaths.length;
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    'product-prefix': { type: 'string', multiple: true },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const root = path.resolve(parsed.values.root || process.cwd());
const productPrefixes = parsed.values['product-prefix']
  ? parsed.values['product-prefix'].flatMap(splitCsv)
  : [];

const rootResult = validateRootScripts(root, productPrefixes);
const packageCount = validatePackageLocalScripts(root);

console.log(
  `pnpm script standard ok: ${path.relative(process.cwd(), rootResult.packagePath) || rootResult.packagePath} (${rootResult.scriptCount} root scripts, ${packageCount} package manifests scanned)`,
);
