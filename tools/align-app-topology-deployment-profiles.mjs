#!/usr/bin/env node
/**
 * Align SDKWork application topology for standalone + cloud deployment profiles.
 * See APP_RUNTIME_TOPOLOGY_SPEC.md, APP_RUNTIME_TOPOLOGY_NAMING.md, APPLICATION_GATEWAY_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'target', 'dist', 'artifacts', 'external', '.pnpm-store']);

const HOSTING_TO_PROFILE = {
  'self-hosted': 'standalone',
  'cloud-hosted': 'cloud',
};

function canonicalProfileIds(spec) {
  const profiles = spec.vocabulary?.deploymentProfile?.allowed ?? ['standalone', 'cloud'];
  const environments = spec.vocabulary?.environment?.allowed ?? ['development', 'production'];
  const ids = [];
  for (const deploymentProfile of profiles) {
    for (const environment of environments) {
      ids.push(`${deploymentProfile}.${environment}`);
    }
  }
  return ids;
}

function usage() {
  return [
    'Usage: node tools/align-app-topology-deployment-profiles.mjs [--workspace <path>] [--dry-run] [--repo <name>] [--bootstrap-missing]',
    '',
    'Migrates hosting vocabulary to deploymentProfile, renames profile env files,',
    'ensures standalone + cloud profileFiles/orchestration, and updates app manifests.',
  ].join('\n');
}

function walkRepos(workspace) {
  return fs
    .readdirSync(workspace, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('sdkwork-'))
    .map((entry) => path.join(workspace, entry.name));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value, dryRun) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (dryRun) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function migrateProfileId(profileId) {
  const parts = profileId.split('.');
  if (parts.length === 3) {
    const mapped = HOSTING_TO_PROFILE[parts[0]] ?? parts[0];
    return [mapped, parts[2]].join('.');
  }
  if (parts.length === 2) {
    const mapped = HOSTING_TO_PROFILE[parts[0]] ?? parts[0];
    return [mapped, parts[1]].join('.');
  }
  return profileId;
}

function migrateProfilePath(value, oldProfileId, newProfileId) {
  return value
    .replaceAll(oldProfileId, newProfileId)
    .replace(/self-hosted\.([a-z0-9-]+)\.([a-z0-9-]+)/gu, 'standalone.$2')
    .replace(/cloud-hosted\.([a-z0-9-]+)\.([a-z0-9-]+)/gu, 'cloud.$2')
    .replace(/standalone\.(?:unified-process|split-services)\.([a-z0-9-]+)/gu, 'standalone.$1')
    .replace(/cloud\.(?:unified-process|split-services)\.([a-z0-9-]+)/gu, 'cloud.$1')
    .replace(/self-hosted/g, 'standalone')
    .replace(/cloud-hosted/g, 'cloud');
}

function appPrefixFromSpec(spec) {
  if (spec.database?.appPrefix) return spec.database.appPrefix;
  const appId = spec.appId ?? 'sdkwork-app';
  const slug = appId.replace(/^sdkwork-/, '').replace(/-/g, '_').toUpperCase();
  return `SDKWORK_${slug}`;
}

function clientPrefixFromSpec(spec, appPrefix) {
  const existing = spec.envKeys?.clientDeploymentProfile;
  if (existing) {
    const match = /^([A-Z0-9_]+)_DEPLOYMENT_PROFILE$/.exec(existing);
    if (match) return match[1];
  }
  return `VITE_${appPrefix.replace(/^SDKWORK_/, 'SDKWORK_')}`;
}

function migrateEnvFileContent(content, spec, oldProfileId, newProfileId) {
  const appPrefix = appPrefixFromSpec(spec);
  const clientPrefix = clientPrefixFromSpec(spec, appPrefix);
  let out = content;
  out = out.replaceAll(oldProfileId, newProfileId);
  out = out.replaceAll('self-hosted', 'standalone');
  out = out.replaceAll('cloud-hosted', 'cloud');
  out = out.replace(/^\s*[A-Z0-9_]*SERVICE_LAYOUT=.*(?:\r?\n)?/gmu, '');
  out = out.replace(/^#.*(?:serviceLayout|service layout|unified-process|split-services).*(?:\r?\n)?/gimu, '');
  out = out.replace(
    new RegExp(`${appPrefix}_HOSTING=`, 'g'),
    `${appPrefix}_DEPLOYMENT_PROFILE=`,
  );
  out = out.replace(
    new RegExp(`${clientPrefix}_HOSTING=`, 'g'),
    `${clientPrefix}_DEPLOYMENT_PROFILE=`,
  );
  out = out.replace(/# .*self-hosted.*/gi, (line) =>
    line.replace(/self-hosted/gi, 'standalone').replace(/cloud-hosted/gi, 'cloud'),
  );
  return out;
}

function renameKeyObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const next = {};
  for (const [key, value] of Object.entries(obj)) {
    next[migrateProfileId(key)] = value;
  }
  return next;
}

function ensureDeploymentVocabulary(spec) {
  spec.schemaVersion = 4;
  spec.vocabulary ??= {};
  if (spec.vocabulary.serviceLayout) {
    delete spec.vocabulary.serviceLayout;
  }

  if (spec.vocabulary?.deploymentProfile?.allowed) {
    spec.vocabulary.deploymentProfile.allowed = ['standalone', 'cloud'];
    spec.profilePattern = '{deploymentProfile}.{environment}.env';
    return spec;
  }

  delete spec.vocabulary.hosting;
  spec.vocabulary.deploymentProfile = {
    allowed: ['standalone', 'cloud'],
  };
  spec.profilePattern = '{deploymentProfile}.{environment}.env';
  return spec;
}

function migrateEnvKeys(spec) {
  spec.envKeys ??= {};
  if (spec.envKeys.hosting && !spec.envKeys.deploymentProfile) {
    spec.retired ??= {};
    spec.retired.envKeys ??= [];
    spec.retired.envKeys.push(spec.envKeys.hosting);
    const hostingKey = spec.envKeys.hosting;
    spec.envKeys.deploymentProfile = hostingKey.replace(/_HOSTING$/, '_DEPLOYMENT_PROFILE');
    delete spec.envKeys.hosting;
  }
  if (spec.envKeys.clientHosting && !spec.envKeys.clientDeploymentProfile) {
    spec.retired ??= {};
    spec.retired.envKeys ??= [];
    spec.retired.envKeys.push(spec.envKeys.clientHosting);
    spec.envKeys.clientDeploymentProfile = spec.envKeys.clientHosting.replace(
      /_HOSTING$/,
      '_DEPLOYMENT_PROFILE',
    );
    delete spec.envKeys.clientHosting;
  }
  if (spec.envKeys.serviceLayout) {
    delete spec.envKeys.serviceLayout;
  }
  return spec;
}

function migrateDefaults(spec) {
  spec.defaults ??= {};
  for (const key of ['developmentProfileId', 'productionProfileId', 'desktopBuildProfileId']) {
    if (spec.defaults[key]) spec.defaults[key] = migrateProfileId(spec.defaults[key]);
  }
  if (!spec.defaults.productionProfileId?.startsWith('cloud.')) {
    spec.defaults.productionProfileId = 'cloud.production';
  }
  if (!spec.defaults.developmentProfileId?.startsWith('standalone.')) {
    spec.defaults.developmentProfileId = 'standalone.development';
  }
  if (!spec.defaults.desktopBuildProfileId?.startsWith('standalone.')) {
    spec.defaults.desktopBuildProfileId = 'standalone.production';
  }
  return spec;
}

function ensurePlatformSurface(spec) {
  const archetype = spec.archetype ?? 'application-http-gateway';
  if (archetype === 'application-rest-edge-device') return spec;
  spec.surfaces ??= {};
  const appPrefix = appPrefixFromSpec(spec);
  const clientPrefix = clientPrefixFromSpec(spec, appPrefix);
  if (!spec.surfaces['platform.api-gateway']) {
    spec.surfaces['platform.api-gateway'] = {
      connectivityPlane: 'platform',
      protocols: ['http'],
      owner: 'sdkwork-api-cloud-gateway',
      bindEnv: 'SDKWORK_API_CLOUD_GATEWAY_BIND',
      httpUrlEnv: `${appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
      clientHttpEnv: `${clientPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
      autostartEnv: `${appPrefix}_PLATFORM_API_GATEWAY_AUTOSTART`,
    };
  }
  spec.cloudPublicHosts ??= {};
  if (!spec.cloudPublicHosts['platform.api-gateway']) {
    spec.cloudPublicHosts['platform.api-gateway'] = { httpHost: 'api.sdkwork.com' };
  }
  return spec;
}

function ensureCloudGatewayComponent(spec) {
  spec.components ??= {};
  if (spec.components.cloudGateway) return spec;
  const appSlug = (spec.appId ?? 'app').replace(/^sdkwork-/, '');
  spec.components.cloudGateway = {
    crate: 'sdkwork-api-cloud-gateway',
    binary: 'sdkwork-api-cloud-gateway',
    repository: 'sdkwork-api-cloud-gateway',
    configGlob: `etc/sdkwork-api-cloud-gateway.${appSlug}.{profile}.toml`,
  };
  return spec;
}

function primaryApiProcess(spec) {
  const components = spec.components ?? {};
  const candidates = [
    components.applicationServer,
    components.appApiRouter,
    components.appApiService,
    components.edgeServer,
    components.standaloneGateway,
  ].filter(Boolean);
  if (candidates.length > 0) {
    const c = candidates[0];
    return { crate: c.crate, binary: c.binary ?? c.name };
  }
  return null;
}

function cloneOrchestrationForCloud(spec, standaloneProfileId, cloudProfileId) {
  const standalone = spec.orchestration?.profiles?.[standaloneProfileId];
  if (!standalone) return null;
  const processes = JSON.parse(JSON.stringify(standalone.processes ?? []));
  const hasPlatform = processes.some((p) => p.id === 'platform.api-gateway');
  if (!hasPlatform) {
    processes.unshift({
      id: 'platform.api-gateway',
      crate: 'sdkwork-api-cloud-gateway',
      binary: 'sdkwork-api-cloud-gateway',
      repository: 'sdkwork-api-cloud-gateway',
      required: false,
    });
  }
  const health = new Set(standalone.healthSurfaces ?? ['application.public-ingress']);
  health.add('platform.api-gateway');
  return { processes, healthSurfaces: [...health] };
}

function pruneOrchestrationProfiles(spec) {
  const profiles = spec.orchestration?.profiles;
  if (!profiles) return spec;
  for (const profileId of Object.keys(profiles)) {
    if (!spec.profileFiles?.[profileId]) {
      delete profiles[profileId];
    }
  }
  return spec;
}

function ensureOrchestrationProfiles(spec) {
  spec.orchestration ??= {};
  spec.orchestration.profiles ??= {};

  const standaloneDev = spec.orchestration.profiles['standalone.development'];
  const api = primaryApiProcess(spec);

  if (!standaloneDev && api) {
    const profileId = 'standalone.development';
    if (spec.profileFiles?.[profileId] || !spec.profileFiles || Object.keys(spec.profileFiles).length === 0) {
      spec.orchestration.profiles[profileId] = {
        processes: [
          { id: 'application.public-ingress', crate: api.crate, binary: api.binary, required: true },
        ],
        healthSurfaces: ['application.public-ingress'],
      };
    }
  }

  for (const profileId of canonicalProfileIds(spec)) {
    if (!spec.profileFiles?.[profileId]) continue;
    if (spec.orchestration.profiles[profileId]) continue;
    const [deploymentProfile, environment] = profileId.split('.');
    const sourceStandaloneId = spec.orchestration.profiles[`standalone.${environment}`]
      ? `standalone.${environment}`
      : 'standalone.development';
    if (deploymentProfile === 'cloud') {
      const cloned = cloneOrchestrationForCloud(spec, sourceStandaloneId, profileId);
      if (cloned) spec.orchestration.profiles[profileId] = cloned;
      continue;
    }
    if (deploymentProfile === 'standalone' && spec.orchestration.profiles['standalone.development']) {
      spec.orchestration.profiles[profileId] = JSON.parse(
        JSON.stringify(spec.orchestration.profiles['standalone.development']),
      );
    }
  }

  return pruneOrchestrationProfiles(spec);
}

function ensureProfileFiles(spec, repoRoot) {
  spec.profileFiles ??= {};
  const profileRoot = spec.profileRoot ?? 'etc/topology';
  const pattern = spec.profilePattern ?? '{deploymentProfile}.{environment}.env';

  for (const profileId of canonicalProfileIds(spec)) {
    const [deploymentProfile, environment] = profileId.split('.');
    const profiles = spec.vocabulary?.deploymentProfile?.allowed ?? ['standalone', 'cloud'];
    if (!profiles.includes(deploymentProfile)) continue;

    const relative = `${profileRoot}/${pattern
      .replaceAll('{deploymentProfile}', deploymentProfile)
      .replaceAll('{hosting}', deploymentProfile)
      .replaceAll('{environment}', environment)}`;

    if (!spec.profileFiles[profileId]) {
      spec.profileFiles[profileId] = relative;
    }
  }

  return spec;
}

function createMissingEnvFiles(spec, repoRoot, dryRun, actions) {
  const appPrefix = appPrefixFromSpec(spec);
  const templatePath = spec.profileFiles['standalone.development'];
  const templateAbs = templatePath ? path.join(repoRoot, templatePath) : null;
  const template = templateAbs && fs.existsSync(templateAbs) ? fs.readFileSync(templateAbs, 'utf8') : null;

  for (const [profileId, relativePath] of Object.entries(spec.profileFiles ?? {})) {
    const abs = path.join(repoRoot, relativePath);
    if (fs.existsSync(abs)) continue;

    let content;
    if (template) {
      content = migrateEnvFileContent(template, spec, 'standalone.development', profileId);
    } else {
      const [deploymentProfile, environment] = profileId.split('.');
      content = [
        `# ${profileId}`,
        `${appPrefix}_DEPLOYMENT_PROFILE=${deploymentProfile}`,
        `${appPrefix}_ENVIRONMENT=${environment}`,
        `${appPrefix}_PROFILE_ID=${profileId}`,
        '',
        `SDKWORK_API_CLOUD_GATEWAY_BIND=127.0.0.1:3900`,
        `${appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL=http://127.0.0.1:3900`,
        `${appPrefix}_PLATFORM_API_GATEWAY_AUTOSTART=${deploymentProfile === 'cloud' ? 'true' : 'false'}`,
        '',
      ].join('\n');
    }

    actions.push(`create env ${relativePath}`);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
    }
  }
}

function migrateEnvFilesOnDisk(spec, repoRoot, dryRun, actions) {
  const renames = [];
  for (const [profileId, relativePath] of Object.entries({ ...(spec.profileFiles ?? {}) })) {
    const newProfileId = migrateProfileId(profileId);
    const newRelative = migrateProfilePath(relativePath, profileId, newProfileId);
    const oldAbs = path.join(repoRoot, relativePath);
    const newAbs = path.join(repoRoot, newRelative);

    if (profileId !== newProfileId || relativePath !== newRelative) {
      spec.profileFiles[newProfileId] = newRelative;
      if (profileId !== newProfileId) delete spec.profileFiles[profileId];
    }

    if (fs.existsSync(oldAbs)) {
      let content = fs.readFileSync(oldAbs, 'utf8');
      content = migrateEnvFileContent(content, spec, profileId, newProfileId);
      if (oldAbs !== newAbs) {
        renames.push({ oldAbs, newAbs, content });
      } else if (content !== fs.readFileSync(oldAbs, 'utf8')) {
        actions.push(`update env ${newRelative}`);
        if (!dryRun) fs.writeFileSync(oldAbs, content, 'utf8');
      }
    }
  }

  for (const { oldAbs, newAbs, content } of renames) {
    actions.push(`rename env ${path.relative(repoRoot, oldAbs)} -> ${path.relative(repoRoot, newAbs)}`);
    if (dryRun) continue;
    fs.mkdirSync(path.dirname(newAbs), { recursive: true });
    fs.writeFileSync(newAbs, content, 'utf8');
    if (oldAbs !== newAbs && fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
  }
}

function migrateOrchestrationKeys(spec) {
  if (!spec.orchestration?.profiles) return spec;
  spec.orchestration.profiles = renameKeyObject(spec.orchestration.profiles);
  return spec;
}

function migrateProfileFilesKeys(spec) {
  if (!spec.profileFiles) return spec;
  spec.profileFiles = renameKeyObject(spec.profileFiles);
  for (const [profileId, relativePath] of Object.entries(spec.profileFiles)) {
    spec.profileFiles[profileId] = migrateProfilePath(relativePath, profileId, profileId);
  }
  return spec;
}

function updateAppConfig(repoRoot, dryRun, actions) {
  const manifestPath = path.join(repoRoot, 'sdkwork.app.config.json');
  if (!fs.existsSync(manifestPath)) return;
  const manifest = readJson(manifestPath);
  manifest.runtime ??= {};
  const current = manifest.runtime.supportedDeploymentProfiles ?? [];
  const next = [...new Set([...current, 'standalone', 'cloud'])];
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    manifest.runtime.supportedDeploymentProfiles = next;
    actions.push('update sdkwork.app.config.json supportedDeploymentProfiles');
    if (!dryRun) writeJson(manifestPath, manifest, false);
  }
}

function ensureRootAppConfig(repoRoot, meta, dryRun, actions) {
  const rootPath = path.join(repoRoot, 'sdkwork.app.config.json');
  if (fs.existsSync(rootPath)) return;

  let source = null;
  const appsDir = path.join(repoRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    for (const name of fs.readdirSync(appsDir, { withFileTypes: true })) {
      if (!name.isDirectory()) continue;
      const candidate = path.join(appsDir, name.name, 'sdkwork.app.config.json');
      if (fs.existsSync(candidate)) {
        source = readJson(candidate);
        break;
      }
    }
  }

  const manifest = source
    ? structuredClone(source)
    : {
        schemaVersion: 3,
        kind: 'sdkwork.app',
        app: { key: meta.appId, name: meta.appId },
        runtime: {},
      };
  manifest.app ??= {};
  manifest.app.key = meta.appId;
  manifest.runtime ??= {};
  manifest.runtime.supportedDeploymentProfiles = [
    ...new Set([...(manifest.runtime.supportedDeploymentProfiles ?? []), 'standalone', 'cloud']),
  ];
  if (!manifest.runtime.defaultDeploymentProfile) {
    manifest.runtime.defaultDeploymentProfile = 'cloud';
  }

  actions.push('create sdkwork.app.config.json at repository root');
  if (!dryRun) writeJson(rootPath, manifest, false);
}

function ensurePackageScripts(repoRoot, dryRun, actions) {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = readJson(pkgPath);
  pkg.scripts ??= {};
  const additions = {
    'topology:validate':
      'node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs validate --root . --spec specs/topology.spec.json',
  };
  if (fs.existsSync(path.join(repoRoot, 'scripts/gateway-cloud-bundle.mjs'))) {
    additions['gateway:package:cloud'] = 'node scripts/gateway-cloud-bundle.mjs bundle';
    additions['gateway:validate:cloud'] = 'node scripts/gateway-cloud-bundle.mjs validate';
  }
  for (const [key, value] of Object.entries(additions)) {
    if (pkg.scripts[key]) continue;
    pkg.scripts[key] = value;
    actions.push(`add package.json script ${key}`);
  }
  const scriptActions = actions.filter((a) => a.startsWith('add package.json'));
  if (!dryRun && scriptActions.length > 0) {
    writeJson(pkgPath, pkg, false);
  }
}

function deriveAppMeta(repoRoot) {
  const repoAppId = path.basename(repoRoot);
  if (!repoAppId.startsWith('sdkwork-')) return null;

  const rootManifestPath = path.join(repoRoot, 'sdkwork.app.config.json');
  let manifest = null;
  if (fs.existsSync(rootManifestPath)) {
    manifest = readJson(rootManifestPath);
  }

  const appId = repoAppId;
  const appPrefix = `SDKWORK_${appId.replace(/^sdkwork-/, '').replace(/-/g, '_').toUpperCase()}`;
  return { appId, appPrefix, manifest };
}

function findApiServer(repoRoot) {
  const cargoPath = path.join(repoRoot, 'Cargo.toml');
  if (!fs.existsSync(cargoPath)) return null;
  const members = [];
  const text = fs.readFileSync(cargoPath, 'utf8');
  for (const line of text.split('\n')) {
    const match = /^\s*"([^"]*api-server[^"]*)"/.exec(line);
    if (match) members.push(match[1]);
  }
  if (members.length === 0) return null;
  const member = members[0];
  const crateToml = path.join(repoRoot, member, 'Cargo.toml');
  if (!fs.existsSync(crateToml)) return { crate: path.basename(member) };
  const crateText = fs.readFileSync(crateToml, 'utf8');
  const nameMatch = /^name = "([^"]+)"/m.exec(crateText);
  const binMatch = /\[\[bin\]\][\s\S]*?name = "([^"]+)"/m.exec(crateText);
  return {
    crate: nameMatch?.[1] ?? path.basename(member),
    binary: binMatch?.[1] ?? nameMatch?.[1],
  };
}

function bootstrapTopology(repoRoot, dryRun, actions) {
  const specPath = path.join(repoRoot, 'specs/topology.spec.json');
  if (fs.existsSync(specPath)) return false;
  const meta = deriveAppMeta(repoRoot);
  const api = findApiServer(repoRoot);
  if (!meta || !api) return false;

  const appSlug = meta.appId.replace(/^sdkwork-/, '');
  const spec = {
    schemaVersion: 4,
    kind: 'sdkwork.app.topology',
    appId: meta.appId,
    archetype: 'application-http-gateway',
    profileRoot: 'etc/topology',
    profilePattern: '{deploymentProfile}.{environment}.env',
    vocabulary: {
      deploymentProfile: { allowed: ['standalone', 'cloud'] },
      environment: { allowed: ['development', 'production'] },
    },
    defaults: {
      developmentProfileId: 'standalone.development',
      productionProfileId: 'cloud.production',
      desktopBuildProfileId: 'standalone.production',
      gatewayBind: '127.0.0.1:8080',
    },
    profileFiles: {},
    envKeys: {
      deploymentProfile: `${meta.appPrefix}_DEPLOYMENT_PROFILE`,
      environment: `${meta.appPrefix}_ENVIRONMENT`,
      profileId: `${meta.appPrefix}_PROFILE_ID`,
      clientDeploymentProfile: `VITE_${meta.appPrefix}_DEPLOYMENT_PROFILE`,
      gatewayAutostart: `${meta.appPrefix}_PLATFORM_API_GATEWAY_AUTOSTART`,
      standaloneGatewayBind: `${meta.appPrefix}_APPLICATION_PUBLIC_INGRESS_BIND`,
      cloudGatewayBind: 'SDKWORK_API_CLOUD_GATEWAY_BIND',
      cloudGatewayConfig: 'SDKWORK_API_CLOUD_GATEWAY_CONFIG',
      clientApiGatewayBaseUrl: `VITE_${meta.appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
      apiGatewayBaseUrl: `${meta.appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
    },
    surfaces: {
      'application.public-ingress': {
        connectivityPlane: 'application',
        protocols: ['http'],
        bindEnv: `${meta.appPrefix}_APPLICATION_PUBLIC_INGRESS_BIND`,
        httpUrlEnv: `${meta.appPrefix}_APPLICATION_PUBLIC_HTTP_URL`,
        clientHttpEnv: `VITE_${meta.appPrefix}_APPLICATION_PUBLIC_HTTP_URL`,
      },
      'platform.api-gateway': {
        connectivityPlane: 'platform',
        protocols: ['http'],
        owner: 'sdkwork-api-cloud-gateway',
        bindEnv: 'SDKWORK_API_CLOUD_GATEWAY_BIND',
        httpUrlEnv: `${meta.appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
        clientHttpEnv: `VITE_${meta.appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
        autostartEnv: `${meta.appPrefix}_PLATFORM_API_GATEWAY_AUTOSTART`,
      },
    },
    cloudPublicHosts: {
      'application.public-ingress': { httpHost: `${appSlug}.sdkwork.com` },
      'platform.api-gateway': { httpHost: 'api.sdkwork.com' },
    },
    database: { appPrefix: meta.appPrefix },
    components: {
      applicationServer: { crate: api.crate, binary: api.binary },
      cloudGateway: {
        crate: 'sdkwork-api-cloud-gateway',
        binary: 'sdkwork-api-cloud-gateway',
        repository: 'sdkwork-api-cloud-gateway',
        configGlob: `etc/sdkwork-api-cloud-gateway.${appSlug}.{profile}.toml`,
      },
    },
    orchestration: { profiles: {} },
  };

  ensureProfileFiles(spec, repoRoot);
  ensureOrchestrationProfiles(spec);
  actions.push(`bootstrap specs/topology.spec.json for ${meta.appId}`);
  if (!dryRun) writeJson(specPath, spec, false);
  return spec;
}

function alignRepo(repoRoot, dryRun) {
  const actions = [];
  const specPath = path.join(repoRoot, 'specs/topology.spec.json');
  let spec = fs.existsSync(specPath) ? readJson(specPath) : bootstrapTopology(repoRoot, dryRun, actions);
  if (!spec) return actions;

  spec = ensureDeploymentVocabulary(spec);
  spec = migrateEnvKeys(spec);
  spec = migrateDefaults(spec);
  migrateEnvFilesOnDisk(spec, repoRoot, dryRun, actions);
  spec = migrateProfileFilesKeys(spec);
  spec = migrateOrchestrationKeys(spec);
  spec = ensurePlatformSurface(spec);
  spec = ensureCloudGatewayComponent(spec);
  spec = ensureProfileFiles(spec, repoRoot);
  spec = ensureOrchestrationProfiles(spec);

  createMissingEnvFiles(spec, repoRoot, dryRun, actions);
  const meta = deriveAppMeta(repoRoot);
  if (meta) ensureRootAppConfig(repoRoot, meta, dryRun, actions);
  updateAppConfig(repoRoot, dryRun, actions);
  ensurePackageScripts(repoRoot, dryRun, actions);

  actions.push('write specs/topology.spec.json');
  if (!dryRun) writeJson(specPath, spec, false);
  return actions;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      'dry-run': { type: 'boolean', default: false },
      repo: { type: 'string' },
      'bootstrap-missing': { type: 'boolean', default: true },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(usage());
    return;
  }

  const workspace = path.resolve(values.workspace);
  const dryRun = values['dry-run'];
  const repos = values.repo
    ? [path.join(workspace, values.repo)]
    : walkRepos(workspace).filter((repo) => {
        const name = path.basename(repo);
        if (name === 'sdkwork-api-cloud-gateway' || name === 'sdkwork-app-topology' || name === 'sdkwork-specs') {
          return false;
        }
        const hasTopology = fs.existsSync(path.join(repo, 'specs/topology.spec.json'));
        if (hasTopology) return true;
        if (!values['bootstrap-missing']) return false;
        return (
          fs.existsSync(path.join(repo, 'sdkwork.app.config.json')) &&
          fs.existsSync(path.join(repo, 'Cargo.toml'))
        );
      });

  let totalActions = 0;
  for (const repoRoot of repos) {
    const name = path.basename(repoRoot);
    const actions = alignRepo(repoRoot, dryRun);
    if (actions.length === 0) continue;
    console.log(`\n${name}${dryRun ? ' (dry-run)' : ''}:`);
    for (const action of actions) console.log(`  - ${action}`);
    totalActions += actions.length;
  }
  console.log(`\nTotal actions: ${totalActions}`);
}

main();
