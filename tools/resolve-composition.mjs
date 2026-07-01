#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import { resolveComposition } from './lib/composition-resolver.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd(), write: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--write') args.write = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: node tools/resolve-composition.mjs --root <repo> [--write]

Resolve consumer sdkDependencies into integration/env/permission inheritance facts.`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  const resolution = resolveComposition(args.root);
  const rendered = `${JSON.stringify(resolution, null, 2)}\n`;

  if (!args.write) {
    process.stdout.write(rendered);
    return;
  }

  const outDir = path.join(args.root, 'generated');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'composition.resolved.json');
  fs.writeFileSync(outPath, rendered);
  console.log(`Wrote ${outPath}`);
}

main();
