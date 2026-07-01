#!/usr/bin/env node
/**
 * Align database bootstrap references after initialization-state reset.
 * - 0001_*_legacy_baseline.sql -> 0001_*_baseline.sql
 * - 0001_sdkwork_models_catalog_baseline.sql -> 0001_sdkwork-models_baseline.sql
 * - 0001_videocut_legacy_baseline -> 0001_videocut_baseline (migration id strings)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(TOOL_DIR, '../..');

const TEXT_EXTENSIONS = new Set([
  '.rs', '.mjs', '.js', '.py', '.json', '.md', '.toml', '.yaml', '.yml',
]);

const REPLACEMENTS = [
  ['0001_sdkwork_models_catalog_baseline.sql', '0001_sdkwork-models_baseline.sql'],
  ['0001_videocut_legacy_baseline', '0001_videocut_baseline'],
  ['_legacy_baseline.sql', '_baseline.sql'],
];

function parseArgs(argv) {
  const args = { workspace: WORKSPACE_ROOT, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--workspace') {
      args.workspace = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--help' || token === '-h') {
      console.log('Usage: node align-database-bootstrap-references.mjs [--workspace <dir>] [--dry-run]');
      process.exit(0);
    }
  }
  return args;
}

function shouldSkipDir(name) {
  return [
    'node_modules', 'target', '.git', '.runtime', 'dist', 'build', '.pnpm-store',
  ].includes(name);
}

function applyReplacements(content) {
  let next = content;
  for (const [from, to] of REPLACEMENTS) {
    next = next.split(from).join(to);
  }
  return next;
}

function walkFiles(rootDir, files = []) {
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (shouldSkipDir(entry.name)) {
      continue;
    }
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const roots = fs
    .readdirSync(args.workspace, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name.startsWith('sdkwork-') || entry.name === 'data'))
    .map((entry) => path.join(args.workspace, entry.name));

  let changedFiles = 0;
  for (const root of roots) {
    for (const filePath of walkFiles(root)) {
      const original = fs.readFileSync(filePath, 'utf8');
      const updated = applyReplacements(original);
      if (updated === original) {
        continue;
      }
      changedFiles += 1;
      if (args.dryRun) {
        console.log(`[dry-run] would update ${filePath}`);
      } else {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log(`[align] updated ${filePath}`);
      }
    }
  }
  console.log(`[align-database-bootstrap-references] ${args.dryRun ? 'would change' : 'changed'} ${changedFiles} file(s)`);
}

main();
