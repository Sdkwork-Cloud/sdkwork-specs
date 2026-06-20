#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const WORKSPACE_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  '..',
);

const TEXT_REPLACEMENTS = [
  ['sdkwork_chat_prod', 'sdkwork'],
  ['sdkwork_knowledgebase_dev', 'sdkwork_ai_dev'],
  ['sdkwork_knowledgebase_prod', 'sdkwork'],
  ['sdkwork_news_dev', 'sdkwork_ai_dev'],
  ['sdkwork_forum_dev', 'sdkwork_ai_dev'],
  ['sdkwork_drive_dev', 'sdkwork_ai_dev'],
  ['sdkwork_drive_prod', 'sdkwork'],
  ['sdkwork_drive_staging', 'sdkwork'],
  ['sdkwork_commerce_pc_dev', 'sdkwork_ai_dev'],
  ['sdkwork_commerce_pc_prod', 'sdkwork'],
  ['sdkwork_commerce_pc_staging', 'sdkwork'],
  ['sdkwork_video_prod', 'sdkwork'],
  ['sdkwork_terminal_production', 'sdkwork'],
  ['sdkwork_ai_prod', 'sdkwork'],
  ['sdkworkprod@2026++', 'sdkwork'],
  ['username = "sdkworkdev"', 'username = "sdkwork_ai_dev"'],
  ['username = "sdkworkdrive"', 'username = "sdkwork"'],
  ['username = "sdkworkcommerce"', 'username = "sdkwork"'],
  ['database = "sdkwork_discovery"', 'database = "sdkwork_ai_dev"'],
  ['username = "sdkwork_discovery"', 'username = "sdkwork_ai_dev"'],
  ['SDKWORK_IM_DATABASE_NAME=sdkwork', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork'],
  ['SDKWORK_IM_DATABASE_SCHEMA=sdkwork', 'SDKWORK_CLAW_DATABASE_SCHEMA=public'],
  ['SDKWORK_IM_DATABASE_USERNAME=sdkwork', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork'],
  ['SDKWORK_IM_DATABASE_NAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_IM_DATABASE_SCHEMA=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev'],
  ['SDKWORK_IM_DATABASE_USERNAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_IM_DATABASE_PASSWORD=sdkworkdev123', 'SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123'],
  ['SDKWORK_DISCOVERY_DATABASE_NAME=sdkwork_discovery', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_DISCOVERY_DATABASE_USERNAME=sdkwork_discovery', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_NEWS_DATABASE_NAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_NEWS_DATABASE_USERNAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_NEWS_DATABASE_PASSWORD=sdkworknews123', 'SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123'],
  ['schema = "sdkwork"', 'schema = "public"'],
  ['schema: sdkwork', 'schema: public'],
  ['CREATE SCHEMA IF NOT EXISTS sdkwork AUTHORIZATION "sdkwork"', 'CREATE SCHEMA IF NOT EXISTS public AUTHORIZATION "sdkwork"'],
  ['GRANT USAGE, CREATE ON SCHEMA sdkwork TO "sdkwork"', 'GRANT USAGE, CREATE ON SCHEMA public TO "sdkwork"'],
  ['ALTER DEFAULT PRIVILEGES IN SCHEMA sdkwork', 'ALTER DEFAULT PRIVILEGES IN SCHEMA public'],
  ['ALTER ROLE "sdkwork" SET search_path TO sdkwork, public', 'ALTER ROLE "sdkwork" SET search_path TO public'],
  ['url = "postgres://prod-db:5432/sdkwork_terminal_production"', 'url = "postgresql://sdkwork@db.example.com:5432/sdkwork?sslmode=require"'],
  ['url = "postgresql://prod-host:5432/sdkwork"', 'url = "postgresql://sdkwork@db.example.com:5432/sdkwork?sslmode=require"'],
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'artifacts', 'external', '.pnpm']);
const SKIP_FILES = new Set([
  path.normalize(path.join(WORKSPACE_ROOT, 'sdkwork-specs/tools/unify-postgres-profile.mjs')),
  path.normalize(path.join(WORKSPACE_ROOT, 'sdkwork-specs/tools/check-unified-postgres-profile.mjs')),
]);

const ALLOWED_SUFFIXES = ['.env', '.example', '.toml.example', '.md', '.mjs', '.ps1', '.sh', '.yaml.example', '.yml.example'];

function shouldScanFile(filePath) {
  const normalized = path.normalize(filePath);
  if (SKIP_FILES.has(normalized)) {
    return false;
  }
  const base = path.basename(filePath);
  if (base === '.env.postgres' || base === '.env.postgres.example') {
    return true;
  }
  if (base.includes('postgres') && base.endsWith('.env')) {
    return true;
  }
  return ALLOWED_SUFFIXES.some((suffix) => filePath.endsWith(suffix));
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
    if (shouldScanFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeProductionSchema(content, filePath) {
  if (!/(production|staging)/u.test(filePath)) {
    return content;
  }
  return content.replace(/database = "sdkwork"\r?\nschema = "sdkwork_ai_dev"/g, 'database = "sdkwork"\nschema = "public"');
}

function applyReplacements(content, filePath) {
  let next = content;
  for (const [from, to] of TEXT_REPLACEMENTS) {
    if (from !== to) {
      next = next.split(from).join(to);
    }
  }
  return normalizeProductionSchema(next, filePath);
}

function main() {
  const changed = [];
  for (const entry of fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (!entry.name.startsWith('sdkwork-') && entry.name !== 'sdkwork-specs') {
      continue;
    }
    for (const filePath of collectFiles(path.join(WORKSPACE_ROOT, entry.name))) {
      const original = fs.readFileSync(filePath, 'utf8');
      const updated = applyReplacements(original, filePath);
      if (updated !== original) {
        fs.writeFileSync(filePath, updated, 'utf8');
        changed.push(path.relative(WORKSPACE_ROOT, filePath));
      }
    }
  }

  process.stdout.write(`Unified PostgreSQL profile across ${changed.length} files.\n`);
  for (const file of changed.sort()) {
    process.stdout.write(`- ${file}\n`);
  }
}

main();
