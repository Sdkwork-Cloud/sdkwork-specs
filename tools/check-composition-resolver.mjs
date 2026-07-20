#!/usr/bin/env node

import path from 'node:path';

import {
  resolveComposition,
  validateCompositionResolution,
} from './lib/composition-resolver.mjs';

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--help' || arg === '-h') args.help = true;
  }
  return args;
}

function usage() {
  console.log(`Usage: node tools/check-composition-resolver.mjs --root <repo>

Fail when composition resolution has unresolved issues or forbidden platform/product URL fallbacks.`);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    process.exit(0);
  }

  const resolution = resolveComposition(args.root);
  const issues = [...resolution.issues];

  if (resolution.integrations.some((entry) => entry.forbidApplicationSameOriginFallback)) {
    if (!resolution.requiresPlatformApiSurface) {
      issues.push('platform external dependencies require requiresPlatformApiSurface=true');
    }
  }

  issues.push(...validateCompositionResolution(resolution));

  if (issues.length > 0) {
    console.error(`Composition resolver check failed for ${path.basename(args.root)}:`);
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`Composition resolver check passed for ${path.basename(args.root)}.`);
}

main();
