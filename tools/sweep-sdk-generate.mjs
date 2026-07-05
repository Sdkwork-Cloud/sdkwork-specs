#!/usr/bin/env node
/**
 * Run SDK generation scripts across sdkwork-space repositories.
 * Prefers root `sdk:generate`; falls back to `generate:sdk:*:standard`, then auto-discovers:
 * - sdks/workspace-*-sdkgen.mjs (--mode apply)
 * - per-family sdks/.../bin/generate-sdk.mjs
 * - nested apps/.../sdks/.../bin/generate-sdk.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { listWorkspaceRepos } from './lib/app-sdk-consumer-import-patterns.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

function resolveRootGenerateScripts(packageJson) {
  const scripts = packageJson.scripts ?? {};
  const resolved = [];
  if (scripts['sdk:generate']) resolved.push({ kind: 'pnpm', script: 'sdk:generate' });
  if (scripts['generate:sdk:birdcoder:standard']) {
    resolved.push({ kind: 'pnpm', script: 'generate:sdk:birdcoder:standard' });
  }
  if (resolved.length > 0) return resolved;
  const standard = Object.keys(scripts).find((key) => /^generate:sdk:[^:]+:standard$/u.test(key));
  if (standard) return [{ kind: 'pnpm', script: standard }];
  const anyGenerate = Object.keys(scripts).find((key) => key.startsWith('generate:sdk:'));
  return anyGenerate ? [{ kind: 'pnpm', script: anyGenerate }] : [];
}

function collectFamilyGenerateBins(rootDir) {
  const bins = [];
  if (!fs.existsSync(rootDir)) return bins;
  for (const familyName of fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()) {
    const binMjs = path.join(rootDir, familyName, 'bin', 'generate-sdk.mjs');
    if (fs.existsSync(binMjs)) {
      bins.push({ kind: 'node', argv: [binMjs], label: path.relative(path.dirname(rootDir), binMjs).replace(/\\/g, '/') });
    }
  }
  return bins;
}

function discoverRepoGeneratePlans(repoRoot) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return [];
  const packageJson = readJson(packageJsonPath);
  const fromRoot = resolveRootGenerateScripts(packageJson);
  if (fromRoot.length > 0) return fromRoot;

  const plans = [];
  const sdksDir = path.join(repoRoot, 'sdks');
  if (!fs.existsSync(sdksDir)) return plans;

  for (const entry of fs.readdirSync(sdksDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (/^workspace-.*-sdkgen\.mjs$/u.test(entry.name)) {
      plans.push({
        kind: 'node',
        argv: [path.join(sdksDir, entry.name), '--mode', 'apply'],
        label: `sdks/${entry.name}`,
      });
    }
  }
  if (plans.length > 0) return plans;

  plans.push(...collectFamilyGenerateBins(sdksDir));

  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!app.isDirectory()) continue;
      plans.push(...collectFamilyGenerateBins(path.join(appsDir, app.name, 'sdks')));
    }
  }

  return plans;
}

function runPlan(repoRoot, repoName, plan, dryRun) {
  if (plan.kind === 'pnpm') {
    console.log(`\n=== ${repoName}: pnpm run ${plan.script} ===`);
    if (dryRun) return { repo: repoName, script: plan.script, status: 'dry-run' };
    const result = spawnSync('pnpm', ['run', plan.script], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    return {
      repo: repoName,
      script: plan.script,
      status: result.status === 0 ? 'ok' : 'failed',
      exitCode: result.status ?? 1,
    };
  }

  const label = plan.label ?? plan.argv.join(' ');
  console.log(`\n=== ${repoName}: node ${label} ===`);
  if (dryRun) return { repo: repoName, script: label, status: 'dry-run' };
  const result = spawnSync(process.execPath, plan.argv, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  return {
    repo: repoName,
    script: label,
    status: result.status === 0 ? 'ok' : 'failed',
    exitCode: result.status ?? 1,
  };
}

function main() {
  const workspace = path.resolve(process.argv.includes('--workspace')
    ? process.argv[process.argv.indexOf('--workspace') + 1]
    : DEFAULT_WORKSPACE);
  const dryRun = process.argv.includes('--dry-run');

  const results = [];
  for (const repoRoot of listWorkspaceRepos(workspace)) {
    const repoName = path.basename(repoRoot);
    const plans = discoverRepoGeneratePlans(repoRoot);
    if (plans.length === 0) continue;
    for (const plan of plans) {
      results.push(runPlan(repoRoot, repoName, plan, dryRun));
    }
  }

  const failed = results.filter((entry) => entry.status === 'failed');
  console.log(`\nSDK generation sweep: ${results.length} command(s), ${failed.length} failed`);
  for (const entry of failed) {
    console.log(`- ${entry.repo} (${entry.script}) exit ${entry.exitCode}`);
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
