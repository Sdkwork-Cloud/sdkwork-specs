#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const WORKSPACE_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  '..',
);

/** Repair accidental substring replacements before canonical migrations. */
const REPAIR_REPLACEMENTS = [
  ['sdkwork_ai_prod_ai_dev', 'sdkwork_ai_dev'],
  ['sdkwork_ai_prod_ai_prod', 'sdkwork_ai_prod'],
];

const TEXT_REPLACEMENTS = [
  ['sdkwork_chat_prod', 'sdkwork_ai_prod'],
  ['sdkwork_knowledgebase_dev', 'sdkwork_ai_dev'],
  ['sdkwork_knowledgebase_prod', 'sdkwork_ai_prod'],
  ['sdkwork_news_dev', 'sdkwork_ai_dev'],
  ['sdkwork_forum_dev', 'sdkwork_ai_dev'],
  ['sdkwork_documents_dev', 'sdkwork_ai_dev'],
  ['sdkwork_documents', 'sdkwork_ai_prod'],
  ['sdkwork_drive_dev', 'sdkwork_ai_dev'],
  ['sdkwork_drive_prod', 'sdkwork_ai_prod'],
  ['sdkwork_drive_staging', 'sdkwork_ai_prod'],
  ['sdkwork_commerce_pc_dev', 'sdkwork_ai_dev'],
  ['sdkwork_commerce_pc_prod', 'sdkwork_ai_prod'],
  ['sdkwork_commerce_pc_staging', 'sdkwork_ai_prod'],
  ['sdkwork_video_prod', 'sdkwork_ai_prod'],
  ['sdkwork_terminal_production', 'sdkwork_ai_prod'],
  ['sdkwork_rtc', 'sdkwork_ai_prod'],
  ['username = "sdkworkdev"', 'username = "sdkwork_ai_dev"'],
  ['username = "sdkworkdrive"', 'username = "sdkwork_ai_prod"'],
  ['username = "sdkworkcommerce"', 'username = "sdkwork_ai_prod"'],
  ['database = "sdkwork_discovery"', 'database = "sdkwork_ai_dev"'],
  ['username = "sdkwork_discovery"', 'username = "sdkwork_ai_dev"'],
  ['SDKWORK_IM_DATABASE_NAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_IM_DATABASE_SCHEMA=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev'],
  ['SDKWORK_IM_DATABASE_USERNAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_IM_DATABASE_PASSWORD=sdkworkdev123', 'SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123'],
  ['SDKWORK_DISCOVERY_DATABASE_NAME=sdkwork_discovery', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_DISCOVERY_DATABASE_USERNAME=sdkwork_discovery', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_DISCOVERY_DATABASE_SCHEMA=public', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev'],
  ['SDKWORK_NEWS_DATABASE_NAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_NEWS_DATABASE_USERNAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_NEWS_DATABASE_PASSWORD=sdkworknews123', 'SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123'],
  ['SDKWORK_DRIVE_DATABASE_NAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['SDKWORK_DRIVE_DATABASE_SCHEMA=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev'],
  ['SDKWORK_DRIVE_DATABASE_USERNAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['SDKWORK_DRIVE_DATABASE_PASSWORD=sdkworkdev123', 'SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123'],
  ['SDKWORK_RTC_DATABASE_NAME=sdkwork_rtc', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod'],
  ['SDKWORK_RTC_DATABASE_SCHEMA=public', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod'],
  ['SDKWORK_RTC_DATABASE_USERNAME=sdkwork_rtc', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod'],
  ['DOCUMENTS_DATABASE_NAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_dev'],
  ['DOCUMENTS_DATABASE_SCHEMA=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_dev'],
  ['DOCUMENTS_DATABASE_USERNAME=sdkwork_ai_dev', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_dev'],
  ['DOCUMENTS_DATABASE_PASSWORD=sdkworkdev123', 'SDKWORK_CLAW_DATABASE_PASSWORD=sdkworkdev123'],
  ['DOCUMENTS_DATABASE_ENGINE=postgresql', 'SDKWORK_CLAW_DATABASE_ENGINE=postgresql'],
  ['DOCUMENTS_DATABASE_HOST=', 'SDKWORK_CLAW_DATABASE_HOST='],
  ['DOCUMENTS_DATABASE_PORT=', 'SDKWORK_CLAW_DATABASE_PORT='],
  ['DOCUMENTS_DATABASE_SSL_MODE=', 'SDKWORK_CLAW_DATABASE_SSL_MODE='],
  ['DOCUMENTS_DATABASE_MAX_CONNECTIONS=', 'SDKWORK_CLAW_DATABASE_MAX_CONNECTIONS='],
  ['DOCUMENTS_DATABASE_PASSWORD_FILE=', 'SDKWORK_CLAW_DATABASE_PASSWORD_FILE='],
  ['SDKWORK_FORUM_DATABASE_URL=postgres://forum:forum@localhost:5432/forum', 'SDKWORK_CLAW_DATABASE_URL=postgresql://sdkwork_ai_dev:sdkworkdev123@127.0.0.1:5432/sdkwork_ai_dev?sslmode=disable'],
  ['SDKWORK_PROMPTS_DATABASE_URL=postgres://forum:forum@localhost:5432/forum', 'SDKWORK_CLAW_DATABASE_URL=postgresql://sdkwork_ai_dev:sdkworkdev123@127.0.0.1:5432/sdkwork_ai_dev?sslmode=disable'],
  ['SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/etc/sdkwork/database.secret', 'SDKWORK_CLAW_DATABASE_PASSWORD_FILE=/etc/sdkwork/router/database.secret'],
  ['password_file = "/etc/sdkwork/database.secret"', 'password_file = "/etc/sdkwork/router/database.secret"'],
  ['url = "postgres://prod-db:5432/sdkwork_terminal_production"', 'url = "postgresql://sdkwork_ai_prod@db.example.com:5432/sdkwork_ai_prod?sslmode=require"'],
  ['url = "postgresql://prod-host:5432/sdkwork"', 'url = "postgresql://sdkwork_ai_prod@db.example.com:5432/sdkwork_ai_prod?sslmode=require"'],
  ['postgresql://sdkworkprod%402026%2B%2B:', 'postgresql://sdkwork_ai_prod:'],
  ['postgresql://sdkworkprod@2026++:', 'postgresql://sdkwork_ai_prod:'],
];

/** Exact-line replacements that must not match longer sdkwork_ai_dev / sdkwork_ai_prod values. */
const EXACT_LINE_REPLACEMENTS = [
  ['SDKWORK_IM_DATABASE_NAME=sdkwork', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod'],
  ['SDKWORK_IM_DATABASE_SCHEMA=public', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod'],
  ['SDKWORK_IM_DATABASE_USERNAME=sdkwork', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod'],
  ['SDKWORK_CLAW_DATABASE_NAME=sdkwork', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod'],
  ['SDKWORK_CLAW_DATABASE_SCHEMA=public', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod'],
  ['SDKWORK_CLAW_DATABASE_USERNAME=sdkwork', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod'],
  ['SDKWORK_DRIVE_DATABASE_NAME=sdkwork', 'SDKWORK_CLAW_DATABASE_NAME=sdkwork_ai_prod'],
  ['SDKWORK_DRIVE_DATABASE_SCHEMA=public', 'SDKWORK_CLAW_DATABASE_SCHEMA=sdkwork_ai_prod'],
  ['SDKWORK_DRIVE_DATABASE_USERNAME=sdkwork', 'SDKWORK_CLAW_DATABASE_USERNAME=sdkwork_ai_prod'],
  ['database = "sdkwork"', 'database = "sdkwork_ai_prod"'],
  ['username = "sdkwork"', 'username = "sdkwork_ai_prod"'],
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
  if (filePath.includes(`${path.sep}configs${path.sep}topology${path.sep}`) && base.endsWith('.env')) {
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

function applyExactLineReplacements(content) {
  return content
    .split(/\r?\n/u)
    .map((line) => {
      for (const [from, to] of EXACT_LINE_REPLACEMENTS) {
        if (line.trim() === from) {
          return line.replace(from, to);
        }
      }
      if (/production|\.production\.|staging|\.staging\./u.test(line) && line.trim() === 'schema = "public"') {
        return line.replace('schema = "public"', 'schema = "sdkwork_ai_prod"');
      }
      return line;
    })
    .join('\n');
}

function applyReplacements(content) {
  let next = content;
  for (const [from, to] of REPAIR_REPLACEMENTS) {
    if (from !== to) {
      next = next.split(from).join(to);
    }
  }
  for (const [from, to] of TEXT_REPLACEMENTS) {
    if (from !== to) {
      next = next.split(from).join(to);
    }
  }
  next = applyExactLineReplacements(next);
  return next;
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
      const updated = applyReplacements(original);
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
