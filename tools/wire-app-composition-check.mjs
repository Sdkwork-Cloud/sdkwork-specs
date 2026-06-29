#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFY_CMD = 'node ../sdkwork-specs/tools/verify-repo.mjs --root .';

function parseArgs(argv) {
  const args = { workspace: path.resolve(SPECS_ROOT, '..'), dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--workspace') args.workspace = path.resolve(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: node tools/wire-app-composition-check.mjs [--workspace <path>] [--dry-run]

Adds check:app-composition script to repo package.json when apps/ exists and script is missing.`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  let changes = 0;
  for (const entry of fs.readdirSync(args.workspace, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('sdkwork-')) continue;
    const repoRoot = path.join(args.workspace, entry.name);
    if (!fs.existsSync(path.join(repoRoot, 'apps'))) continue;

    const packageJsonPath = path.join(repoRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8').replace(/^\uFEFF/u, ''));
    pkg.scripts ??= {};
    if (pkg.scripts['check:app-composition']) continue;

    pkg.scripts['check:app-composition'] = VERIFY_CMD;
    changes += 1;
    const rendered = `${JSON.stringify(pkg, null, 2)}\n`;
    if (args.dryRun) {
      console.log(`[dry-run] would add check:app-composition to ${entry.name}/package.json`);
      continue;
    }
    fs.writeFileSync(packageJsonPath, rendered);
    console.log(`wired check:app-composition in ${entry.name}`);
  }

  console.log(`wire-app-composition-check complete (${changes} changes)`);
}

main();
