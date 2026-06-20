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
const SCAN_DIRS = ['configs/topology', 'deployments/templates', 'config/server', 'config/container', 'config/desktop'];

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
  if (filePath.includes(`${path.sep}configs${path.sep}topology${path.sep}`) && base.endsWith('.env')) {
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

  if (/sdkwork_chat_prod|sdkwork_knowledgebase_(dev|prod)|sdkwork_news_dev|sdkwork_forum_dev|sdkwork_discovery"/u.test(trimmed)) {
    return 'legacy per-app database identity';
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

  if (/^schema = "public"$/u.test(trimmed) && /production|\.production\./u.test(filePath)) {
    return 'legacy public schema production profile';
  }

  return null;
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
      const content = fs.readFileSync(filePath, 'utf8');
      for (const [index, line] of content.split(/\r?\n/u).entries()) {
        const issue = inspectLine(line, filePath);
        if (issue) {
          violations.push(`${path.relative(WORKSPACE_ROOT, filePath)}:${index + 1}: ${issue}`);
        }
      }
    }
  }

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
