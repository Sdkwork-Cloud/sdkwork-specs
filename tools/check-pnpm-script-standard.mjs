#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const REQUIRED_ROOT_SCRIPTS = ['dev', 'build', 'test', 'check', 'verify', 'clean'];

const ALLOWED_FIRST_SEGMENTS = new Set([
  'dev',
  'start',
  'preview',
  'build',
  'test',
  'check',
  'verify',
  'clean',
  'typecheck',
  'lint',
  'format',
  'release',
  'deploy',
  'db',
  'api',
  'sdk',
  'gateway',
  'topology',
  'workflow',
  'sbom',
  'nginx',
  'docs',
  'perf',
  'migrate',
  'install',
  'admin',
  'models',
  'downloads',
  'skills',
  'app-store',
  'smoke',
]);

const RETIRED_SCRIPT_TOKENS = new Set([
  'self-hosted',
  'cloud-hosted',
  'hosting',
  'deploymentMode',
  'unified-process',
  'split-services',
]);
const RETIRED_COMMAND_VALUE_PATTERNS = [
  ['--hosting', /(?:^|\s)--hosting(?:\s|=|$)/iu],
  ['service-layout', /(?:^|\s)--service-layout(?:\s|=|$)/iu],
  ['self-hosted', /\bself-hosted\b/iu],
  ['cloud-hosted', /\bcloud-hosted\b/iu],
  ['unified-process', /\bunified-process\b/iu],
  ['split-services', /\bsplit-services\b/iu],
  ['serviceLayout', /\bserviceLayout\b/iu],
  ['deploymentMode', /\bdeploymentMode\b/iu],
];
const DEPLOYMENT_PROFILES = new Set(['standalone', 'cloud']);
const RUNTIME_TARGETS = new Set([
  'browser',
  'desktop',
  'server',
  'container',
  'tablet-ipados',
  'tablet-android',
  'capacitor-ios',
  'capacitor-android',
  'flutter-ios',
  'flutter-android',
  'android-native',
  'ios-native',
  'harmony-native',
  'mini-program',
  'test-runner',
]);
const DATABASE_ALIASES = new Set(['postgres', 'sqlite']);
const QUALITY_TIERS = new Set([
  'fast',
  'precommit',
  'full',
  'parallel',
  'smoke',
  'debug',
  'local',
  'check',
  'required',
  'docker',
]);
const DEV_AXIS_VALUES = new Set([
  ...RUNTIME_TARGETS,
  ...DATABASE_ALIASES,
  ...DEPLOYMENT_PROFILES,
  ...QUALITY_TIERS,
]);
const ACTION_FIRST_RUNTIME_TARGET_ALIASES = new Map([
  ['browser', 'browser'],
  ['desktop', 'desktop'],
  ['tauri', 'desktop'],
  ['docker', 'container'],
  ['android', 'android-native'],
  ['ios', 'ios-native'],
  ['harmony', 'harmony-native'],
  ['flutter', 'flutter-android'],
  ['mini-program', 'mini-program'],
]);
const RETIRED_RUNTIME_TARGET_ALIASES = new Map([['tauri', 'desktop']]);
const RETIRED_LOCAL_FIRST_SEGMENTS = new Set([
  'server',
  'service',
  'portal',
  'product',
  'alignment',
  'apis',
  'file-sdk',
  'prepare',
]);
const DOC_FILE_EXTENSIONS = new Set(['.md', '.mdx']);
const RUNNER_SCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.sh', '.ps1', '.cmd', '.bat']);
const RUNNER_SCRIPT_ROOTS = new Set(['scripts', 'tools']);
const COMMAND_JSON_FILENAMES = new Set(['sdkwork.app.config.json', 'sdkwork.workflow.json', 'tauri.conf.json']);
const PNPM_NATIVE_COMMANDS = new Set([
  'add',
  'approve-builds',
  'audit',
  'config',
  'create',
  'dlx',
  'env',
  'exec',
  'import',
  'init',
  'install',
  'link',
  'list',
  'outdated',
  'pack',
  'patch',
  'publish',
  'remove',
  'setup',
  'store',
  'unlink',
  'update',
  'why',
]);
const PNPM_PROSE_WORDS = new Set([
  'command',
  'commands',
  'script',
  'scripts',
]);
const IGNORED_DIRS = new Set([
  '.git',
  '.pnpm',
  '.vite',
  'node_modules',
  'target',
  'dist',
  'generated',
]);
const IGNORED_DOCUMENT_PATH_PARTS = new Set([
  'artifacts',
  'docs/review',
  'docs/superpowers',
  '.sdkwork/manual-backups',
]);

function usage() {
  return [
    'Usage: node tools/check-pnpm-script-standard.mjs --root <repo> [--application-code-prefix a,b,c]',
    '',
    'Validates SDKWork repository root package.json scripts against PNPM_SCRIPT_SPEC.md.',
  ].join('\n');
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/u, '');
  return JSON.parse(text);
}

function splitCsv(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function fail(message, details = []) {
  console.error(`pnpm script standard failed: ${message}`);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function isPackageJsonGenerated(packagePath) {
  const normalized = packagePath.replaceAll(path.sep, '/');
  return normalized.includes('/generated/') || normalized.includes('/.sdkwork/manual-backups/');
}

function pushGatewayNameIssues(scriptName, issues, prefix = '') {
  const parts = scriptName.split(':');
  if (parts[0] !== 'gateway' || parts.length < 3) return;
  if (DEPLOYMENT_PROFILES.has(parts[1])) {
    issues.push(
      `${prefix}${scriptName}: use gateway:<action>[:deploymentProfile], for example gateway:${parts[2]}:${parts[1]}`,
    );
  }
}

function pushActionFirstRuntimeTargetIssues(scriptName, issues, prefix = '') {
  const parts = scriptName.split(':');
  const runtimeTarget = ACTION_FIRST_RUNTIME_TARGET_ALIASES.get(parts[0]);
  if (!runtimeTarget || parts.length < 2) return;

  issues.push(
    `${prefix}${scriptName}: use action-first runtime target script names such as ${parts[1]}:${runtimeTarget}`,
  );
}

function pushRuntimeTargetAliasIssues(scriptName, issues, prefix = '') {
  const parts = scriptName.split(':');
  for (const [index, part] of parts.entries()) {
    const runtimeTarget = RETIRED_RUNTIME_TARGET_ALIASES.get(part);
    if (!runtimeTarget) continue;
    const action = index > 0 ? parts[0] : parts[1] || 'dev';
    issues.push(
      `${prefix}${scriptName}: use runtime target "${runtimeTarget}" instead of tool alias "${part}", for example ${action}:${runtimeTarget}`,
    );
  }
}

function pushDevAxisIssues(scriptName, issues, prefix = '') {
  const parts = scriptName.split(':');
  if (parts[0] !== 'dev' || parts.length < 2) {
    return;
  }

  for (const part of parts.slice(1)) {
    if (DEV_AXIS_VALUES.has(part)) {
      continue;
    }
    if (RUNTIME_TARGETS.has(parts[1])) {
      issues.push(
        `${prefix}${scriptName}: "${part}" is not a standard dev axis value; use runtimeTarget, database, deploymentProfile, or tier suffixes`,
      );
    } else {
      issues.push(
        `${prefix}${scriptName}: "${part}" is not a standard dev runtime target; use one of ${[...RUNTIME_TARGETS].join(', ')}`,
      );
    }
  }
}

function isIgnoredPathPart(filePath, ignoredParts) {
  const normalized = filePath.replaceAll(path.sep, '/');
  for (const part of ignoredParts) {
    if (normalized.includes(`/${part}/`) || normalized.endsWith(`/${part}`)) {
      return true;
    }
  }
  return false;
}

function scriptNameHasSegment(scriptName, segment) {
  return scriptName.split(':').includes(segment);
}

function commandHasFlagValue(commandText, flagName, value) {
  const escapedFlag = flagName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(
    `(?:^|\\s)--${escapedFlag}(?:\\s+|=)${escapedValue}(?:\\s|$)`,
    'iu',
  );
  return pattern.test(commandText);
}

function commandUsesRetiredHostingAxis(commandText) {
  return getRetiredCommandValueTokens(commandText).some((token) => (
    token === '--hosting' || token === 'self-hosted' || token === 'cloud-hosted'
  ));
}

function getRetiredCommandValueTokens(commandText) {
  const tokens = [];
  for (const [token, pattern] of RETIRED_COMMAND_VALUE_PATTERNS) {
    if (pattern.test(commandText)) {
      tokens.push(token);
    }
  }
  return tokens;
}

function pushRetiredCommandValueIssues(commandLabel, commandText, issues, prefix = '') {
  for (const token of getRetiredCommandValueTokens(commandText)) {
    issues.push(`${prefix}${commandLabel}: command value uses retired deployment token "${token}"`);
  }
}

function pushRetiredCommandExampleIssues(commandLabel, commandText, issues, prefix = '') {
  for (const token of getRetiredCommandValueTokens(commandText)) {
    issues.push(`${prefix}${commandLabel}: command example uses retired deployment token "${token}"`);
  }
}

function resolveRootScriptDelegation(scriptName, scripts) {
  const trace = [];
  const seen = new Set();
  let currentName = scriptName;

  while (scripts[currentName] && !seen.has(currentName)) {
    seen.add(currentName);
    const commandText = String(scripts[currentName]);
    trace.push({ commandText, scriptName: currentName });

    const delegation = commandText.match(
      /^\s*pnpm(?:\.cmd)?(?:\s+run)?\s+([a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)*)\b/iu,
    );
    if (!delegation) {
      break;
    }

    const delegatedScriptName = delegation[1];
    if (!scripts[delegatedScriptName] || delegatedScriptName === currentName) {
      break;
    }

    currentName = delegatedScriptName;
  }

  return trace;
}

function pushDefaultDevRuntimeIssues(defaultScriptName, scripts, issues) {
  if (!scripts[defaultScriptName]) {
    return;
  }

  const trace = resolveRootScriptDelegation(defaultScriptName, scripts);
  const scriptNames = trace.map((entry) => entry.scriptName);
  const commandText = trace.map((entry) => entry.commandText).join('\n');

  const hasPostgres = scriptNames.some((scriptName) => scriptNameHasSegment(scriptName, 'postgres'))
    || commandHasFlagValue(commandText, 'database', 'postgres');
  const hasSqlite = scriptNames.some((scriptName) => scriptNameHasSegment(scriptName, 'sqlite'))
    || commandHasFlagValue(commandText, 'database', 'sqlite');
  const hasStandalone = scriptNames.some((scriptName) => scriptNameHasSegment(scriptName, 'standalone'))
    || commandHasFlagValue(commandText, 'deployment-profile', 'standalone');
  const hasCloud = scriptNames.some((scriptName) => scriptNameHasSegment(scriptName, 'cloud'))
    || commandHasFlagValue(commandText, 'deployment-profile', 'cloud');
  if (commandUsesRetiredHostingAxis(commandText)) {
    issues.push(
      `${defaultScriptName}: default dev runtime must use --deployment-profile standalone instead of retired --hosting`,
    );
  }
  if (hasSqlite || !hasPostgres) {
    issues.push(
      `${defaultScriptName}: default dev runtime must resolve to database "postgres" through script suffix or --database postgres`,
    );
  }
  if (hasCloud || !hasStandalone) {
    issues.push(
      `${defaultScriptName}: default dev runtime must resolve to deployment profile "standalone" through script suffix or --deployment-profile standalone`,
    );
  }
}

function pushDefaultDevelopmentRuntimeIssues(scripts, issues) {
  pushDefaultDevRuntimeIssues('dev:browser', scripts, issues);
  pushDefaultDevRuntimeIssues('dev:desktop', scripts, issues);
}

function pushCommandNameIssues(
  scriptName,
  issues,
  productPrefixes,
  prefix = '',
  productPrefixMessage = 'application-code-prefixed public root scripts are forbidden',
) {
  const first = scriptName.split(':')[0];
  if (!ALLOWED_FIRST_SEGMENTS.has(first)) {
    issues.push(`${prefix}${scriptName}: first segment "${first}" is not a standard public namespace`);
  }
  if (productPrefixes.includes(first) && !ALLOWED_FIRST_SEGMENTS.has(first)) {
    issues.push(`${prefix}${scriptName}: ${productPrefixMessage}`);
  }
  pushActionFirstRuntimeTargetIssues(scriptName, issues, prefix);
  pushRuntimeTargetAliasIssues(scriptName, issues, prefix);
  pushDevAxisIssues(scriptName, issues, prefix);
  for (const token of scriptName.split(':')) {
    if (RETIRED_SCRIPT_TOKENS.has(token)) {
      issues.push(`${prefix}${scriptName}: retired token "${token}" must not appear in public scripts`);
    }
  }
  pushGatewayNameIssues(scriptName, issues, prefix);
}

function validateRootScripts(root, productPrefixes) {
  const packagePath = path.join(root, 'package.json');
  if (!fs.existsSync(packagePath)) {
    fail(`missing root package.json at ${packagePath}`);
  }

  const manifest = readJson(packagePath);
  const scripts = manifest.scripts || {};
  const scriptNames = Object.keys(scripts).sort();
  const issues = [];

  for (const required of REQUIRED_ROOT_SCRIPTS) {
    if (!scripts[required]) {
      issues.push(`missing required root script "${required}"`);
    }
  }

  for (const scriptName of scriptNames) {
    pushCommandNameIssues(scriptName, issues, productPrefixes);
    pushRetiredCommandValueIssues(scriptName, String(scripts[scriptName]), issues);
  }
  pushDefaultDevelopmentRuntimeIssues(scripts, issues);

  if (issues.length > 0) {
    fail(`${path.relative(process.cwd(), packagePath)} is not compliant`, issues);
  }

  return { packagePath, scriptCount: scriptNames.length };
}

function validatePackageLocalScripts(root) {
  const packagePaths = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.name === 'package.json') {
        packagePaths.push(path.join(dir, entry.name));
      }
    }
  }

  walk(root);
  const issues = [];

  for (const packagePath of packagePaths) {
    if (packagePath === path.join(root, 'package.json')) continue;
    if (isPackageJsonGenerated(packagePath)) continue;

    const manifest = readJson(packagePath);
    const scripts = manifest.scripts || {};
    for (const scriptName of Object.keys(scripts)) {
      const first = scriptName.split(':')[0];
      if (RETIRED_LOCAL_FIRST_SEGMENTS.has(first)) {
        issues.push(
          `${path.relative(root, packagePath)}#${scriptName}: first segment "${first}" is not a standard local namespace`,
        );
      }
      pushActionFirstRuntimeTargetIssues(scriptName, issues, `${path.relative(root, packagePath)}#`);
      pushRuntimeTargetAliasIssues(scriptName, issues, `${path.relative(root, packagePath)}#`);
      pushDevAxisIssues(scriptName, issues, `${path.relative(root, packagePath)}#`);
      for (const token of scriptName.split(':')) {
        if (RETIRED_SCRIPT_TOKENS.has(token)) {
          issues.push(`${path.relative(root, packagePath)}#${scriptName}: retired token "${token}"`);
        }
      }
      pushRetiredCommandValueIssues(
        scriptName,
        String(scripts[scriptName]),
        issues,
        `${path.relative(root, packagePath)}#`,
      );
    }
  }

  if (issues.length > 0) {
    fail('package-local scripts are not compliant', issues);
  }

  return packagePaths.length;
}

function collectDocumentationFiles(root) {
  const docPaths = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (isIgnoredPathPart(entryPath, IGNORED_DOCUMENT_PATH_PARTS)) continue;
        walk(entryPath);
        continue;
      }

      if (DOC_FILE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        docPaths.push(entryPath);
      }
    }
  }

  walk(root);
  return docPaths;
}

function extractPnpmCommands(line) {
  return extractPnpmCommandExamples(line).map((command) => command.scriptName);
}

function extractPnpmCommandExamples(line) {
  const commands = [];
  const pattern = /\bpnpm(?:\.cmd)?(\s+run)?\s+([a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)*)/gi;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    const usedRun = Boolean(match[1]);
    const scriptName = match[2];
    if (!usedRun && PNPM_PROSE_WORDS.has(scriptName.toLowerCase())) {
      continue;
    }
    if (!usedRun && (/^\d/.test(scriptName) || PNPM_NATIVE_COMMANDS.has(scriptName))) {
      continue;
    }
    commands.push({ commandText: line.slice(match.index), scriptName });
  }
  return commands;
}

function validateDocumentationExamples(root, productPrefixes) {
  const docPaths = collectDocumentationFiles(root);
  const issues = [];

  for (const docPath of docPaths) {
    const text = fs.readFileSync(docPath, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      for (const { commandText, scriptName } of extractPnpmCommandExamples(line)) {
        const prefix = `${path.relative(root, docPath)}:${index + 1}: pnpm `;
        pushCommandNameIssues(
          scriptName,
          issues,
          productPrefixes,
          prefix,
          'application-code-prefixed command examples are forbidden',
        );
        pushRetiredCommandExampleIssues(scriptName, commandText, issues, prefix);
      }
    }
  }

  if (issues.length > 0) {
    fail('documentation pnpm command examples are not compliant', issues);
  }

  return docPaths.length;
}

function collectCommandJsonFiles(root) {
  const jsonPaths = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (isIgnoredPathPart(entryPath, IGNORED_DOCUMENT_PATH_PARTS)) continue;
        walk(entryPath);
        continue;
      }

      if (
        COMMAND_JSON_FILENAMES.has(entry.name) ||
        (entry.name.endsWith('.json') && entryPath.replaceAll(path.sep, '/').includes('/specs/'))
      ) {
        jsonPaths.push(entryPath);
      }
    }
  }

  walk(root);
  return jsonPaths;
}

function collectStringValues(value, pointer = '', output = []) {
  if (typeof value === 'string') {
    output.push([pointer || '$', value]);
    return output;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectStringValues(item, `${pointer}.${index}`, output);
    }
    return output;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      collectStringValues(item, pointer ? `${pointer}.${key}` : key, output);
    }
  }
  return output;
}

function validateJsonCommandExamples(root, productPrefixes) {
  const jsonPaths = collectCommandJsonFiles(root);
  const issues = [];

  for (const jsonPath of jsonPaths) {
    const manifest = readJson(jsonPath);
    for (const [pointer, text] of collectStringValues(manifest)) {
      for (const { commandText, scriptName } of extractPnpmCommandExamples(text)) {
        const prefix = `${path.relative(root, jsonPath)}: ${pointer}: pnpm `;
        pushCommandNameIssues(
          scriptName,
          issues,
          productPrefixes,
          prefix,
          'application-code-prefixed command examples are forbidden',
        );
        pushRetiredCommandExampleIssues(scriptName, commandText, issues, prefix);
      }
    }
  }

  if (issues.length > 0) {
    fail('manifest/workflow pnpm command examples are not compliant', issues);
  }

  return jsonPaths.length;
}

function collectRunnerScriptFiles(root) {
  const runnerPaths = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        if (isIgnoredPathPart(entryPath, IGNORED_DOCUMENT_PATH_PARTS)) continue;
        walk(entryPath);
        continue;
      }

      const relativePath = path.relative(root, entryPath);
      const normalized = relativePath.replaceAll(path.sep, '/');
      const firstPart = normalized.split('/')[0];
      const extension = path.extname(entry.name).toLowerCase();
      if (!RUNNER_SCRIPT_ROOTS.has(firstPart) || !RUNNER_SCRIPT_EXTENSIONS.has(extension)) {
        continue;
      }
      if (/\.(?:test|spec)\.[cm]?[jt]s$/iu.test(entry.name)) {
        continue;
      }
      runnerPaths.push(entryPath);
    }
  }

  walk(root);
  return runnerPaths;
}

function extractQuotedScriptNames(line, productPrefixes) {
  const commands = [];
  const pattern = /["'`]([a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)+)["'`]/giu;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    const scriptName = match[1];
    if (!isRiskyRunnerScriptReference(scriptName, productPrefixes)) {
      continue;
    }
    commands.push(scriptName);
  }
  return commands;
}

function isRiskyRunnerScriptReference(scriptName, productPrefixes) {
  const parts = scriptName.split(':');
  const first = parts[0];
  if (parts.length < 2) {
    return false;
  }
  return (
    productPrefixes.includes(first)
    || first === 'dev'
    || ACTION_FIRST_RUNTIME_TARGET_ALIASES.has(first)
    || RETIRED_LOCAL_FIRST_SEGMENTS.has(first)
    || RETIRED_RUNTIME_TARGET_ALIASES.has(first)
    || first === 'gateway'
    || first === 'api'
    || first === 'apis'
  );
}

function validateRunnerScriptExamples(root, productPrefixes) {
  const runnerPaths = collectRunnerScriptFiles(root);
  const issues = [];

  for (const runnerPath of runnerPaths) {
    const text = fs.readFileSync(runnerPath, 'utf8');
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      const prefix = `${path.relative(root, runnerPath)}:${index + 1}: pnpm `;
      for (const { commandText, scriptName } of extractPnpmCommandExamples(line)) {
        pushCommandNameIssues(
          scriptName,
          issues,
          productPrefixes,
          prefix,
          'application-code-prefixed command examples are forbidden',
        );
        pushRetiredCommandExampleIssues(scriptName, commandText, issues, prefix);
      }
      for (const scriptName of extractQuotedScriptNames(line, productPrefixes)) {
        if (productPrefixes.includes(scriptName.split(':')[0])) {
          pushCommandNameIssues(
            scriptName,
            issues,
            productPrefixes,
            prefix,
            'application-code-prefixed command examples are forbidden',
          );
          continue;
        }
        pushCommandNameIssues(
          scriptName,
          issues,
          productPrefixes,
          prefix,
          'application-code-prefixed command examples are forbidden',
        );
      }
    }
  }

  if (issues.length > 0) {
    fail('runner script pnpm command references are not compliant', issues);
  }

  return runnerPaths.length;
}

const parsed = parseArgs({
  options: {
    root: { type: 'string' },
    'application-code-prefix': { type: 'string', multiple: true },
    'product-prefix': { type: 'string', multiple: true },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: false,
});

if (parsed.values.help) {
  console.log(usage());
  process.exit(0);
}

const root = path.resolve(parsed.values.root || process.cwd());
const applicationCodePrefixes = [
  ...(parsed.values['application-code-prefix']
    ? parsed.values['application-code-prefix'].flatMap(splitCsv)
    : []),
  ...(parsed.values['product-prefix'] ? parsed.values['product-prefix'].flatMap(splitCsv) : []),
];

const rootResult = validateRootScripts(root, applicationCodePrefixes);
const packageCount = validatePackageLocalScripts(root);
const docCount = validateDocumentationExamples(root, applicationCodePrefixes);
const jsonCount = validateJsonCommandExamples(root, applicationCodePrefixes);
const runnerCount = validateRunnerScriptExamples(root, applicationCodePrefixes);

console.log(
  `pnpm script standard ok: ${path.relative(process.cwd(), rootResult.packagePath) || rootResult.packagePath} (${rootResult.scriptCount} root scripts, ${packageCount} package manifests scanned, ${docCount} docs scanned, ${jsonCount} command json files scanned, ${runnerCount} runner scripts scanned)`,
);
