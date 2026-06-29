#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  isSiblingPackageEntry,
  parsePnpmWorkspaceCatalog,
  parsePnpmWorkspacePackages,
  specsRoot,
} from './lib/workspace-registry.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), write: false, repo: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--repo') args.repo = argv[++i];
    else if (arg === '--write') args.write = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: node tools/extract-consumer-overlay.mjs --repo <name> --root <repo-path> [--write]

Extract sibling pnpm workspace entries into workspace/consumers/<repo>.json.`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.repo) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const workspacePath = path.join(args.root, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) {
    console.error(`Missing pnpm-workspace.yaml at ${workspacePath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(workspacePath, 'utf8');
  const siblingPackages = parsePnpmWorkspacePackages(text).filter(isSiblingPackageEntry);
  const catalog = parsePnpmWorkspaceCatalog(text);
  const overlay = {
    pnpm: { packages: siblingPackages },
    catalog,
  };

  const rendered = `${JSON.stringify(overlay, null, 2)}\n`;
  if (!args.write) {
    process.stdout.write(rendered);
    return;
  }

  const outPath = path.join(specsRoot(), 'workspace', 'consumers', `${args.repo}.json`);
  fs.writeFileSync(outPath, rendered);
  console.log(`Wrote ${outPath}`);
}

main();
