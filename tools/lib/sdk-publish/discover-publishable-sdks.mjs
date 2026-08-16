/**
 * Multi-language SDK discovery for the publish orchestrator.
 *
 * Unlike `sdk-family-discovery.mjs` (TypeScript transport only), this scans
 * every language declared in `sdk-manifest.json#languages[]` plus conventional
 * `<family>-<language>` directories, producing publishable package records.
 *
 * Authority: SDK_SPEC.md §1, SDK_MANIFEST_SPEC.md §3, SDK_PACKAGE_NAMING_SPEC.md §1.1.
 */
import fs from 'node:fs';
import path from 'node:path';

import { listWorkspaceRepos } from '../app-sdk-consumer-import-patterns.mjs';
import { findLanguageRoot, readJson, toDisplayPath } from './util.mjs';

/**
 * Languages supported by the publish orchestrator.
 * Order matters for `--language all` dry-run reports.
 */
export const SUPPORTED_LANGUAGES = ['typescript', 'rust', 'java', 'flutter', 'python', 'go'];

/**
 * @typedef {Object} PublishableSdk
 * @property {string} repoRoot        - absolute repo root containing `sdks/`
 * @property {string} repoName        - basename of repoRoot
 * @property {string} familyRoot      - absolute `sdks/<family>` path
 * @property {string} sdkFamily       - family stem from manifest
 * @property {string} language        - one of SUPPORTED_LANGUAGES
 * @property {string} languageRoot    - absolute path to the language package
 * @property {string} manifestPath    - absolute path to `sdk-manifest.json`
 * @property {object} manifest        - parsed manifest (may be minimal)
 * @property {boolean} manifestDriven - true when language was declared in manifest
 */

/**
 * Discover publishable SDK packages across the workspace.
 *
 * @param {string} workspaceRoot
 * @returns {PublishableSdk[]}
 */
export function discoverPublishableSdks(workspaceRoot) {
  const out = [];
  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    out.push(...discoverRepoSdks(repoRoot));
  }
  return out.sort((a, b) => {
    const r = a.repoName.localeCompare(b.repoName);
    if (r !== 0) return r;
    const f = a.sdkFamily.localeCompare(b.sdkFamily);
    if (f !== 0) return f;
    return a.language.localeCompare(b.language);
  });
}

/**
 * Discover publishable SDK packages in one repository.
 * Looks at both root `sdks/` and nested `apps/<app>/sdks/` directories.
 *
 * @param {string} repoRoot
 * @returns {PublishableSdk[]}
 */
export function discoverRepoSdks(repoRoot) {
  const out = [];
  const candidates = [path.join(repoRoot, 'sdks')];
  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const app of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (app.isDirectory()) candidates.push(path.join(appsDir, app.name, 'sdks'));
    }
  }

  for (const sdksDir of candidates) {
    if (!fs.existsSync(sdksDir)) continue;
    for (const entry of fs.readdirSync(sdksDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const familyRoot = path.join(sdksDir, entry.name);
      out.push(...discoverFamilyLanguages(repoRoot, familyRoot, entry.name));
    }
  }
  return out;
}

/**
 * Resolve languages for one SDK family.
 *
 * Resolution order:
 *  1. `sdk-manifest.json#languages[]` (declared language list)
 *  2. Conventional `<family>-<lang>` directory probe (for families
 *     whose manifest predates the `languages[]` field)
 *
 * @param {string} repoRoot
 * @param {string} familyRoot
 * @param {string} familyStem
 * @returns {PublishableSdk[]}
 */
export function discoverFamilyLanguages(repoRoot, familyRoot, familyStem) {
  const manifestPath = path.join(familyRoot, 'sdk-manifest.json');
  const manifest = readJson(manifestPath) ?? {};
  const sdkFamily = manifest.sdkFamily ?? familyStem;

  const declared = new Set();
  if (Array.isArray(manifest.languages)) {
    for (const entry of manifest.languages) {
      const lang = typeof entry === 'string' ? entry : entry?.language;
      if (lang) declared.add(lang.toLowerCase());
    }
  }

  const out = [];
  const pushLanguage = (language, manifestDriven) => {
    if (!SUPPORTED_LANGUAGES.includes(language)) return;
    const languageRoot = findLanguageRoot(familyRoot, language);
    if (!languageRoot) return;
    out.push({
      repoRoot,
      repoName: path.basename(repoRoot),
      familyRoot,
      sdkFamily,
      language,
      languageRoot,
      manifestPath,
      manifest,
      manifestDriven,
    });
  };

  for (const lang of declared) pushLanguage(lang, true);

  // Probe conventional directories when manifest is silent or partial.
  if (declared.size === 0) {
    for (const lang of SUPPORTED_LANGUAGES) pushLanguage(lang, false);
  }

  return out;
}

/**
 * Filter the discovered list by repo / family / language selectors.
 *
 * @param {PublishableSdk[]} all
 * @param {{repo?: string, family?: string, language?: string}} filters
 * @returns {PublishableSdk[]}
 */
export function filterPublishable(all, { repo, family, language } = {}) {
  return all.filter((item) => {
    if (repo && item.repoName !== repo) return false;
    if (family && item.sdkFamily !== family) return false;
    if (language && language !== 'all' && item.language !== language) return false;
    return true;
  });
}

/** Pretty-print a discovered record for dry-run output. */
export function describePublishable(item) {
  return `${item.repoName}/${item.sdkFamily}/${item.language} @ ${toDisplayPath(item.languageRoot)}`;
}
