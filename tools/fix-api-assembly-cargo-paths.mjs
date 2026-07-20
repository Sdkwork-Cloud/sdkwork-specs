#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readText } from './api-assembly-lib.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function discoverCargoFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'target') {
        continue;
      }
      discoverCargoFiles(full, acc);
    } else if (entry.name === 'Cargo.toml') {
      acc.push(full);
    }
  }
  return acc;
}

let fixed = 0;
for (const cargoPath of discoverCargoFiles(workspaceRoot)) {
  let cargo = readText(cargoPath);
  const updated = cargo.replace(
    /path\s*=\s*"\.\.\/[^"]*\\(sdkwork-[^"]+-api-assembly)"/gu,
    'path = "../$1"',
  );
  if (updated !== cargo) {
    fs.writeFileSync(cargoPath, updated, 'utf8');
    fixed += 1;
    console.log(`fixed ${path.relative(workspaceRoot, cargoPath)}`);
  }
}
console.log(`fix-api-assembly-cargo-paths: ${fixed} files`);
