#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectWorkspaceValidationIssues } from './lib/workspace-check-runner.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
]);

const SOURCE_EXTENSIONS = new Set([
  '.arb',
  '.dart',
  '.ftl',
  '.json',
  '.properties',
  '.strings',
  '.stringsdict',
  '.toml',
  '.ts',
  '.xml',
  '.yaml',
  '.yml',
  '.rs',
]);

const GENERATED_MARKERS = [
  'sdkwork-i18n-generated',
  'Generated from SDKWork i18n fragments',
  '@generated',
];

const LOCALE_FILE_RE = /^[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?(?:-(?:[a-z0-9]{5,8}|\d[a-z0-9]{3}))*$/u;
const SOURCE_LOCALE_MONOLITH_RE = /^(?:[a-z]{2,3}(?:-[A-Z][a-z]{3})?(?:-(?:[A-Z]{2}|\d{3}))?|messages)\.(?:ts|json|arb|properties|xml|yaml|yml|toml|ftl)$/u;

function usage() {
  return [
    'Usage:',
    '  node tools/check-i18n-standard.mjs [--root <repo>]',
    '  node tools/check-i18n-standard.mjs --workspace <sdkwork-space-root>',
    '',
    'Validates SDKWork i18n source directory layouts and generated platform resource boundaries.',
  ].join('\n');
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isTextFile(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function isIgnoredDirectory(entryName) {
  return SKIP_DIRS.has(entryName);
}

function walkFiles(rootDir) {
  const files = [];
  if (!fs.existsSync(rootDir)) return files;
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!isIgnoredDirectory(entry.name)) {
          stack.push(fullPath);
        }
        continue;
      }
      if (entry.isFile() && isTextFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function afterSequence(segments, sequence) {
  for (let index = 0; index <= segments.length - sequence.length; index += 1) {
    let matches = true;
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (segments[index + offset] !== sequence[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return segments.slice(index + sequence.length);
    }
  }
  return null;
}

function hasGeneratedMarker(text) {
  return GENERATED_MARKERS.some((marker) => text.includes(marker));
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function isGitkeep(relativeSegments) {
  return relativeSegments[relativeSegments.length - 1] === '.gitkeep';
}

function isThinI18nIndex(fileName) {
  return /^(?:index|manifest)\.(?:ts|js|mjs|json|dart|rs)$/u.test(fileName);
}

function validateLocaleSourceLayout({ rel, after, allowedExtensions, label, allowKeys = false, issues }) {
  if (after.length === 0) return;
  if (isGitkeep(after)) return;
  if (after[0] === 'generated') return;
  if (allowKeys && after[0] === 'keys') {
    if (after.length < 3) {
      issues.push(`${rel}: ${label} i18n key contracts must use keys/<domain>/<capability>`);
    }
    return;
  }

  const fileName = after[after.length - 1];
  if (after.length === 1 && isThinI18nIndex(fileName)) return;
  if (SOURCE_LOCALE_MONOLITH_RE.test(fileName) && after.length <= 2) {
    issues.push(`${rel}: locale monolith is forbidden; split authored messages by <locale>/<domain>/<capability>/<fragment>`);
    return;
  }

  const locale = after[0];
  if (!LOCALE_FILE_RE.test(locale)) {
    issues.push(`${rel}: authored i18n source directory must start with a normalized BCP 47 locale such as zh-CN or en-US`);
    return;
  }

  if (after.length < 4) {
    issues.push(`${rel}: ${label} i18n fragments must use <locale>/<domain>/<capability>/<fragment>`);
    return;
  }

  const ext = path.extname(fileName);
  if (!allowedExtensions.has(ext)) {
    issues.push(`${rel}: ${label} i18n fragment extension ${ext || '<none>'} is not part of the standard source layout`);
  }
}

function validateDatabaseSeedLayout({ rel, after, issues }) {
  if (after.length === 0 || isGitkeep(after)) return;
  const locale = after[0];
  if (!LOCALE_FILE_RE.test(locale)) {
    issues.push(`${rel}: database locale seed directory must start with normalized BCP 47 locale`);
    return;
  }
  if (after.length < 4) {
    issues.push(`${rel}: database locale seed files must use locales/<locale>/<domain>/<capability>/<seed>`);
  }
}

function countAndroidStrings(text) {
  return [...text.matchAll(/<string\b/gu)].length;
}

function countIosStrings(text) {
  return [...text.matchAll(/^\s*"[^"]+"\s*=/gmu)].length;
}

function countJsonLikeMessages(text) {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).filter((key) => !key.startsWith('@')).length;
    }
  } catch {
    return [...text.matchAll(/"[^"]+"\s*:/gu)].length;
  }
  return 0;
}

function platformAggregateIssue(rel, text) {
  const normalized = rel;
  const basename = path.posix.basename(normalized);
  let messageCount = 0;

  if (/\/src\/main\/res\/values[^/]*\/strings\.xml$/u.test(normalized)) {
    messageCount = countAndroidStrings(text);
  } else if (/\.lproj\/Localizable\.strings$/u.test(normalized)) {
    messageCount = countIosStrings(text);
  } else if (/\/src\/main\/resources\/.*\/element\/string\.json$/u.test(normalized)) {
    messageCount = countJsonLikeMessages(text);
  } else if (/\/lib\/l10n\/app_[A-Za-z0-9_-]+\.arb$/u.test(normalized)) {
    messageCount = countJsonLikeMessages(text);
  } else if (
    (normalized.includes('/platform/') || normalized.includes('/miniprogram/'))
    && normalized.includes('/i18n/')
    && /\.(?:json|ts|js)$/u.test(basename)
  ) {
    messageCount = countJsonLikeMessages(text);
  } else {
    return null;
  }

  if (messageCount > 2 && !hasGeneratedMarker(text)) {
    return `${rel}: platform aggregate i18n resource contains ${messageCount} messages without a generated marker; author source fragments under the SDKWork i18n layout`;
  }
  return null;
}

function hasLikelyAuthoredRustMessage(text) {
  return /[\u3400-\u9FFF]/u.test(text) || /\b[A-Z0-9_]*(?:TITLE|LABEL|MESSAGE|ERROR|SUBMIT)[A-Z0-9_]*\b\s*:/u.test(text);
}

function validateBackendLegacyMessageLocations({ filePath, rel, text, issues }) {
  if (/(?:^|\/)crates\/[^/]+\/src\/i18n\.rs$/u.test(rel) && hasLikelyAuthoredRustMessage(text)) {
    issues.push(`${rel}: Rust backend message resources must be authored under resources/i18n/<locale>/<domain>/<capability>/; src/i18n.rs may only be a thin registry`);
  }
  if (/\/src\/main\/resources\/messages(?:_[A-Za-z0-9_]+)?\.(?:properties|yaml|yml|json)$/u.test(rel)) {
    issues.push(`${rel}: Java/Spring backend message resources must be authored under src/main/resources/i18n/<locale>/<domain>/<capability>/`);
  }
  if (path.basename(filePath) === 'Localizable.strings' && !rel.includes('.lproj/')) {
    issues.push(`${rel}: iOS localization files must be generated platform projections under .lproj or authored fragments under I18n/<locale>/<domain>/<capability>/`);
  }
}

function validateRootI18nDirectory({ segments, rel, issues }) {
  if (segments[0] !== 'i18n') return;
  if (segments[1] === 'keys') {
    if (segments.length < 4 && !isGitkeep(segments)) {
      issues.push(`${rel}: root i18n key contracts must use i18n/keys/<domain>/<capability>`);
    }
    return;
  }
  if (segments[1] === 'generated') return;
  issues.push(`${rel}: repository-root i18n directories are forbidden for application/backend message copy; use package-local i18n fragments`);
}

function validateI18nPath(filePath, repoRoot, issues) {
  const rel = toPosix(path.relative(repoRoot, filePath));
  const segments = rel.split('/');
  const text = readText(filePath);

  validateRootI18nDirectory({ segments, rel, issues });

  const platformIssue = platformAggregateIssue(rel, text);
  if (platformIssue) {
    issues.push(platformIssue);
  }
  validateBackendLegacyMessageLocations({ filePath, rel, text, issues });

  const flutterAfter = afterSequence(segments, ['lib', 'src', 'i18n']);
  if (flutterAfter) {
    validateLocaleSourceLayout({
      rel,
      after: flutterAfter,
      allowedExtensions: new Set(['.arb', '.json']),
      label: 'Flutter/Dart',
      issues,
    });
  }

  const javaAfter = afterSequence(segments, ['src', 'main', 'resources', 'i18n']);
  if (javaAfter) {
    validateLocaleSourceLayout({
      rel,
      after: javaAfter,
      allowedExtensions: new Set(['.properties', '.yaml', '.yml', '.json']),
      label: 'Java/Spring',
      issues,
    });
  }

  const tsAfter = afterSequence(segments, ['src', 'i18n']);
  if (tsAfter && !flutterAfter) {
    validateLocaleSourceLayout({
      rel,
      after: tsAfter,
      allowedExtensions: new Set(['.ts', '.json']),
      label: 'TypeScript',
      allowKeys: true,
      issues,
    });
  }

  const androidAfter = afterSequence(segments, ['src', 'main', 'i18n']);
  if (androidAfter) {
    validateLocaleSourceLayout({
      rel,
      after: androidAfter,
      allowedExtensions: new Set(['.json', '.xml', '.properties']),
      label: 'Android',
      issues,
    });
  }

  const iosAfter = (() => {
    const sourcesIndex = segments.indexOf('Sources');
    if (sourcesIndex >= 0 && segments[sourcesIndex + 2] === 'I18n') {
      return segments.slice(sourcesIndex + 3);
    }
    return null;
  })();
  if (iosAfter) {
    validateLocaleSourceLayout({
      rel,
      after: iosAfter,
      allowedExtensions: new Set(['.json', '.strings.json']),
      label: 'iOS/Swift',
      issues,
    });
  }

  const harmonyAfter = afterSequence(segments, ['src', 'main', 'ets', 'i18n']);
  if (harmonyAfter) {
    validateLocaleSourceLayout({
      rel,
      after: harmonyAfter,
      allowedExtensions: new Set(['.json', '.ts']),
      label: 'Harmony/ArkTS',
      issues,
    });
  }

  const rustAfter = afterSequence(segments, ['resources', 'i18n']);
  if (rustAfter && !javaAfter) {
    validateLocaleSourceLayout({
      rel,
      after: rustAfter,
      allowedExtensions: new Set(['.ftl', '.json', '.toml']),
      label: 'Rust',
      issues,
    });
  }

  const databaseAfter = afterSequence(segments, ['database', 'seeds', 'locales']);
  if (databaseAfter) {
    validateDatabaseSeedLayout({ rel, after: databaseAfter, issues });
  }
}

export function validateI18nStandard(repoRoot) {
  const issues = [];
  for (const filePath of walkFiles(repoRoot)) {
    validateI18nPath(filePath, repoRoot, issues);
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: SPECS_ROOT },
      workspace: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    process.exit(0);
  }

  const issues = values.workspace
    ? collectWorkspaceValidationIssues(
      path.resolve(values.workspace),
      (repoRoot) => validateI18nStandard(repoRoot),
    )
    : validateI18nStandard(path.resolve(values.root));

  if (issues.length > 0) {
    console.error('i18n standard check failed: violations found');
    for (const issue of issues.slice(0, 200)) {
      console.error(`- ${issue}`);
    }
    if (issues.length > 200) {
      console.error(`- ... and ${issues.length - 200} more`);
    }
    process.exit(1);
  }

  console.log('i18n standard check passed');
}

if (process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])) {
  main();
}
