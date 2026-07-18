#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const SECRET_KEY = /(?:password|private[_-]?key|signing[_-]?secret|access[_-]?token|refresh[_-]?token|api[_-]?key)$/iu;
const SAFE_SECRET_REFERENCE = /(?:file|path|ref|reference)$/iu;
const PRODUCTION_LIKE_ENVIRONMENT = /^(?:prod|production|stage|staging|live)$/iu;

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function inspectJsonSecrets(value, pointer, issues) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectJsonSecrets(entry, `${pointer}/${index}`, issues));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    const childPointer = `${pointer}/${key}`;
    if (
      SECRET_KEY.test(key)
      && !SAFE_SECRET_REFERENCE.test(key)
      && typeof entry === 'string'
      && entry.trim()
    ) {
      issues.push(`${childPointer}: committed etc config must not contain a secret value`);
    }
    inspectJsonSecrets(entry, childPointer, issues);
  }
}

function parseTomlString(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'mu'));
  return match?.[1]?.trim() ?? '';
}

function parseTomlBoolean(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*$`, 'miu'));
  return match ? match[1].toLowerCase() === 'true' : undefined;
}

function parseTomlStringArray(source, key) {
  const match = source.match(new RegExp(`^\\s*${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'mu'));
  if (!match) return undefined;
  return Array.from(match[1].matchAll(/"([^"]*)"/gu), (entry) => entry[1].trim());
}

function isExactHttpOrigin(value) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:')
      && url.origin === value
      && !value.includes('*')
      && url.username === ''
      && url.password === ''
    );
  } catch {
    return false;
  }
}

function inspectGatewayCors(file, relative, issues) {
  const source = fs.readFileSync(file, 'utf8');
  const environment = parseTomlString(source, 'environment');
  if (!PRODUCTION_LIKE_ENVIRONMENT.test(environment)) return;

  const exposesAppSurface = Array.from(
    source.matchAll(/^\s*surface\s*=\s*"([^"]+)"\s*$/gmiu),
    (entry) => entry[1].trim().toLowerCase(),
  ).includes('app');
  if (!exposesAppSurface) return;

  if (parseTomlBoolean(source, 'allowAnyOrigin') !== false) {
    issues.push(`${relative}#[cors].allowAnyOrigin: production-like app-api ingress must set false`);
  }
  const allowedOrigins = parseTomlStringArray(source, 'allowedOrigins');
  if (!allowedOrigins?.length) {
    issues.push(`${relative}#[cors].allowedOrigins: production-like app-api ingress requires at least one exact origin`);
    return;
  }
  for (const origin of allowedOrigins) {
    if (!isExactHttpOrigin(origin)) {
      issues.push(`${relative}#[cors].allowedOrigins: invalid exact HTTP(S) origin ${JSON.stringify(origin)}`);
    }
  }
}

export function checkSourceConfigStandard(root, { deployable } = {}) {
  const resolvedRoot = path.resolve(root);
  const manifestPath = path.join(resolvedRoot, 'sdkwork.app.config.json');
  const isDeployable = deployable ?? fs.existsSync(manifestPath);
  const issues = [];
  if (!isDeployable) return issues;

  const etcRoot = path.join(resolvedRoot, 'etc');
  if (!fs.existsSync(etcRoot)) {
    return ['etc/: independently deployable root must own source configuration'];
  }
  if (!fs.existsSync(path.join(etcRoot, 'README.md'))) {
    issues.push('etc/README.md: source configuration discovery documentation is required');
  }
  if (!fs.existsSync(path.join(etcRoot, 'sdkwork.deployment.config.json'))) {
    issues.push('etc/sdkwork.deployment.config.json: deployment profile index is required');
  }
  if (fs.existsSync(path.join(resolvedRoot, 'configs'))) {
    issues.push('configs/: retired runtime/deployment config directory must be migrated to etc/');
  }

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.environments) {
      issues.push('sdkwork.app.config.json#/environments: concrete environment config belongs in etc/');
    }
    const envBindings = manifest.envBindings;
    if (envBindings && typeof envBindings === 'object') {
      for (const key of Object.keys(envBindings)) {
        if (/byEnv(?:ironment)?$/iu.test(key)) {
          issues.push(`sdkwork.app.config.json#/envBindings/${key}: per-environment values belong in etc/`);
        }
      }
    }
  }

  for (const file of walkFiles(etcRoot)) {
    const relative = path.relative(resolvedRoot, file).replaceAll(path.sep, '/');
    if (/\.local\./u.test(relative) || relative.startsWith('etc/secrets/')) {
      issues.push(`${relative}: local/private source config must not be committed`);
      continue;
    }
    if (file.endsWith('.json')) {
      try {
        inspectJsonSecrets(JSON.parse(fs.readFileSync(file, 'utf8')), relative, issues);
      } catch (error) {
        issues.push(`${relative}: invalid JSON (${error.message})`);
      }
    }
  }
  const gatewayConfigRoots = [etcRoot, path.join(resolvedRoot, 'configs')];
  const inspectedGatewayFiles = new Set();
  for (const configRoot of gatewayConfigRoots) {
    for (const file of walkFiles(configRoot)) {
      if (!/api-cloud-gateway.*\.toml$/iu.test(path.basename(file))) continue;
      const absolute = path.resolve(file);
      if (inspectedGatewayFiles.has(absolute)) continue;
      inspectedGatewayFiles.add(absolute);
      const relative = path.relative(resolvedRoot, file).replaceAll(path.sep, '/');
      inspectGatewayCors(file, relative, issues);
    }
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', default: '.' },
      deployable: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/check-source-config-standard.mjs --root <deployable-root> [--deployable]');
    return;
  }
  const root = path.resolve(values.root);
  const issues = checkSourceConfigStandard(root, { deployable: values.deployable });
  if (issues.length > 0) {
    console.error(`source config standard failed for ${root}`);
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
    return;
  }
  console.log(`source config standard passed for ${root}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
