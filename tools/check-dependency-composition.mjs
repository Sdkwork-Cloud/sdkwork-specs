#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  REQUIRED_SPEC_SECTIONS,
  detectClientArchitecture,
  extractApplicationCode,
  findCorePackages,
  hasHeading,
  listClientAppRoots,
  readJson,
  readText,
  toPosix,
  validateBootstrapCompositionImports,
  validateCapabilitySdkImportBoundary,
  validateCoreCompositionLayout,
  validateManifestAlignment,
  validateManifestSchema,
  validateSdkInventoryComposition,
} from './lib/dependency-composition.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');
const SKIP_REPOS = new Set(['sdkwork-specs']);

function usage() {
  return [
    'Usage:',
    '  node tools/check-dependency-composition.mjs --root .',
    '  node tools/check-dependency-composition.mjs --workspace ..',
    '',
    'Validates APP_DEPENDENCY_COMPOSITION_SPEC.md and client app dependency manifests.',
  ].join('\n');
}

function fail(message, details = []) {
  console.error(`dependency composition check failed: ${message}`);
  for (const detail of details.slice(0, 100)) console.error(`- ${detail}`);
  if (details.length > 100) console.error(`- ... ${details.length - 100} more`);
  process.exit(1);
}

function checkSpecsRepo(root) {
  const issues = [];
  const specPath = path.join(root, 'APP_DEPENDENCY_COMPOSITION_SPEC.md');
  if (!fs.existsSync(specPath)) {
    issues.push('missing APP_DEPENDENCY_COMPOSITION_SPEC.md');
    return issues;
  }

  const text = readText(specPath);
  for (const section of REQUIRED_SPEC_SECTIONS) {
    if (!hasHeading(text, section)) {
      issues.push(`APP_DEPENDENCY_COMPOSITION_SPEC.md missing section: ${section}`);
    }
  }

  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath)) {
    const readme = readText(readmePath);
    if (!readme.includes('APP_DEPENDENCY_COMPOSITION_SPEC.md')) {
      issues.push('README.md must reference APP_DEPENDENCY_COMPOSITION_SPEC.md');
    }
  }

  const agentsPath = path.join(root, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    const agents = readText(agentsPath);
    if (!agents.includes('check-dependency-composition.mjs')) {
      issues.push('AGENTS.md must include check-dependency-composition.mjs verification command');
    }
  }

  const testSpecPath = path.join(root, 'TEST_SPEC.md');
  if (fs.existsSync(testSpecPath)) {
    const testSpec = readText(testSpecPath);
    if (!testSpec.includes('Dependency composition')) {
      issues.push('TEST_SPEC.md must include Dependency composition verification row');
    }
  }

  if (!fs.existsSync(path.join(root, 'tools/check-dependency-composition.mjs'))) {
    issues.push('missing tools/check-dependency-composition.mjs');
  }
  if (!fs.existsSync(path.join(root, 'tools/align-dependency-composition.mjs'))) {
    issues.push('missing tools/align-dependency-composition.mjs');
  }

  return issues;
}

function checkClientAppRoot(repoRoot, clientRoot) {
  const issues = [];
  const relRoot = toPosix(path.relative(repoRoot, clientRoot.appRoot));
  const manifestPath = path.join(clientRoot.appRoot, 'specs/dependency.composition.json');
  if (!fs.existsSync(manifestPath)) {
    issues.push(`${relRoot}: missing specs/dependency.composition.json`);
    return issues;
  }

  const manifest = readJson(manifestPath);
  issues.push(...validateManifestSchema(manifest, `${relRoot}/specs/dependency.composition.json`));
  issues.push(...validateManifestAlignment(manifest, clientRoot.appRoot, `${relRoot}/specs/dependency.composition.json`));

  const componentSpecPath = path.join(clientRoot.appRoot, 'specs/component.spec.json');
  if (fs.existsSync(componentSpecPath)) {
    const componentSpec = readJson(componentSpecPath);
    if (componentSpec.contracts?.dependencyComposition !== 'specs/dependency.composition.json') {
      issues.push(`${relRoot}: specs/component.spec.json must set contracts.dependencyComposition to specs/dependency.composition.json`);
    }
  }

  const applicationCode = extractApplicationCode(clientRoot.appRootName);
  if (applicationCode && manifest.applicationCode !== applicationCode) {
    issues.push(`${relRoot}: applicationCode ${manifest.applicationCode} does not match root name ${applicationCode}`);
  }
  if (clientRoot.architecture.id !== manifest.clientArchitecture) {
    issues.push(`${relRoot}: clientArchitecture ${manifest.clientArchitecture} does not match detected ${clientRoot.architecture.id}`);
  }

  const cores = findCorePackages(
    clientRoot.appRoot,
    clientRoot.appRootName,
    applicationCode,
    clientRoot.architecture,
  );
  for (const core of cores) {
    issues.push(...validateCoreCompositionLayout(core, `${relRoot}/packages/${core.packageName}`));
    issues.push(...validateSdkInventoryComposition(core, `${relRoot}/packages/${core.packageName}`));
  }

  issues.push(...validateBootstrapCompositionImports(clientRoot.appRoot, cores, relRoot));
  issues.push(...validateCapabilitySdkImportBoundary(clientRoot.appRoot, relRoot));

  return issues;
}

function checkWorkspace(workspace) {
  const issues = [];
  for (const name of fs.readdirSync(workspace)) {
    if (!name.startsWith('sdkwork-') || SKIP_REPOS.has(name)) continue;
    const repoRoot = path.join(workspace, name);
    if (!fs.statSync(repoRoot).isDirectory()) continue;
    for (const clientRoot of listClientAppRoots(repoRoot)) {
      issues.push(...checkClientAppRoot(repoRoot, clientRoot));
    }
  }
  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      root: { type: 'string' },
      workspace: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(usage());
    return;
  }

  const issues = [];

  const root = path.resolve(values.root ?? SPECS_ROOT);
  issues.push(...checkSpecsRepo(root));

  if (values.workspace) {
    const workspace = path.resolve(values.workspace);
    if (fs.existsSync(workspace)) {
      issues.push(...checkWorkspace(workspace));
    } else {
      issues.push(`workspace path does not exist: ${workspace}`);
    }
  }

  if (issues.length > 0) fail(`found ${issues.length} issue(s)`, issues);
  console.log('dependency composition check passed');
}

main();
