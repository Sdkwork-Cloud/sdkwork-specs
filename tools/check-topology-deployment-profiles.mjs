#!/usr/bin/env node
/**
 * Verify standalone + cloud deployment profile coverage in application topology specs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');
const RETIRED_PROFILE_TOKENS = new Set(['unified-process', 'split-services']);

function requiredProfiles(spec) {
  const profiles = spec.vocabulary?.deploymentProfile?.allowed ?? ['standalone', 'cloud'];
  const environments = spec.vocabulary?.environment?.allowed ?? ['development', 'production'];
  const required = [];
  if (profiles.includes('standalone') && environments.includes('development')) {
    required.push('standalone.development');
  }
  if (profiles.includes('cloud')) {
    if (environments.includes('production')) {
      required.push('cloud.production');
    }
    if (environments.includes('development')) {
      required.push('cloud.development');
    }
  }
  return required;
}

function fail(message, details = []) {
  console.error(`topology deployment profile check failed: ${message}`);
  for (const detail of details) console.error(`- ${detail}`);
  process.exit(1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hasRetiredProfileToken(value) {
  return String(value)
    .split('.')
    .some((part) => RETIRED_PROFILE_TOKENS.has(part));
}

function pushProfileIdIssues(profileId, rel, issues) {
  if (hasRetiredProfileToken(profileId)) {
    issues.push(`${rel}: retired profile id ${profileId}; use <deploymentProfile>.<environment>`);
    return;
  }
  const parts = profileId.split('.');
  if (parts.length !== 2) {
    issues.push(`${rel}: profile id ${profileId} must use <deploymentProfile>.<environment>`);
    return;
  }
  const [deploymentProfile, environment] = parts;
  if (!['standalone', 'cloud'].includes(deploymentProfile)) {
    issues.push(`${rel}: profile id ${profileId} uses invalid deployment profile ${deploymentProfile}`);
  }
  if (!environment) {
    issues.push(`${rel}: profile id ${profileId} is missing environment segment`);
  }
}

function pushRetiredTopologyIssues(spec, rel, issues) {
  if (spec.vocabulary?.serviceLayout) {
    issues.push(`${rel}: retired vocabulary.serviceLayout is not allowed`);
  }
  if (String(spec.profilePattern ?? '').includes('serviceLayout')) {
    issues.push(`${rel}: profilePattern must not contain retired serviceLayout`);
  }
  if (spec.envKeys?.serviceLayout) {
    issues.push(`${rel}: envKeys.serviceLayout is retired and must be removed`);
  }
  for (const [key, value] of Object.entries(spec.defaults ?? {})) {
    if (typeof value === 'string' && hasRetiredProfileToken(value)) {
      issues.push(`${rel}: defaults.${key} uses retired profile id ${value}`);
    }
  }
}

function checkSpec(repoRoot, specPath) {
  const issues = [];
  const rel = path.relative(repoRoot, specPath);
  const spec = readJson(specPath);
  if (spec.schemaVersion !== 4) {
    issues.push(`${rel}: schemaVersion must be 4 for standalone/cloud two-segment topology profiles`);
  }
  pushRetiredTopologyIssues(spec, rel, issues);

  const profiles =
    spec.vocabulary?.deploymentProfile?.allowed ?? spec.vocabulary?.hosting?.allowed ?? [];
  if (!profiles.includes('standalone') && !profiles.includes('self-hosted')) {
    issues.push(`${rel}: missing standalone/self-hosted deployment profile in vocabulary`);
  }
  if (!profiles.includes('cloud') && !profiles.includes('cloud-hosted')) {
    issues.push(`${rel}: missing cloud/cloud-hosted deployment profile in vocabulary`);
  }
  if (spec.vocabulary?.hosting && !spec.vocabulary?.deploymentProfile) {
    issues.push(`${rel}: retired vocabulary.hosting still active; run align-app-topology-deployment-profiles.mjs`);
  }
  if (profiles.includes('self-hosted') || profiles.includes('cloud-hosted')) {
    issues.push(`${rel}: retired hosting deployment values remain in vocabulary`);
  }

  for (const profileId of Object.keys(spec.profileFiles ?? {})) {
    pushProfileIdIssues(profileId, rel, issues);
  }
  for (const profileId of Object.keys(spec.orchestration?.profiles ?? {})) {
    pushProfileIdIssues(profileId, rel, issues);
  }

  for (const profileId of requiredProfiles(spec)) {
    if (!spec.profileFiles?.[profileId]) {
      issues.push(`${rel}: missing profileFiles entry for ${profileId}`);
    } else {
      const envPath = path.join(repoRoot, spec.profileFiles[profileId]);
      if (!fs.existsSync(envPath)) {
        issues.push(`${rel}: missing env file ${spec.profileFiles[profileId]}`);
      }
    }
  }

  if (spec.surfaces?.['platform.api-gateway']) {
    const slugMatch = /sdkwork-api-cloud-gateway\.([^.]+)\.\{profile\}/.exec(
      spec.components?.cloudGateway?.configGlob ?? '',
    );
    const slug = slugMatch?.[1] ?? (spec.appId ?? '').replace(/^sdkwork-/, '');
    const devConfig = path.join(repoRoot, 'configs', `sdkwork-api-cloud-gateway.${slug}.development.toml`);
    const prodConfig = path.join(repoRoot, 'configs', `sdkwork-api-cloud-gateway.${slug}.production.toml`);
    if (!fs.existsSync(devConfig)) {
      issues.push(`${rel}: missing cloud gateway config ${path.relative(repoRoot, devConfig)}`);
    }
    if (!fs.existsSync(prodConfig)) {
      issues.push(`${rel}: missing cloud gateway config ${path.relative(repoRoot, prodConfig)}`);
    }
    const pkgPath = path.join(repoRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts ?? {};
    if (!scripts['gateway:package:cloud'] && !scripts['gateway:validate:cloud'] &&
        !scripts['gateway:package:platform-config'] && !scripts['gateway:validate:platform-config']) {
      issues.push(`${rel}: missing gateway cloud packaging script`);
    }
    }
  }

  const orch = spec.orchestration?.profiles ?? {};
  const hasStandaloneOrch = Object.keys(orch).some((id) => id.startsWith('standalone.'));
  const hasCloudOrch = Object.keys(orch).some((id) => id.startsWith('cloud.'));
  if (!hasStandaloneOrch) issues.push(`${rel}: missing standalone orchestration profile`);
  if (!hasCloudOrch) issues.push(`${rel}: missing cloud orchestration profile`);

  if (
    (spec.archetype === 'application-http-gateway' ||
      spec.archetype === 'realtime-application-platform') &&
    !spec.surfaces?.['platform.api-gateway']
  ) {
    issues.push(`${rel}: missing platform.api-gateway surface`);
  }

  return issues;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      repo: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/check-topology-deployment-profiles.mjs [--workspace <path>] [--repo <name>]');
    return;
  }

  const workspace = path.resolve(values.workspace);
  const repos = values.repo
    ? [path.join(workspace, values.repo)]
    : fs
        .readdirSync(workspace)
        .filter((name) => name.startsWith('sdkwork-'))
        .map((name) => path.join(workspace, name))
        .filter(
          (repo) => fs.existsSync(path.join(repo, 'specs/topology.spec.json')),
        );

  const allIssues = [];
  for (const repoRoot of repos) {
    const name = path.basename(repoRoot);
    if (name === 'sdkwork-deployments' || name === 'sdkwork-api-cloud-gateway') continue;
    allIssues.push(...checkSpec(repoRoot, path.join(repoRoot, 'specs/topology.spec.json')));
  }

  if (allIssues.length > 0) fail(`found ${allIssues.length} issue(s)`, allIssues);
  console.log(`topology deployment profile check passed (${repos.length} repositories scanned)`);
}

main();
