#!/usr/bin/env node
/**
 * Fail when active application runtime still uses retired hosting vocabulary.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

const ACTIVE_PATTERNS = [
  { pattern: /--hosting\s+(self-hosted|cloud-hosted)/g, message: 'retired CLI flag --hosting' },
  { pattern: /"profile":\s*"[^"]*(self-hosted|cloud-hosted)/g, message: 'retired profile id in packaging.targets' },
  { pattern: /^SDKWORK_[A-Z0-9_]+_HOSTING=/gm, message: 'retired SDKWORK_*_HOSTING env key' },
  { pattern: /^VITE_[A-Z0-9_]+_HOSTING=/gm, message: 'retired VITE_*_HOSTING env key' },
];

const SKIP_PATH_PARTS = ['retired', 'node_modules', 'external/', 'align-app-runtime-hosting-debt', 'check-app-runtime-hosting-debt'];

function fail(message, details = []) {
  console.error(`hosting debt check failed: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}

function shouldSkip(rel) {
  const normalized = rel.replace(/\\/g, '/');
  if (normalized.includes('node_modules')) return true;
  if (normalized.includes('/external/')) return true;
  return SKIP_PATH_PARTS.some((part) => normalized.includes(part));
}

function scanFile(repoRoot, file) {
  const rel = path.relative(repoRoot, file);
  if (shouldSkip(rel)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const issues = [];
  for (const { pattern, message } of ACTIVE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      issues.push(`${rel.replace(/\\/g, '/')}:${line}: ${message} (${match[0]})`);
    }
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/check-app-runtime-hosting-debt.mjs [--workspace <path>]');
    return;
  }

  const workspace = path.resolve(values.workspace);
  const issues = [];
  for (const name of fs.readdirSync(workspace)) {
    if (!name.startsWith('sdkwork-')) continue;
    const repoRoot = path.join(workspace, name);
    if (!fs.existsSync(path.join(repoRoot, 'specs/topology.spec.json'))) continue;
    if (name === 'sdkwork-deployments') continue;

    const scanRoots = ['package.json', 'etc/topology', 'scripts', 'tests'];
    for (const root of scanRoots) {
      const abs = path.join(repoRoot, root);
      if (!fs.existsSync(abs)) continue;
      const stat = fs.statSync(abs);
      if (stat.isFile()) {
        issues.push(...scanFile(repoRoot, abs));
        continue;
      }
      for (const file of fs.readdirSync(abs, { withFileTypes: true })) {
        const full = path.join(abs, file.name);
        if (file.isDirectory()) {
          for (const nested of fs.readdirSync(full, { withFileTypes: true })) {
            if (!nested.isFile()) continue;
            const nestedPath = path.join(full, nested.name);
            if (/\.(json|mjs|js|env)$/.test(nested.name)) {
              issues.push(...scanFile(repoRoot, nestedPath));
            }
          }
        } else if (/\.(json|mjs|js|env)$/.test(file.name)) {
          issues.push(...scanFile(repoRoot, full));
        }
      }
    }

    const specPath = path.join(repoRoot, 'specs/topology.spec.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    for (const target of spec.packaging?.targets ?? []) {
      const profile = typeof target.profile === 'string' ? target.profile : '';
      if (/self-hosted|cloud-hosted/.test(profile)) {
        issues.push(`${name}/specs/topology.spec.json: packaging.targets profile uses retired profile id (${profile})`);
      }
      if (typeof target.hosting === 'string') {
        issues.push(`${name}/specs/topology.spec.json: packaging.targets uses retired hosting field (${target.hosting})`);
      }
    }
    for (const [scriptName, entry] of Object.entries(spec.scripts?.pnpm ?? {})) {
      if (entry && typeof entry === 'object' && typeof entry.hosting === 'string') {
        issues.push(`${name}/specs/topology.spec.json: scripts.pnpm.${scriptName} uses retired hosting field (${entry.hosting})`);
      }
    }
  }

  if (issues.length > 0) fail(`found ${issues.length} hosting debt issue(s)`, issues.slice(0, 50));
  console.log('hosting debt check passed');
}

main();
