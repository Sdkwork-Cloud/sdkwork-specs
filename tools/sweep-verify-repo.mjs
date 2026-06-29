#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const verifyScript = path.join(workspace, 'sdkwork-specs', 'tools', 'verify-repo.mjs');

const failures = [];
let pass = 0;

for (const entry of fs.readdirSync(workspace, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('sdkwork-')) continue;
  const repoRoot = path.join(workspace, entry.name);
  const result = spawnSync(process.execPath, [verifyScript, '--root', repoRoot], {
    encoding: 'utf8',
  });
  if (result.status === 0) {
    pass += 1;
    continue;
  }
  const issues = (result.stderr || result.stdout || '')
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.trim());
  failures.push({ repo: entry.name, issues });
}

console.log(`verify-repo sweep: ${pass} PASS, ${failures.length} FAIL`);
for (const failure of failures) {
  console.log(`\n${failure.repo}:`);
  for (const issue of failure.issues) console.log(`  ${issue}`);
}
process.exit(failures.length > 0 ? 1 : 0);
