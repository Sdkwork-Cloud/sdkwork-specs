#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const STOP_SCRIPT = 'node ../sdkwork-specs/tools/stop-sdkwork-workspace-processes.mjs --workspace .';

function parseArgs(argv) {
  const settings = { apply: false, workspaceRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--apply') {
      settings.apply = true;
      continue;
    }
    if (arg === '--workspace') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--workspace requires a path');
      }
      settings.workspaceRoot = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`unsupported option: ${arg}`);
  }
  return settings;
}

function insertStopScript(packageText) {
  const scriptsMatch = /("scripts"\s*:\s*\{\r?\n)(\s*)"/u.exec(packageText);
  if (scriptsMatch) {
    const indentation = scriptsMatch[2];
    const insertionIndex = scriptsMatch.index + scriptsMatch[1].length;
    return `${packageText.slice(0, insertionIndex)}${indentation}"stop": "${STOP_SCRIPT}",${packageText.slice(insertionIndex)}`;
  }

  const emptyScriptsMatch = /("scripts"\s*:\s*)\{\s*\}/u.exec(packageText);
  if (emptyScriptsMatch) {
    const insertionIndex = emptyScriptsMatch.index + emptyScriptsMatch[1].length;
    return `${packageText.slice(0, insertionIndex)}{\n    "stop": "${STOP_SCRIPT}"\n  }${packageText.slice(insertionIndex + emptyScriptsMatch[0].length)}`;
  }

  const closingBraceIndex = packageText.lastIndexOf('}');
  if (closingBraceIndex < 0) {
    throw new Error('package.json is missing its closing object brace');
  }
  const prefix = packageText.slice(0, closingBraceIndex).trimEnd();
  const separator = prefix.endsWith('{') ? '\n' : ',\n';
  return `${prefix}${separator}  "scripts": {\n    "stop": "${STOP_SCRIPT}"\n  }\n${packageText.slice(closingBraceIndex)}`;
}

export function findStopScriptTargets(workspaceRoot) {
  return readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspaceRoot, entry.name, 'package.json'))
    .filter((packagePath) => existsSync(packagePath))
    .flatMap((packagePath) => {
      const text = readFileSync(packagePath, 'utf8');
      if (!text.trim()) {
        return [];
      }
      const manifest = JSON.parse(text.replace(/^\uFEFF/u, ''));
      return !manifest.scripts?.stop ? [{ packagePath, text }] : [];
    });
}

function main() {
  const settings = parseArgs(process.argv.slice(2));
  const targets = findStopScriptTargets(settings.workspaceRoot);
  for (const target of targets) {
    const relativePath = path.relative(settings.workspaceRoot, target.packagePath);
    console.log(`[align-pnpm-stop-scripts] ${settings.apply ? 'add' : 'missing'} ${relativePath}`);
    if (settings.apply) {
      writeFileSync(target.packagePath, insertStopScript(target.text));
    }
  }
  console.log(`[align-pnpm-stop-scripts] ${targets.length} repository roots require stop scripts`);
}

main();
