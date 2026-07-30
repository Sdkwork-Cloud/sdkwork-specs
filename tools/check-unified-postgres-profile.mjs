#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_WORKSPACE_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  '..',
);
let scanRoot = DEFAULT_WORKSPACE_ROOT;

const CANONICAL_CONNECTION_DATABASES = new Set([
  'sdkwork_ai_dev',
  'sdkwork_ai_staging',
  'sdkwork_ai_prod',
]);
const CANONICAL_CONNECTION_USERS = new Set([
  'sdkwork_ai_dev',
  'sdkwork_ai_test',
  'sdkwork_ai_staging',
  'sdkwork_ai_prod',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'artifacts', 'external', '.pnpm', '.runtime']);
const SKIP_FILES = new Set([
  path.normalize(path.join(DEFAULT_WORKSPACE_ROOT, 'sdkwork-specs/tools/unify-postgres-profile.mjs')),
  path.normalize(path.join(DEFAULT_WORKSPACE_ROOT, 'sdkwork-specs/tools/check-unified-postgres-profile.mjs')),
]);

const SCAN_SUFFIXES = ['.env.postgres.example', '.toml.example', '.yaml.example', '.yml.example'];
const SCAN_DIRS = ['etc/topology', 'deployments/templates', 'config/server', 'config/container', 'config/desktop'];

function isCheckedInConfigFile(filePath) {
  const normalized = path.normalize(filePath);
  if (SKIP_FILES.has(normalized)) {
    return false;
  }
  const base = path.basename(filePath);
  if (SCAN_SUFFIXES.some((suffix) => base.endsWith(suffix))) {
    return true;
  }
  if (base === '.env.postgres.example') {
    return true;
  }
  if (filePath.includes(`${path.sep}etc${path.sep}topology${path.sep}`) && base.endsWith('.env')) {
    return true;
  }
  if (filePath.includes(`${path.sep}deployments${path.sep}templates${path.sep}`)) {
    return true;
  }
  if (filePath.includes(`${path.sep}bin${path.sep}init-config-server.`)) {
    return true;
  }
  for (const dir of SCAN_DIRS) {
    if (filePath.includes(`${path.sep}${dir.replace('/', path.sep)}${path.sep}`) && base.endsWith('.example')) {
      return true;
    }
  }
  return false;
}

function collectFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
      continue;
    }
    if (isCheckedInConfigFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isWorkspaceTestIdentity(value) {
  return value === 'sdkwork_ai_test_<run_id>'
    || /^sdkwork_ai_test(?:_[a-z0-9]+(?:_[a-z0-9]+)*)?$/u.test(value);
}

function isCanonicalWorkspaceDatabase(value) {
  return CANONICAL_CONNECTION_DATABASES.has(value) || isWorkspaceTestIdentity(value);
}

function expectedConnectionIdentity(filePath) {
  const normalized = filePath.replace(/\\/gu, '/').toLowerCase();
  if (normalized.includes('production')) {
    return {
      database: 'sdkwork_ai_prod',
      label: 'sdkwork_ai_prod',
      schema: 'sdkwork_ai_prod',
      username: 'sdkwork_ai_prod',
    };
  }
  if (normalized.includes('staging')) {
    return {
      database: 'sdkwork_ai_staging',
      label: 'sdkwork_ai_staging',
      schema: 'sdkwork_ai_staging',
      username: 'sdkwork_ai_staging',
    };
  }
  if (normalized.includes('test')) {
    return {
      isTest: true,
      label: 'sdkwork_ai_test or sdkwork_ai_test_<run_id>',
      username: 'sdkwork_ai_test',
    };
  }
  if (
    normalized.includes('development')
    || path.basename(filePath).toLowerCase() === '.env.postgres.example'
  ) {
    return {
      database: 'sdkwork_ai_dev',
      label: 'sdkwork_ai_dev',
      schema: 'sdkwork_ai_dev',
      username: 'sdkwork_ai_dev',
    };
  }
  return null;
}

function matchesExpectedConnection(value, expected, field = 'database') {
  if (!expected) {
    return field === 'username'
      ? CANONICAL_CONNECTION_USERS.has(value)
      : isCanonicalWorkspaceDatabase(value);
  }
  if (expected.isTest) {
    return field === 'username'
      ? value === expected.username
      : isWorkspaceTestIdentity(value);
  }
  return value === expected[field];
}

function unquoteValue(value) {
  const trimmed = String(value ?? '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function retiredDatabaseKey(line) {
  const candidate = line.trim().replace(/^#\s*/u, '');
  const match = candidate.match(
    /^(SDKWORK_(?!DATABASE_)([A-Z0-9_]+)_DATABASE_([A-Z0-9_]+))\s*=/u,
  );
  if (!match) {
    return null;
  }
  return `retired application/module-prefixed database key ${match[1]}; use SDKWORK_DATABASE_*`;
}

export function inspectLine(line, filePath, { section } = {}) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const retiredKeyIssue = retiredDatabaseKey(trimmed);
  if (retiredKeyIssue) {
    return retiredKeyIssue;
  }

  if (trimmed.startsWith('#')) {
    return null;
  }
  if (trimmed.includes('${') || trimmed.includes('DEPLOY_INJECT:') || /sqlite:\/\//u.test(trimmed)) {
    return null;
  }

  if (/^SDKWORK_DATABASE_SSLMODE\s*=/u.test(trimmed)) {
    return 'retired SDKWORK_DATABASE_SSLMODE key; use SDKWORK_DATABASE_SSL_MODE';
  }
  if (/^(?:DATABASE_PROVIDER|DATABASE_SSLMODE)\s*=/u.test(trimmed)) {
    return 'retired database key; use SDKWORK_DATABASE_ENGINE or SDKWORK_DATABASE_SSL_MODE';
  }

  const workspaceIdentity = trimmed.match(
    /^SDKWORK_DATABASE_(NAME|SCHEMA|USERNAME)\s*=\s*(.+)$/u,
  );
  if (workspaceIdentity) {
    const field = workspaceIdentity[1];
    const value = unquoteValue(workspaceIdentity[2]);
    const normalizedField = field === 'NAME' ? 'database' : field.toLowerCase();
    const expected = expectedConnectionIdentity(filePath);
    const isAllowed = matchesExpectedConnection(value, expected, normalizedField);
    if (!isAllowed) {
      return `non-canonical SDKWORK_DATABASE_${field}=${value}; expected ${expected?.label ?? 'sdkwork_ai_dev, sdkwork_ai_test, sdkwork_ai_staging, or sdkwork_ai_prod'}`;
    }
  }

  const normalizedSection = String(section ?? '').trim().toLowerCase();
  const isDatabaseSection = !normalizedSection || normalizedSection === 'database';
  const isDatabaseAdminSection = normalizedSection.startsWith('database.admin')
    || normalizedSection.startsWith('database_admin');

  const dbMatch = isDatabaseSection && trimmed.match(/^database = "([^"]+)"/u);
  if (dbMatch) {
    const value = dbMatch[1];
    const expected = expectedConnectionIdentity(filePath);
    if (!matchesExpectedConnection(value, expected, 'database')) {
      return `non-canonical database = "${value}"; expected ${expected?.label ?? 'a canonical workspace PostgreSQL database'}`;
    }
  }

  const userMatch = isDatabaseSection && trimmed.match(/^username = "([^"]+)"/u);
  if (userMatch) {
    const value = userMatch[1];
    const expected = expectedConnectionIdentity(filePath);
    if (!matchesExpectedConnection(value, expected, 'username')) {
      return `non-canonical username = "${value}"; expected ${expected?.username ?? 'a canonical workspace PostgreSQL user'}`;
    }
  }

  const schemaMatch = isDatabaseSection && trimmed.match(/^schema = "([^"]+)"/u);
  if (schemaMatch) {
    const value = schemaMatch[1];
    const expected = expectedConnectionIdentity(filePath);
    if (!matchesExpectedConnection(value, expected, 'schema')) {
      return `non-canonical schema = "${value}"; expected ${expected?.label ?? 'a canonical workspace PostgreSQL schema'}`;
    }
  }

  const databaseUrlMatch = !isDatabaseAdminSection && trimmed.match(
    /^(?:SDKWORK_DATABASE_URL|SDKWORK_[A-Z0-9_]+_DATABASE_URL|url)\s*=\s*"?postgres(?:ql)?:\/\/[^/\s"]+\/([^?&\s"]+)/iu,
  );
  if (databaseUrlMatch) {
    const value = decodeURIComponent(databaseUrlMatch[1]);
    const expected = expectedConnectionIdentity(filePath);
    if (
      (expected && !matchesExpectedConnection(value, expected, 'database'))
      || (
        !expected
        && !isCanonicalWorkspaceDatabase(value)
      )
    ) {
      return `non-canonical PostgreSQL URL database=${value}; expected ${expected?.label ?? 'a canonical workspace PostgreSQL database'}`;
    }
  }

  const isDatabaseAssignment = /^(?:[A-Z0-9_]*(?:DATABASE|POSTGRES)[A-Z0-9_]*|database|username)\s*=/u
    .test(trimmed);
  if (
    isDatabaseAssignment
    && /sdkwork_(?!ai_(?:dev|test|staging|prod)(?:\b|_))[a-z0-9_]+_(?:dev|test|staging|prod)\b/iu.test(trimmed)
  ) {
    return 'application-specific database identity; use the workspace sdkwork_ai_<environment> identity';
  }
  if (
    isDatabaseAssignment
    && /sdkwork_chat_prod|sdkwork_knowledgebase_(dev|prod)|sdkwork_news_dev|sdkwork_forum_dev|sdkwork_discovery|sdkwork_documents(_dev)?|sdkwork_rtc|sdkwork_ai_prod_ai_dev/u.test(trimmed)
  ) {
    return 'legacy per-app database identity';
  }

  if (/sdkworkprod(@|%40)2026(\+\+|%2B%2B)/u.test(trimmed)) {
    return 'legacy mistaken password-as-username profile';
  }

  if (/^SDKWORK_DATABASE_(NAME|USERNAME|SCHEMA)=sdkwork$/u.test(trimmed)) {
    return 'legacy bare sdkwork production identity';
  }

  if (/^database = "sdkwork"$/u.test(trimmed) || /^username = "sdkwork"$/u.test(trimmed)) {
    return 'legacy bare sdkwork production identity';
  }

  if (/^SDKWORK_DATABASE_SCHEMA=public$/u.test(trimmed)) {
    return 'legacy public schema production profile';
  }

  if (/^SDKWORK_DATABASE_HOST=\[::1\]$/u.test(trimmed)) {
    return 'non-canonical loopback host; use 127.0.0.1 per env.postgres.example';
  }

  if (/^schema = "public"$/u.test(trimmed) && /production|\.production\./u.test(filePath)) {
    return 'legacy public schema production profile';
  }

  return null;
}

const REQUIRED_WORKSPACE_ENV_KEYS = [
  'SDKWORK_DATABASE_ENGINE',
  'SDKWORK_DATABASE_HOST',
  'SDKWORK_DATABASE_PORT',
  'SDKWORK_DATABASE_NAME',
  'SDKWORK_DATABASE_SCHEMA',
  'SDKWORK_DATABASE_USERNAME',
  'SDKWORK_DATABASE_PASSWORD',
  'SDKWORK_DATABASE_SSL_MODE',
  'SDKWORK_DATABASE_MAX_CONNECTIONS',
  'SDKWORK_DATABASE_ADMIN_HOST',
  'SDKWORK_DATABASE_ADMIN_PORT',
  'SDKWORK_DATABASE_ADMIN_USERNAME',
  'SDKWORK_DATABASE_ADMIN_PASSWORD',
  'SDKWORK_DATABASE_ADMIN_DATABASE',
  'SDKWORK_DATABASE_ADMIN_SSL_MODE',
];

const ALLOWED_WORKSPACE_ENV_KEYS = new Set([
  ...REQUIRED_WORKSPACE_ENV_KEYS,
  'SDKWORK_DATABASE_URL',
  'SDKWORK_DATABASE_FILE',
  'SDKWORK_DATABASE_PASSWORD_FILE',
  'SDKWORK_DATABASE_SCHEMA_FALLBACK_PUBLIC',
  'SDKWORK_DATABASE_MIN_CONNECTIONS',
  'SDKWORK_DATABASE_ACQUIRE_TIMEOUT',
  'SDKWORK_DATABASE_IDLE_TIMEOUT',
  'SDKWORK_DATABASE_MAX_LIFETIME',
  'SDKWORK_DATABASE_MODULE_ID',
  'SDKWORK_DATABASE_AUTO_MIGRATE',
  'SDKWORK_DATABASE_AUTO_SEED',
  'SDKWORK_DATABASE_SEED_ON_BOOT',
  'SDKWORK_DATABASE_SEED_LOCALE',
  'SDKWORK_DATABASE_SEED_PROFILE',
  'SDKWORK_DATABASE_SEED_I18N_VERSION',
  'SDKWORK_DATABASE_DRIFT_INTERVAL_SEC',
  'SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION',
  'SDKWORK_DATABASE_TEMPORARY_DRIVER_POOL_COUNT',
  'SDKWORK_DATABASE_ADMIN_URL',
  'SDKWORK_DATABASE_ADMIN_PASSWORD_FILE',
]);

function inspectPostgresExampleFile(filePath, content) {
  const issues = [];
  if (path.basename(filePath) !== '.env.postgres.example') {
    return issues;
  }
  const keys = new Set();
  const keyCounts = new Map();
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const issue = inspectLine(line, filePath);
    if (issue) {
      issues.push(`${path.relative(scanRoot, filePath)}: ${issue}`);
    }
    if (trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([A-Z0-9_]+)=/u);
    if (match) {
      keys.add(match[1]);
      keyCounts.set(match[1], (keyCounts.get(match[1]) ?? 0) + 1);
      if (match[1].startsWith('SDKWORK_DATABASE_') && !ALLOWED_WORKSPACE_ENV_KEYS.has(match[1])) {
        issues.push(
          `${path.relative(scanRoot, filePath)}: unsupported workspace database key ${match[1]}`,
        );
      }
    }
  }
  for (const requiredKey of REQUIRED_WORKSPACE_ENV_KEYS) {
    if (!keys.has(requiredKey)) {
      issues.push(
        `${path.relative(scanRoot, filePath)}: missing required ${requiredKey}`,
      );
    }
  }
  for (const [key, count] of keyCounts) {
    if (count > 1) {
      issues.push(`${path.relative(scanRoot, filePath)}: duplicate ${key}`);
    }
  }
  return issues;
}

function inspectConfigFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (path.basename(filePath) === '.env.postgres.example') {
    return inspectPostgresExampleFile(filePath, content);
  }
  const issues = [];
  let section = '';
  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const sectionMatch = line.trim().match(/^\[([^\]]+)\]$/u);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const issue = inspectLine(line, filePath, { section });
    if (issue) {
      issues.push(`${path.relative(scanRoot, filePath)}:${index + 1}: ${issue}`);
    }
  }
  return issues;
}

function inspectPostgresInitScripts(repoRoots) {
  const issues = [];
  for (const repoRoot of repoRoots) {
    const repoName = path.basename(repoRoot);
    const envExample = path.join(repoRoot, '.env.postgres.example');
    if (!fs.existsSync(envExample)) {
      continue;
    }
    const packageJsonPath = path.join(repoRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      issues.push(`${repoName}: has .env.postgres.example but no package.json`);
      continue;
    }
    const packageJsonSource = fs
      .readFileSync(packageJsonPath, 'utf8')
      .replace(/^\uFEFF/u, '');
    const pkg = JSON.parse(packageJsonSource);
    const scripts = pkg.scripts ?? {};
    if (!scripts['db:postgres:init']) {
      issues.push(`${repoName}: missing package.json script db:postgres:init`);
    }
    if (!scripts['db:postgres:plan']) {
      issues.push(`${repoName}: missing package.json script db:postgres:plan`);
    }
  }
  return issues;
}

function resolveScanRoot(args) {
  const rootIndex = args.indexOf('--root');
  if (rootIndex === -1) {
    return DEFAULT_WORKSPACE_ROOT;
  }
  const value = args[rootIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--root requires a repository or workspace path');
  }
  return path.resolve(process.cwd(), value);
}

function repositoryRoots(root) {
  const rootName = path.basename(root);
  if (rootName.startsWith('sdkwork-') || rootName === 'sdkwork-specs') {
    return [root];
  }
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name.startsWith('sdkwork-') || entry.name === 'sdkwork-specs')
    .map((entry) => path.join(root, entry.name));
}

function main(args = process.argv.slice(2)) {
  scanRoot = resolveScanRoot(args);
  if (!fs.existsSync(scanRoot) || !fs.statSync(scanRoot).isDirectory()) {
    throw new Error(`scan root is not a directory: ${scanRoot}`);
  }
  const repoRoots = repositoryRoots(scanRoot);
  const violations = [];
  for (const repoRoot of repoRoots) {
    for (const filePath of collectFiles(repoRoot)) {
      violations.push(...inspectConfigFile(filePath));
    }
  }
  violations.push(...inspectPostgresInitScripts(repoRoots));

  if (violations.length > 0) {
    process.stderr.write('Unified PostgreSQL profile violations found:\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.stderr.write('\nCanonical dev: sdkwork_ai_dev / SDKWORK_DATABASE_*\n');
    process.stderr.write('Canonical test: sdkwork_ai_test or sdkwork_ai_test_<run_id> / SDKWORK_DATABASE_*\n');
    process.stderr.write('Canonical staging: sdkwork_ai_staging / SDKWORK_DATABASE_*\n');
    process.stderr.write('Canonical prod: sdkwork_ai_prod / SDKWORK_DATABASE_*\n');
    process.stderr.write('Templates: sdkwork-specs/templates/env.postgres.example and env.postgres.production.example\n');
    process.exit(1);
  }

  process.stdout.write('Unified PostgreSQL profile check passed.\n');
}

if (
  process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
) {
  main();
}
