#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_FRAGMENT = 'pnpm run check:app-composition';

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
  console.log(`Usage: node tools/wire-verify-app-composition.mjs [--workspace <path>] [--dry-run]

Adds check:app-composition to check and verify scripts when the script exists but is not wired.`);
}

function wireScript(scriptValue, scriptName) {
  if (!scriptValue || scriptValue.includes('check:app-composition')) {
    return { value: scriptValue, changed: false };
  }
  if (scriptName === 'check') {
    return { value: `${CHECK_FRAGMENT} && ${scriptValue}`, changed: true };
  }
  if (scriptName === 'verify') {
    return { value: `${scriptValue} && ${CHECK_FRAGMENT}`, changed: true };
  }
  return { value: scriptValue, changed: false };
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
    const packageJsonPath = path.join(repoRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) continue;

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8').replace(/^\uFEFF/u, ''));
    if (!pkg.scripts?.['check:app-composition']) continue;

    let repoChanged = false;
    for (const scriptName of ['check', 'verify']) {
      const wired = wireScript(pkg.scripts?.[scriptName], scriptName);
      if (!wired.changed) continue;
      pkg.scripts[scriptName] = wired.value;
      repoChanged = true;
    }

    if (!repoChanged) continue;
    changes += 1;
    const rendered = `${JSON.stringify(pkg, null, 2)}\n`;
    if (args.dryRun) {
      console.log(`[dry-run] would wire check:app-composition into check/verify for ${entry.name}`);
      continue;
    }
    fs.writeFileSync(packageJsonPath, rendered);
    console.log(`wired check:app-composition into check/verify for ${entry.name}`);
  }

  console.log(`wire-verify-app-composition complete (${changes} changes)`);
}

main();
