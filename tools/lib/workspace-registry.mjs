#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IAM_PNPM_WORKSPACE_PACKAGES } from '../iam-workspace-paths.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const FOUNDATION_PNPM_PACKAGES = [
  ...IAM_PNPM_WORKSPACE_PACKAGES,
  '../sdkwork-iam/apps/sdkwork-iam-common/packages/sdkwork-iam-credential-entry',
  '../sdkwork-iam/sdks/sdkwork-iam-app-sdk/sdkwork-iam-app-sdk-typescript/generated/server-openapi',
  '../sdkwork-iam/sdks/sdkwork-iam-backend-sdk/sdkwork-iam-backend-sdk-typescript/generated/server-openapi',
  '../sdkwork-appbase/packages/common/foundation/sdkwork-runtime-bootstrap',
  '../sdkwork-appbase/packages/pc-react/foundation/sdkwork-appbase-pc-react',
  '../sdkwork-appbase/packages/pc-react/foundation/sdkwork-i18n-pc-react',
  '../sdkwork-core/sdkwork-core-pc-react',
  '../sdkwork-ui/sdkwork-ui-pc-react',
  '../sdkwork-sdk-commons/sdkwork-sdk-common-typescript',
  '../sdkwork-utils/packages/sdkwork-utils-typescript',
];

export function specsRoot() {
  return SPECS_ROOT;
}

export function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, ''));
}

export const DEFAULT_CATALOG = (() => {
  const catalogPath = path.join(SPECS_ROOT, 'workspace/catalog.base.json');
  const data = readJsonIfExists(catalogPath);
  return data ?? {
    react: '^19.2.4',
    'react-dom': '^19.2.4',
    typescript: '~6.0.2',
    vite: '^8.0.3',
    '@types/react': '^19.2.14',
    '@types/react-dom': '^19.2.3',
  };
})();

export function loadConsumerOverlay(repoName) {
  const consumerPath = path.join(SPECS_ROOT, 'workspace/consumers', `${repoName}.json`);
  const data = readJsonIfExists(consumerPath);
  return {
    pnpmPackages: data?.pnpm?.packages ?? [],
    catalog: data?.catalog ?? {},
  };
}

export function parsePnpmWorkspacePackages(text) {
  const packages = [];
  let inPackages = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^packages:\s*$/u.test(line)) {
      inPackages = true;
      continue;
    }
    if (inPackages && /^[A-Za-z0-9_./-]+:\s*$/u.test(line) && !line.startsWith(' ')) {
      break;
    }
    const match = line.match(/^\s*-\s*["']?([^"']+)["']?\s*$/u);
    if (inPackages && match) packages.push(match[1]);
  }
  return packages;
}

export function parsePnpmWorkspaceCatalog(text) {
  const catalog = {};
  let inCatalog = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^catalog:\s*$/u.test(line)) {
      inCatalog = true;
      continue;
    }
    if (inCatalog && /^[A-Za-z0-9_./-]+:\s*$/u.test(line) && !line.startsWith(' ')) {
      break;
    }
    const match = line.match(/^\s*["']?([^"':]+)["']?\s*:\s*(.+?)\s*$/u);
    if (inCatalog && match) catalog[match[1]] = match[2];
  }
  return catalog;
}

export function isSiblingPackageEntry(entry) {
  return entry.startsWith('../');
}

export function uniquePackages(entries) {
  return [...new Set(entries)];
}

export function buildWorkspacePackages(localPackages, repoName) {
  const overlay = loadConsumerOverlay(repoName);
  return uniquePackages([
    ...localPackages,
    ...FOUNDATION_PNPM_PACKAGES,
    ...overlay.pnpmPackages,
  ]);
}

export function buildWorkspaceCatalog(existingCatalog, repoName) {
  const overlay = loadConsumerOverlay(repoName);
  return { ...DEFAULT_CATALOG, ...existingCatalog, ...overlay.catalog };
}

export function renderPnpmWorkspace({ packages, catalog }) {
  const lines = ['packages:'];
  for (const entry of packages) {
    lines.push(`  - "${entry}"`);
  }
  if (catalog && Object.keys(catalog).length > 0) {
    lines.push('', 'catalog:');
    for (const [key, value] of Object.entries(catalog)) {
      const renderedKey = /[^A-Za-z0-9_-]/u.test(key) ? `"${key}"` : key;
      lines.push(`  ${renderedKey}: ${value}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
