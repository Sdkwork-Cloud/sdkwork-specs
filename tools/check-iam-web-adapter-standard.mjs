#!/usr/bin/env node
/**
 * Validates IAM web-adapter integration in consumer repositories.
 * See IAM_SPEC.md and WEB_FRAMEWORK_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE = path.resolve(TOOL_DIR, '../..');

const IGNORE_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'artifacts', 'generated']);
const SCAN_SUBDIRS = ['crates', 'services', 'tools'];
const CANONICAL_RESOLVER_TYPE = 'IamWebRequestContextResolver';
const LEGACY_RESOLVER_TYPE = 'IamDatabaseWebRequestContextResolver';
const CANONICAL_FACTORY = 'iam_web_request_context_resolver_from_env';
const LEGACY_FACTORY = 'iam_database_resolver_from_env';
const PASS_THROUGH_WRAPPER_SUFFIX = '_web_resolver.rs';

function usage() {
  return [
    'Usage: node tools/check-iam-web-adapter-standard.mjs [--workspace <path>] [--root <path>]',
    '',
    'Scans consumer Rust sources for canonical IAM web-adapter integration:',
    `- type alias ${CANONICAL_RESOLVER_TYPE} (not ${LEGACY_RESOLVER_TYPE})`,
    `- factory ${CANONICAL_FACTORY} (not ${LEGACY_FACTORY})`,
    '- no application-local pass-through resolver wrappers',
  ].join('\n');
}

function fail(message, details = []) {
  console.error(`iam web-adapter standard failed: ${message}`);
  for (const detail of details.slice(0, 100)) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function relative(root, file) {
  return path.relative(root, file).replace(/\\/g, '/');
}

function isAllowedIamAdapterSource(rel) {
  return rel.includes('sdkwork-iam-web-adapter/src/');
}

function listScanRoots(repoRoot) {
  const roots = [];
  for (const sub of SCAN_SUBDIRS) {
    const dir = path.join(repoRoot, sub);
    if (fs.existsSync(dir)) roots.push(dir);
  }
  return roots;
}

function listSdkworkRepos(workspaceRoot) {
  return fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspaceRoot, entry.name))
    .sort();
}

function scanRepo(repoRoot) {
  const issues = [];
  const repoName = path.basename(repoRoot);
  const files = listScanRoots(repoRoot)
    .flatMap((dir) => walk(dir))
    .filter((file) => file.endsWith('.rs'));

  for (const file of files) {
    const rel = relative(repoRoot, file);
    if (isAllowedIamAdapterSource(rel)) continue;

    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(LEGACY_RESOLVER_TYPE)) {
      issues.push(
        `${repoName}: ${rel}: use ${CANONICAL_RESOLVER_TYPE} instead of ${LEGACY_RESOLVER_TYPE}`,
      );
    }
    if (text.includes(LEGACY_FACTORY)) {
      issues.push(
        `${repoName}: ${rel}: use ${CANONICAL_FACTORY} instead of ${LEGACY_FACTORY}`,
      );
    }
    if (rel.endsWith(PASS_THROUGH_WRAPPER_SUFFIX)) {
      issues.push(
        `${repoName}: ${rel}: remove application-local IAM pass-through resolver wrapper; wire sdkwork-iam-web-adapter directly`,
      );
    }
  }

  return issues;
}

const parsed = parseArgs({
  options: {
    workspace: { type: 'string' },
    root: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const workspaceRoot = path.resolve(parsed.values.workspace || DEFAULT_WORKSPACE);
const explicitRoot = parsed.values.root ? path.resolve(parsed.values.root) : null;
const repoRoots = explicitRoot ? [explicitRoot] : listSdkworkRepos(workspaceRoot);

const issues = repoRoots.flatMap((repoRoot) => scanRepo(repoRoot));

if (issues.length > 0) {
  fail(`found ${issues.length} iam web-adapter issue(s)`, issues);
}

const scope = explicitRoot ? relative(workspaceRoot, explicitRoot) || explicitRoot : 'workspace';
console.log(`iam web-adapter standard ok: ${scope} (${repoRoots.length} repo(s))`);
