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
const LOCAL_CLOUD_PROCESS_PATTERN = /(?:api(?:-server)?|gateway|public-ingress|database|postgres|redis|migrat|seed)/iu;
const PROCESS_ROLES = new Set([
  'client', 'standalone-gateway', 'application-cloud-gateway',
  'platform-gateway', 'api-listener', 'database', 'redis', 'migration',
  'seed', 'worker', 'tunnel',
]);

function readEnv(file) {
  const values = new Map();
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line);
    if (!match) continue;
    values.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/u, '$2'));
  }
  return values;
}

function isLoopbackUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1';
  } catch {
    return false;
  }
}

function isPlaceholderUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname.endsWith('.example')
      || hostname.endsWith('.invalid')
      || hostname === 'example.com'
      || hostname.endsWith('.example.com');
  } catch {
    return true;
  }
}

function normalizedOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

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
  if (![4, 5].includes(spec.schemaVersion)) {
    issues.push(`${rel}: schemaVersion must be 4 (migration) or 5 (current)`);
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

  if (spec.schemaVersion === 5 && profiles.includes('cloud')) {
    const cloudIngress = spec.cloudIngress;
    if (!cloudIngress || typeof cloudIngress !== 'object') {
      issues.push(`${rel}: schema v5 cloud topology requires cloudIngress`);
    } else {
      const strategies = ['platform-collapsed', 'dedicated-application', 'edge-split'];
      if (!strategies.includes(cloudIngress.strategy)) {
        issues.push(`${rel}: cloudIngress.strategy must be ${strategies.join(', ')}`);
      }
      if (cloudIngress.platformGateway !== 'sdkwork-api-cloud-gateway') {
        issues.push(`${rel}: cloudIngress.platformGateway must be sdkwork-api-cloud-gateway`);
      }
      if (cloudIngress.strategy === 'platform-collapsed' && cloudIngress.applicationGateway) {
        issues.push(`${rel}: platform-collapsed cloud ingress forbids applicationGateway`);
      }
      if (cloudIngress.strategy === 'dedicated-application'
        && (!cloudIngress.applicationGateway || !cloudIngress.decisionRef)) {
        issues.push(`${rel}: dedicated-application requires applicationGateway and decisionRef`);
      }
      if (cloudIngress.strategy === 'edge-split'
        && (!cloudIngress.edgeGateway || !cloudIngress.decisionRef)) {
        issues.push(`${rel}: edge-split requires edgeGateway and decisionRef`);
      }
      if (cloudIngress.strategy === 'edge-split' && cloudIngress.edgeGateway === 'sdkwork-api-cloud-gateway') {
        issues.push(`${rel}: edge-split edgeGateway must be an application/edge gateway, not the platform gateway`);
      }
    }
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

  const cloudDev = spec.orchestration?.profiles?.['cloud.development'];
  if (!cloudDev) {
    issues.push(`${rel}: missing cloud.development orchestration profile`);
  } else {
    if (spec.schemaVersion === 5) {
      for (const process of cloudDev.processes ?? []) {
        if (PROCESS_ROLES.has(process.role) && !['client', 'tunnel'].includes(process.role)) {
          issues.push(`${rel}: cloud.development forbids local process role ${process.role}`);
        }
      }
    }
    const localProcesses = spec.schemaVersion === 5
      ? []
      : (cloudDev.processes ?? []).filter((process) => {
      const id = String(process.id ?? process.name ?? process.binary ?? '');
      const explicitTunnel = /(?:tunnel|proxy)/iu.test(id) && !LOCAL_CLOUD_PROCESS_PATTERN.test(id.replace(/(?:tunnel|proxy)/giu, ''));
      return !explicitTunnel && LOCAL_CLOUD_PROCESS_PATTERN.test(id);
      });
    for (const process of localProcesses) {
      const id = process.id ?? process.name ?? process.binary ?? '<unknown>';
      issues.push(`${rel}: cloud.development must not autostart local API/dependency process ${id}`);
    }
  }

  if (spec.schemaVersion === 5) {
    for (const [profileId, orchestration] of Object.entries(spec.orchestration?.profiles ?? {})) {
      for (const process of orchestration.processes ?? []) {
        if (!PROCESS_ROLES.has(process.role)) {
          issues.push(`${rel}: ${profileId} process ${process.id ?? '<unknown>'} requires a canonical role`);
        }
      }
    }
    const standaloneDev = spec.orchestration?.profiles?.['standalone.development'];
    if (standaloneDev && spec.surfaces?.['application.public-ingress']) {
      const gatewayCount = (standaloneDev.processes ?? [])
        .filter((process) => process.role === 'standalone-gateway').length;
      if (gatewayCount !== 1) {
        issues.push(`${rel}: standalone.development requires exactly one standalone-gateway role; found ${gatewayCount}`);
      }
    }
  }

  const cloudDevPath = spec.profileFiles?.['cloud.development'];
  if (cloudDevPath && fs.existsSync(path.join(repoRoot, cloudDevPath))) {
    const cloudDevEnv = readEnv(path.join(repoRoot, cloudDevPath));
    const requiredSurfaceIds = ['application.public-ingress', 'platform.api-gateway']
      .filter((surfaceId) => spec.surfaces?.[surfaceId]);
    const hasExplicitTunnel = (cloudDev?.processes ?? []).some((process) =>
      /(?:tunnel|proxy)/iu.test(String(process.id ?? process.name ?? process.binary ?? '')),
    );
    for (const surfaceId of requiredSurfaceIds) {
      const surface = spec.surfaces[surfaceId];
      if (!surface.httpUrlEnv) {
        issues.push(`${rel}: ${surfaceId} must declare httpUrlEnv for cloud.development`);
        continue;
      }
      const value = cloudDevEnv.get(surface.httpUrlEnv);
      if (!value) {
        issues.push(`${rel}: cloud.development missing explicit ${surface.httpUrlEnv} for ${surfaceId}`);
        continue;
      }
      if (isPlaceholderUrl(value)) {
        issues.push(`${rel}: cloud.development ${surface.httpUrlEnv} must be a concrete deployed URL, not a placeholder`);
      }
      if (isLoopbackUrl(value) && !hasExplicitTunnel) {
        issues.push(`${rel}: cloud.development ${surface.httpUrlEnv} must not use loopback without an explicit tunnel/proxy process`);
      }
      if (surface.autostartEnv && /^(?:1|true|yes|on)$/iu.test(cloudDevEnv.get(surface.autostartEnv) ?? '')) {
        issues.push(`${rel}: cloud.development ${surface.autostartEnv} must disable remote surface autostart`);
      }
    }
    if (spec.schemaVersion === 5 && spec.cloudIngress?.strategy === 'platform-collapsed') {
      const application = spec.surfaces?.['application.public-ingress'];
      const platform = spec.surfaces?.['platform.api-gateway'];
      const applicationUrl = application?.httpUrlEnv ? cloudDevEnv.get(application.httpUrlEnv) : null;
      const platformUrl = platform?.httpUrlEnv ? cloudDevEnv.get(platform.httpUrlEnv) : null;
      if (applicationUrl && platformUrl && normalizedOrigin(applicationUrl) !== normalizedOrigin(platformUrl)) {
        issues.push(`${rel}: platform-collapsed cloud surfaces must use the same URL origin`);
      }
    }
  }

  if (spec.surfaces?.['platform.api-gateway']) {
    const slugMatch = /sdkwork-api-cloud-gateway\.([^.]+)\.\{profile\}/.exec(
      spec.components?.cloudGateway?.configGlob ?? '',
    );
    const slug = slugMatch?.[1] ?? (spec.appId ?? '').replace(/^sdkwork-/, '');
    const devConfig = path.join(repoRoot, 'etc', `sdkwork-api-cloud-gateway.${slug}.development.toml`);
    const prodConfig = path.join(repoRoot, 'etc', `sdkwork-api-cloud-gateway.${slug}.production.toml`);
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
