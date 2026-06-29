#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  buildWorkspaceCatalog,
  buildWorkspacePackages,
  parsePnpmWorkspaceCatalog,
  parsePnpmWorkspacePackages,
  renderPnpmWorkspace,
  isSiblingPackageEntry,
} from './lib/workspace-registry.mjs';

function parseArgs(argv) {
  const args = { repo: null, root: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--repo') args.repo = argv[++i];
    else if (arg === '--root') args.root = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: node tools/sync-workspace.mjs --repo <repo-name> [--root <path>] [--dry-run]

Synchronize repo-root pnpm-workspace.yaml sibling packages from sdkwork-specs/workspace registry.
Local packages (non ../ entries) are preserved.`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.repo) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const repoRoot = path.resolve(args.root ?? path.join(process.cwd(), '..', args.repo));
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
  if (!fs.existsSync(workspacePath)) {
    console.error(`Missing pnpm-workspace.yaml at ${workspacePath}`);
    process.exit(1);
  }

  const existing = fs.readFileSync(workspacePath, 'utf8');
  const existingPackages = parsePnpmWorkspacePackages(existing);
  const localPackages = existingPackages.filter((entry) => !isSiblingPackageEntry(entry));
  const existingCatalog = parsePnpmWorkspaceCatalog(existing);

  const packages = buildWorkspacePackages(localPackages, args.repo);
  const catalog = buildWorkspaceCatalog(existingCatalog, args.repo);
  const rendered = renderPnpmWorkspace({ packages, catalog });

  if (args.dryRun) {
    process.stdout.write(rendered);
    return;
  }

  fs.writeFileSync(workspacePath, rendered);
  console.log(`Updated ${workspacePath}`);
}

main();
