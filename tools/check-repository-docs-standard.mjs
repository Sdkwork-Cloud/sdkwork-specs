#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  CANON_PATHS,
  LEGACY_CANON_PATHS,
  PRD_SHARD_PATTERN,
  REQUIRED_CANON_LINKS,
  TECH_SHARD_PATTERN,
  isLegacyRedirectStub,
} from './repository-docs-paths.mjs';

const RETIRED_ADR_DIR = 'docs/adr';
const ADR_DIR = 'docs/architecture/decisions';

const ID_PATTERNS = {
  req: /^REQ-\d{4}-\d{4}-.+\.md$/u,
  adr: /^ADR-\d{8}-.+\.md$/u,
  plan: /^PLAN-\d{4}-\d{4}-.+\.md$/u,
  review: /^REVIEW-\d{8}-.+\.md$/u,
};

function usage() {
  return [
    'Usage: node tools/check-repository-docs-standard.mjs --root <repo> [--profile <name>]',
    '',
    'Profiles:',
    '  auto          detect standards vs application repository (default)',
    '  application   full Canon documentation required',
    '  standards     sdkwork-specs-style governance Canon documentation',
    '  narrow-tool   TECH_ARCHITECTURE required; PRD may be a non-product stub',
  ].join('\n');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fileExists(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile();
}

function directoryExists(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) && fs.statSync(absolutePath).isDirectory();
}

function listTrackedMarkdownFiles(root, relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!directoryExists(root, relativeDir)) {
    return [];
  }
  const results = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') {
      continue;
    }
    results.push(path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name));
  }
  return results;
}

function linkVariants(target, fromRelativePath = '') {
  const normalized = target.replace(/\\/g, '/');
  const variants = new Set([normalized]);
  if (normalized.startsWith('docs/')) {
    variants.add(normalized.slice('docs/'.length));
  }
  if (fromRelativePath.replace(/\\/g, '/').startsWith('docs/') && !normalized.startsWith('docs/')) {
    variants.add(`docs/${normalized}`);
  }
  return [...variants];
}

function containsLink(text, target, fromRelativePath = '') {
  return linkVariants(target, fromRelativePath).some((variant) => (
    text.includes(variant)
    || text.includes(`(${variant})`)
    || text.includes(`<${variant}>`)
  ));
}

function detectProfile(root) {
  const agentsPath = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(agentsPath)) {
    return 'application';
  }
  const agentsText = readText(agentsPath);
  if (
    agentsText.includes('standards repository')
    || fs.existsSync(path.join(root, 'DOCUMENTATION_SPEC.md'))
  ) {
    return 'standards';
  }
  return 'application';
}

function validateLegacyCanon(root, issues) {
  for (const [key, legacyPath] of Object.entries(LEGACY_CANON_PATHS)) {
    if (!fileExists(root, legacyPath)) {
      continue;
    }
    const text = readText(path.join(root, legacyPath));
    if (!isLegacyRedirectStub(text)) {
      const target = key === 'prd' ? CANON_PATHS.prd : CANON_PATHS.techArchitecture;
      issues.push(
        `${legacyPath} is retired; move Canon content to ${target} and leave a redirect stub, or run tools/migrate-legacy-canon-paths.mjs`,
      );
    }
  }
}

function validateCanonDirReadmes(root, issues) {
  for (const relativePath of [CANON_PATHS.prdDirReadme, CANON_PATHS.techDirReadme]) {
    if (!fileExists(root, relativePath)) {
      issues.push(`${relativePath} must exist and explain Canon directory splitting rules`);
    }
  }
}

function validateCanonShards(root, dirRelativePath, entryFileName, shardPattern, issues) {
  if (!directoryExists(root, dirRelativePath)) {
    return;
  }
  const entryPath = path.posix.join(dirRelativePath, entryFileName);
  const entryText = fileExists(root, entryPath) ? readText(path.join(root, entryPath)) : '';
  for (const file of listTrackedMarkdownFiles(root, dirRelativePath)) {
    const baseName = path.posix.basename(file);
    if (baseName === entryFileName) {
      continue;
    }
    if (!shardPattern.test(baseName)) {
      issues.push(`${file} must match shard filename pattern ${shardPattern}`);
      continue;
    }
    if (entryText && !entryText.includes(baseName)) {
      issues.push(`${entryPath} must link to shard ${baseName}`);
    }
  }
}

function validatePrdShards(root, issues) {
  validateCanonShards(root, 'docs/product/prd', 'PRD.md', PRD_SHARD_PATTERN, issues);
}

function validateTechShards(root, issues) {
  validateCanonShards(root, 'docs/architecture/tech', 'TECH_ARCHITECTURE.md', TECH_SHARD_PATTERN, issues);
}

function validateCanonHeader(relativePath, text, issues) {
  if (!/^#\s+.+/mu.test(text)) {
    issues.push(`${relativePath} must start with a level-1 heading`);
  }
  if (!/Status:\s*(draft|active|deprecated)/iu.test(text)) {
    issues.push(`${relativePath} must declare Status: draft | active | deprecated`);
  }
  if (!/Owner:\s*.+/iu.test(text)) {
    issues.push(`${relativePath} must declare Owner`);
  }
}

function validatePrd(root, profile, issues) {
  const prdPath = CANON_PATHS.prd;
  if (!fileExists(root, prdPath)) {
    issues.push(`${prdPath} must exist`);
    return;
  }
  const text = readText(path.join(root, prdPath));
  validateCanonHeader(prdPath, text, issues);
  if (!/Specs:\s*.+REQUIREMENTS_SPEC\.md/iu.test(text) && !/REQUIREMENTS_SPEC\.md/iu.test(text)) {
    issues.push(`${prdPath} must cite REQUIREMENTS_SPEC.md`);
  }
  if (profile === 'narrow-tool') {
    if (!/not an end-user product|non-product|tool repository|foundation repository/iu.test(text)) {
      issues.push(`${prdPath} must state that a narrow-tool repository is not an end-user product`);
    }
    return;
  }
  if (profile === 'standards') {
    if (!/standards|governance|sdkwork-specs/iu.test(text)) {
      issues.push(`${prdPath} must describe standards governance for sdkwork-specs-style repositories`);
    }
    return;
  }
  if (!/##\s+.*(Goals|Scope|Problem|Background)/iu.test(text)) {
    issues.push(`${prdPath} must include product goals, scope, or background sections`);
  }
}

function validateTechArchitecture(root, issues) {
  const relativePath = CANON_PATHS.techArchitecture;
  if (!fileExists(root, relativePath)) {
    issues.push(`${relativePath} must exist`);
    return;
  }
  const text = readText(path.join(root, relativePath));
  validateCanonHeader(relativePath, text, issues);
  if (!/ARCHITECTURE_DECISION_SPEC\.md/iu.test(text)) {
    issues.push(`${relativePath} must cite ARCHITECTURE_DECISION_SPEC.md`);
  }
  if (!/##\s+.*(Technology|Architecture|Overview|Module|Boundary)/iu.test(text)) {
    issues.push(`${relativePath} must include architecture overview or technology choice sections`);
  }
}

function validateIndex(root, issues) {
  const indexPath = 'docs/INDEX.yaml';
  if (!fileExists(root, indexPath)) {
    return;
  }
  const text = readText(path.join(root, indexPath));
  if (!/kind:\s*sdkwork\.docs\.index/iu.test(text)) {
    issues.push(`${indexPath} must declare kind: sdkwork.docs.index`);
  }
  for (const [key, value] of Object.entries(CANON_PATHS)) {
    if (key === 'index' || key.endsWith('Readme')) {
      continue;
    }
    const canonKey = key;
    if (!text.includes(value) && !new RegExp(`${canonKey}:\\s*${value.replace(/\//g, '[/\\\\]')}`, 'iu').test(text)) {
      issues.push(`${indexPath} must register canon ${canonKey}: ${value}`);
    }
  }
}

function validateWorkingIds(root, issues) {
  for (const [label, relativeDir, pattern] of [
    ['REQ', 'docs/product/requirements', ID_PATTERNS.req],
    ['ADR', ADR_DIR, ID_PATTERNS.adr],
    ['PLAN', 'docs/engineering/plans', ID_PATTERNS.plan],
    ['REVIEW', 'docs/engineering/reviews', ID_PATTERNS.review],
  ]) {
    for (const file of listTrackedMarkdownFiles(root, relativeDir)) {
      const baseName = path.posix.basename(file);
      if (!pattern.test(baseName)) {
        issues.push(`${file} must match ${label} filename pattern ${pattern}`);
      }
    }
  }
}

function validateRetiredLayout(root, issues) {
  if (!directoryExists(root, RETIRED_ADR_DIR)) {
    return;
  }
  const retiredFiles = listTrackedMarkdownFiles(root, RETIRED_ADR_DIR);
  if (retiredFiles.length === 0) {
    return;
  }
  const decisionsReadme = path.join(root, ADR_DIR, 'README.md');
  const hasRedirect = fileExists(root, path.join(ADR_DIR, 'README.md'))
    && /retired|moved|redirect|docs\/adr/iu.test(readText(decisionsReadme));
  if (!hasRedirect && !fileExists(root, 'docs/archive/README.md')) {
    issues.push(
      `${RETIRED_ADR_DIR}/ contains tracked ADR files; migrate them to ${ADR_DIR}/ or document the retired layout in ${ADR_DIR}/README.md or docs/archive/README.md`,
    );
  }
}

function validateDocsIndex(root, issues) {
  const relativePath = CANON_PATHS.index;
  if (!fileExists(root, relativePath)) {
    issues.push(`${relativePath} must exist`);
    return;
  }
  const text = readText(path.join(root, relativePath));
  for (const target of [CANON_PATHS.prd, CANON_PATHS.techArchitecture]) {
    if (!containsLink(text, target, relativePath)) {
      issues.push(`${relativePath} must link to ${target}`);
    }
  }
}

function validateAgentsAndReadme(root, issues) {
  for (const relativePath of ['AGENTS.md', 'README.md']) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      if (relativePath === 'AGENTS.md') {
        issues.push('AGENTS.md must exist at the checked root');
      }
      continue;
    }
    const text = readText(absolutePath);
    for (const target of REQUIRED_CANON_LINKS) {
      if (!containsLink(text, target, relativePath)) {
        issues.push(`${relativePath} must link to ${target}`);
      }
    }
  }
}

function validateAreaReadmes(root, issues) {
  for (const relativePath of [CANON_PATHS.productReadme, CANON_PATHS.architectureReadme]) {
    if (!fileExists(root, relativePath)) {
      issues.push(`${relativePath} must exist`);
    }
  }
}

export function validateRepositoryDocsStandard(root, options = {}) {
  const issues = [];
  const profile = options.profile === 'auto' || !options.profile
    ? detectProfile(root)
    : options.profile;

  if (!directoryExists(root, 'docs')) {
    issues.push('docs/ must exist when repository documentation is active');
    return { profile, issues };
  }

  validateDocsIndex(root, issues);
  validateAreaReadmes(root, issues);
  validateCanonDirReadmes(root, issues);
  validatePrd(root, profile, issues);
  validateTechArchitecture(root, issues);
  validatePrdShards(root, issues);
  validateTechShards(root, issues);
  validateAgentsAndReadme(root, issues);
  validateIndex(root, issues);
  validateWorkingIds(root, issues);
  validateRetiredLayout(root, issues);
  validateLegacyCanon(root, issues);

  return { profile, issues };
}

function fail(message, details = []) {
  console.error(`repository docs standard failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function runCli() {
  const parsed = parseArgs({
    options: {
      root: { type: 'string' },
      profile: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });

  if (parsed.values.help) {
    console.log(usage());
    process.exit(0);
  }

  const root = path.resolve(parsed.values.root || process.cwd());
  const result = validateRepositoryDocsStandard(root, { profile: parsed.values.profile || 'auto' });

  if (result.issues.length > 0) {
    fail(`repository documentation layout is not compliant (${result.profile})`, result.issues);
  }

  console.log(`repository docs standard ok: ${root} (profile=${result.profile})`);
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  runCli();
}
