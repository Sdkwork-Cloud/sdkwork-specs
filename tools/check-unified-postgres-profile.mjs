#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const WORKSPACE_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  '..',
);

const CANONICAL_DEV = new Set(['sdkwork_ai_dev', 'postgres']);
const CANONICAL_PROD = new Set(['sdkwork_ai_prod', 'postgres']);
const CANONICAL_USER = new Set(['sdkwork_ai_dev', 'sdkwork_ai_prod', 'postgres', 'sdkworktest']);
const ALLOWED_TEST_DB = new Set(['sdkwork_drive_test', 'sdkwork_commerce_pc_test']);

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'artifacts', 'external', '.pnpm', '.runtime']);
const SKIP_FILES = new Set([
  path.normalize(path.join(WORKSPACE_ROOT, 'sdkwork-specs/tools/unify-postgres-profile.mjs')),
  path.normalize(path.join(WORKSPACE_ROOT, 'sdkwork-specs/tools/check-unified-postgres-profile.mjs')),
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

function inspectLine(line, filePath) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.includes('${')) {
    return null;
  }
  if (/sqlite:\/\//u.test(trimmed)) {
    return null;
  }

  const envName = trimmed.match(/^SDKWORK_(?!CLAW)([A-Z0-9_]+)_DATABASE_NAME=(.+)$/u);
  if (envName) {
    const value = envName[2].trim();
    if (!CANONICAL_DEV.has(value) && !CANONICAL_PROD.has(value)) {
      return `non-canonical SDKWORK_${envName[1]}_DATABASE_NAME=${value}`;
    }
  }

  const envUser = trimmed.match(/^SDKWORK_(?!CLAW)([A-Z0-9_]+)_DATABASE_USERNAME=(.+)$/u);
  if (envUser) {
    const value = envUser[2].trim();
    if (!CANONICAL_USER.has(value)) {
      return `non-canonical SDKWORK_${envUser[1]}_DATABASE_USERNAME=${value}`;
    }
  }

  const dbMatch = trimmed.match(/^database = "([^"]+)"/u);
  if (dbMatch) {
    const value = dbMatch[1];
    if (
      !CANONICAL_DEV.has(value)
      && !CANONICAL_PROD.has(value)
      && !ALLOWED_TEST_DB.has(value)
      && !value.includes('_test')
    ) {
      return `non-canonical database = "${value}"`;
    }
  }

  const userMatch = trimmed.match(/^username = "([^"]+)"/u);
  if (userMatch && !filePath.includes('[redis]')) {
    const value = userMatch[1];
    if (!CANONICAL_USER.has(value) && value !== 'admin') {
      return `non-canonical username = "${value}"`;
    }
  }

  const isDatabaseAssignment = /^(?:[A-Z0-9_]*(?:DATABASE|POSTGRES)[A-Z0-9_]*|database|username)\s*=/u
    .test(trimmed);
  if (
    isDatabaseAssignment
    && /sdkwork_chat_prod|sdkwork_knowledgebase_(dev|prod)|sdkwork_news_dev|sdkwork_forum_dev|sdkwork_discovery|sdkwork_documents(_dev)?|sdkwork_rtc|sdkwork_ai_prod_ai_dev/u.test(trimmed)
  ) {
    return 'legacy per-app database identity';
  }

  const documentsName = trimmed.match(/^DOCUMENTS_DATABASE_NAME=(.+)$/u);
  if (documentsName) {
    const value = documentsName[1].trim();
    if (!CANONICAL_DEV.has(value) && !CANONICAL_PROD.has(value)) {
      return `non-canonical DOCUMENTS_DATABASE_NAME=${value}`;
    }
  }

  const documentsUser = trimmed.match(/^DOCUMENTS_DATABASE_USERNAME=(.+)$/u);
  if (documentsUser) {
    const value = documentsUser[1].trim();
    if (!CANONICAL_USER.has(value)) {
      return `non-canonical DOCUMENTS_DATABASE_USERNAME=${value}`;
    }
  }

  if (/^DOCUMENTS_DATABASE_SCHEMA=public$/u.test(trimmed) && /development|\.development\./u.test(filePath)) {
    return 'legacy public schema development profile';
  }

  if (/sdkworkprod(@|%40)2026(\+\+|%2B%2B)/u.test(trimmed)) {
    return 'legacy mistaken password-as-username profile';
  }

  if (/^SDKWORK_CLAW_DATABASE_(NAME|USERNAME|SCHEMA)=sdkwork$/u.test(trimmed)) {
    return 'legacy bare sdkwork production identity';
  }

  if (/^database = "sdkwork"$/u.test(trimmed) || /^username = "sdkwork"$/u.test(trimmed)) {
    return 'legacy bare sdkwork production identity';
  }

  if (/^SDKWORK_CLAW_DATABASE_SCHEMA=public$/u.test(trimmed)) {
    return 'legacy public schema production profile';
  }

  if (/^SDKWORK_CLAW_DATABASE_HOST=\[::1\]$/u.test(trimmed)) {
    return 'non-canonical loopback host; use 127.0.0.1 per env.postgres.example';
  }

  if (/^schema = "public"$/u.test(trimmed) && /production|\.production\./u.test(filePath)) {
    return 'legacy public schema production profile';
  }

  return null;
}

const REQUIRED_ADMIN_ENV_KEYS = [
  'SDKWORK_CLAW_DATABASE_ADMIN_HOST',
  'SDKWORK_CLAW_DATABASE_ADMIN_PORT',
  'SDKWORK_CLAW_DATABASE_ADMIN_USERNAME',
  'SDKWORK_CLAW_DATABASE_ADMIN_PASSWORD',
  'SDKWORK_CLAW_DATABASE_ADMIN_DATABASE',
  'SDKWORK_CLAW_DATABASE_ADMIN_SSL_MODE',
];

function inspectPostgresExampleFile(filePath, content) {
  const issues = [];
  if (path.basename(filePath) !== '.env.postgres.example') {
    return issues;
  }
  const keys = new Set();
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([A-Z0-9_]+)=/u);
    if (match) {
      keys.add(match[1]);
    }
    const issue = inspectLine(line, filePath);
    if (issue) {
      issues.push(`${path.relative(WORKSPACE_ROOT, filePath)}: ${issue}`);
    }
  }
  for (const requiredKey of REQUIRED_ADMIN_ENV_KEYS) {
    if (!keys.has(requiredKey)) {
      issues.push(
        `${path.relative(WORKSPACE_ROOT, filePath)}: missing required ${requiredKey}`,
      );
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
  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const issue = inspectLine(line, filePath);
    if (issue) {
      issues.push(`${path.relative(WORKSPACE_ROOT, filePath)}:${index + 1}: ${issue}`);
    }
  }
  return issues;
}

function inspectPostgresInitScripts() {
  const issues = [];
  for (const entry of fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('sdkwork-')) {
      continue;
    }
    const repoRoot = path.join(WORKSPACE_ROOT, entry.name);
    const envExample = path.join(repoRoot, '.env.postgres.example');
    if (!fs.existsSync(envExample)) {
      continue;
    }
    const packageJsonPath = path.join(repoRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      issues.push(`${entry.name}: has .env.postgres.example but no package.json`);
      continue;
    }
    const packageJsonSource = fs
      .readFileSync(packageJsonPath, 'utf8')
      .replace(/^\uFEFF/u, '');
    const pkg = JSON.parse(packageJsonSource);
    const scripts = pkg.scripts ?? {};
    if (!scripts['db:postgres:init']) {
      issues.push(`${entry.name}: missing package.json script db:postgres:init`);
    }
    if (!scripts['db:postgres:plan']) {
      issues.push(`${entry.name}: missing package.json script db:postgres:plan`);
    }
  }
  return issues;
}

function main() {
  const violations = [];
  for (const entry of fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!entry.name.startsWith('sdkwork-') && entry.name !== 'sdkwork-specs') {
      continue;
    }
    for (const filePath of collectFiles(path.join(WORKSPACE_ROOT, entry.name))) {
      violations.push(...inspectConfigFile(filePath));
    }
  }
  violations.push(...inspectPostgresInitScripts());

  if (violations.length > 0) {
    process.stderr.write('Unified PostgreSQL profile violations found:\n');
    for (const violation of violations) {
      process.stderr.write(`- ${violation}\n`);
    }
    process.stderr.write('\nCanonical dev: sdkwork-specs/templates/env.postgres.example\n');
    process.stderr.write('Canonical prod: sdkwork-specs/templates/env.postgres.production.example\n');
    process.exit(1);
  }

  process.stdout.write('Unified PostgreSQL profile check passed.\n');
}

main();
