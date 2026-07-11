#!/usr/bin/env node
/**
 * Eliminate retired hosting/self-hosted/cloud-hosted runtime debt in application repositories.
 * See APP_RUNTIME_TOPOLOGY_NAMING.md and TEST_SPEC.md section 2.6.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'artifacts', 'external', '.pnpm-store']);
const TEXT_EXTENSIONS = new Set(['.json', '.mjs', '.js', '.env', '.md']);

const REPLACEMENTS = [
  ['--hosting self-hosted', '--deployment-profile standalone'],
  ['--hosting cloud-hosted', '--deployment-profile cloud'],
  ['--hosting standalone', '--deployment-profile standalone'],
  ['--hosting cloud', '--deployment-profile cloud'],
  ['self-hosted.unified-process.', 'standalone.'],
  ['self-hosted.split-services.', 'standalone.'],
  ['cloud-hosted.unified-process.', 'cloud.'],
  ['cloud-hosted.split-services.', 'cloud.'],
  ['standalone.unified-process.', 'standalone.'],
  ['standalone.split-services.', 'standalone.'],
  ['cloud.unified-process.', 'cloud.'],
  ['cloud.split-services.', 'cloud.'],
  ['SDKWORK_TERMINAL_HOSTING=', 'SDKWORK_TERMINAL_DEPLOYMENT_PROFILE='],
  ['VITE_SDKWORK_TERMINAL_HOSTING=', 'VITE_SDKWORK_TERMINAL_DEPLOYMENT_PROFILE='],
];

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkFiles(full, files);
    else files.push(full);
  }
  return files;
}

function shouldProcess(file, repoRoot) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  if (rel.includes('node_modules')) return false;
  if (rel.startsWith('external/')) return false;
  const ext = path.extname(file).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return false;
  if (rel.endsWith('align-app-runtime-hosting-debt.mjs')) return false;
  if (rel.endsWith('check-app-runtime-hosting-debt.mjs')) return false;
  return true;
}

function migrateText(content) {
  let out = content;
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }
  return out;
}

function mapHostingToDeploymentProfile(hosting) {
  if (hosting === 'self-hosted') return 'standalone';
  if (hosting === 'cloud-hosted') return 'cloud';
  return hosting;
}

function fixTopologyPackaging(spec) {
  let changed = false;
  for (const target of spec.packaging?.targets ?? []) {
    if (typeof target.profile === 'string' && /self-hosted|cloud-hosted/.test(target.profile)) {
      target.profile = migrateText(target.profile);
      changed = true;
    }
    if (typeof target.deploymentProfile === 'string') {
      const next = migrateText(target.deploymentProfile);
      if (next !== target.deploymentProfile) {
        target.deploymentProfile = next;
        changed = true;
      }
    }
    if (typeof target.hosting === 'string') {
      target.deploymentProfile = mapHostingToDeploymentProfile(target.hosting);
      delete target.hosting;
      changed = true;
    }
  }
  return changed;
}

function fixTopologyScripts(spec) {
  let changed = false;
  for (const entry of Object.values(spec.scripts?.pnpm ?? {})) {
    if (!entry || typeof entry !== 'object' || typeof entry.hosting !== 'string') continue;
    if (!entry.deploymentProfile) {
      entry.deploymentProfile = mapHostingToDeploymentProfile(entry.hosting);
    }
    delete entry.hosting;
    changed = true;
  }
  return changed;
}

function fixTopologySpec(spec) {
  const packagingChanged = fixTopologyPackaging(spec);
  const scriptsChanged = fixTopologyScripts(spec);
  return packagingChanged || scriptsChanged;
}

function alignRepo(repoRoot, dryRun) {
  const actions = [];
  const specPath = path.join(repoRoot, 'specs/topology.spec.json');
  if (fs.existsSync(specPath)) {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    if (fixTopologySpec(spec)) {
      actions.push('fix topology.spec.json deployment profile vocabulary');
      if (!dryRun) {
        fs.writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
      }
    }
  }

  for (const file of walkFiles(repoRoot)) {
    if (!shouldProcess(file, repoRoot)) continue;
    const rel = path.relative(repoRoot, file);
    if (rel.startsWith('specs\\topology.spec.json') || rel === 'specs/topology.spec.json') continue;
    const before = fs.readFileSync(file, 'utf8');
    const after = migrateText(before);
    if (after !== before) {
      actions.push(`migrate ${rel.replace(/\\/g, '/')}`);
      if (!dryRun) fs.writeFileSync(file, after, 'utf8');
    }
  }

  return actions;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      repo: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/align-app-runtime-hosting-debt.mjs [--workspace <path>] [--repo <name>] [--dry-run]');
    return;
  }

  const workspace = path.resolve(values.workspace);
  const dryRun = values['dry-run'];
  const repos = values.repo
    ? [path.join(workspace, values.repo)]
    : fs.readdirSync(workspace).filter((n) => n.startsWith('sdkwork-')).map((n) => path.join(workspace, n));

  let total = 0;
  for (const repoRoot of repos) {
    if (!fs.existsSync(path.join(repoRoot, 'specs/topology.spec.json'))) continue;
    const actions = alignRepo(repoRoot, dryRun);
    if (actions.length === 0) continue;
    console.log(`\n${path.basename(repoRoot)}${dryRun ? ' (dry-run)' : ''}:`);
    for (const action of actions) console.log(`  - ${action}`);
    total += actions.length;
  }
  console.log(`\nTotal hosting-debt actions: ${total}`);
}

main();
