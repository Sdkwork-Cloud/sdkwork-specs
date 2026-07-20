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

function isDeclaredLibraryOnlyLegacyTopology(spec) {
  if (Number(spec?.schemaVersion ?? 0) >= 5) return false;
  if (!/\bdomain library\b/iu.test(String(spec?.retired?.notes ?? ''))) return false;
  const components = Object.values(spec?.components ?? {});
  const hasLibraryComponent = components.some((component) => Boolean(component?.library));
  const hasApplicationBinary = components.some((component) => (
    Boolean(component?.binary) && component.binary !== 'sdkwork-api-cloud-gateway'
  ));
  const standaloneProcesses = Object.entries(spec?.orchestration?.profiles ?? {})
    .filter(([profileId]) => profileId.startsWith('standalone.'))
    .flatMap(([, profile]) => profile?.processes ?? []);
  return hasLibraryComponent && !hasApplicationBinary && standaloneProcesses.length === 0;
}

function replaceEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}=.*$`, 'mu');
  if (pattern.test(content)) return content.replace(pattern, line);
  return `${content.trimEnd()}\n${line}\n`;
}

function alignRemoteEnvValue(content, key, fallbackValue) {
  const pattern = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}=(.*)$`, 'mu');
  const current = pattern.exec(content)?.[1]?.trim();
  if (current) {
    try {
      const url = new URL(current);
      if (
        !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)
        && !url.hostname.endsWith('.example')
      ) {
        return content;
      }
    } catch {
      // Invalid and placeholder values are replaced by the contract-derived fallback.
    }
  }
  return replaceEnvValue(content, key, fallbackValue);
}

function cloudSurfaceUrl(spec, surfaceId) {
  const host = String(spec.cloudPublicHosts?.[surfaceId]?.httpHost ?? '').trim();
  return host ? `https://${host}` : null;
}

function alignCloudDevelopmentEnv(spec, repoRoot, dryRun, actions) {
  const relativePath = spec.profileFiles?.['cloud.development'];
  if (!relativePath) return;
  const abs = path.join(repoRoot, relativePath);
  if (!fs.existsSync(abs)) return;

  let content = fs.readFileSync(abs, 'utf8');
  const original = content;
  for (const surfaceId of Object.keys(spec.surfaces ?? {})) {
    const surface = spec.surfaces?.[surfaceId];
    const url = cloudSurfaceUrl(spec, surfaceId);
    if (!surface || !url) continue;
    if (surface.httpUrlEnv) content = alignRemoteEnvValue(content, surface.httpUrlEnv, url);
    if (surface.clientHttpEnv) content = alignRemoteEnvValue(content, surface.clientHttpEnv, url);
    if (surface.autostartEnv) content = replaceEnvValue(content, surface.autostartEnv, 'false');
  }

  if (content === original) return;
  actions.push(`align ${relativePath} remote cloud URLs`);
  if (!dryRun) fs.writeFileSync(abs, content, 'utf8');
}

function loopbackUrlFromBind(bind) {
  const value = String(bind ?? '').trim();
  const match = /^(?:\[?[^\]]+\]?):(\d+)$/u.exec(value);
  return match ? `http://127.0.0.1:${match[1]}` : null;
}

function alignStandaloneDevelopmentEnv(spec, repoRoot, dryRun, actions) {
  const relativePath = spec.profileFiles?.['standalone.development'];
  if (!relativePath) return;
  const abs = path.join(repoRoot, relativePath);
  if (!fs.existsSync(abs)) return;
  let content = fs.readFileSync(abs, 'utf8');
  const original = content;
  const env = new Map();
  for (const line of content.split(/\r?\n/u)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u.exec(line.trim());
    if (match) env.set(match[1], match[2].trim());
  }
  const healthSurfaces = spec.orchestration?.profiles?.['standalone.development']?.healthSurfaces ?? [];
  for (const surfaceId of healthSurfaces) {
    const surface = spec.surfaces?.[surfaceId];
    if (!surface?.protocols?.includes('http') || !surface.httpUrlEnv) continue;
    if (env.get(surface.httpUrlEnv)) continue;
    const bind = (surface.bindEnv ? env.get(surface.bindEnv) : null)
      ?? (surfaceId === 'application.public-ingress' ? spec.defaults?.gatewayBind : null);
    const url = loopbackUrlFromBind(bind);
    if (!url) continue;
    if (surface.bindEnv && !env.get(surface.bindEnv)) {
      content = replaceEnvValue(content, surface.bindEnv, bind);
      env.set(surface.bindEnv, bind);
    }
    content = replaceEnvValue(content, surface.httpUrlEnv, url);
    env.set(surface.httpUrlEnv, url);
    if (surface.clientHttpEnv && !env.get(surface.clientHttpEnv)) {
      content = replaceEnvValue(content, surface.clientHttpEnv, url);
      env.set(surface.clientHttpEnv, url);
    }
  }
  if (content === original) return;
  actions.push(`align ${relativePath} standalone health URLs`);
  if (!dryRun) fs.writeFileSync(abs, content, 'utf8');
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
  let out = content.replace(/\r\n?/gu, '\n');
  out = out.replaceAll(oldProfileId, newProfileId);
  out = out.replaceAll('self-hosted', 'standalone');
  out = out.replaceAll('cloud-hosted', 'cloud');
  out = out.replace(/^\s*[A-Z0-9_]*SERVICE_LAYOUT=.*(?:\r?\n)?/gmu, '');
  out = out.replace(/^\s*SDKWORK_API_CLOUD_GATEWAY_(?:BIND|CONFIG)=.*(?:\r?\n)?/gmu, '');
  out = out.replace(/^\s*[A-Z0-9_]+_PLATFORM_API_GATEWAY_AUTOSTART=.*(?:\r?\n)?/gmu, '');
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

function inferProcessRole(process) {
  const identity = [
    process.id,
    process.name,
    process.crate,
    process.binary,
    process.command,
    process.package,
    process.script,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/standalone-gateway/u.test(identity)) return 'api-standalone-gateway';
  if (/migrat/u.test(identity)) return 'migration';
  if (/seed/u.test(identity)) return 'seed';
  if (/postgres|database/u.test(identity)) return 'database';
  if (/redis/u.test(identity)) return 'redis';
  if (/tunnel|local-proxy/u.test(identity)) return 'tunnel';
  if (/api-server|api-listener|public-ingress/u.test(identity)) return 'api-standalone-gateway';
  if (/runtime-node/u.test(identity)) return 'worker';
  if (/vite|renderer|desktop|browser|\bh5\b|flutter|android|ios|harmony|mini-program/u.test(identity)) return 'client';
  if (/worker/u.test(identity)) return 'worker';
  return undefined;
}

function normalizeProcessInvocation(process) {
  if (typeof process.command !== 'string' || process.args) return process;
  const cargoRun = /^cargo\s+run\s+-p\s+(\S+)(?:\s+--bin\s+(\S+))?$/u.exec(
    process.command.trim(),
  );
  if (!cargoRun) return process;
  process.crate = cargoRun[1];
  if (cargoRun[2]) process.binary = cargoRun[2];
  delete process.command;
  return process;
}

function ensureDeploymentVocabulary(spec) {
  spec.schemaVersion = 5;
  spec.vocabulary ??= {};
  if (spec.vocabulary.serviceLayout) {
    delete spec.vocabulary.serviceLayout;
  }

  if (spec.vocabulary?.deploymentProfile?.allowed) {
    spec.vocabulary.deploymentProfile.allowed = ['standalone', 'cloud'];
    spec.profilePattern = '{deploymentProfile}.{environment}.env';
  } else {
    delete spec.vocabulary.hosting;
    spec.vocabulary.deploymentProfile = {
      allowed: ['standalone', 'cloud'],
    };
  }
  delete spec.cloudIngress;
  for (const orchestration of Object.values(spec.orchestration?.profiles ?? {})) {
    for (const process of orchestration.processes ?? []) {
      normalizeProcessInvocation(process);
      if (process.role === 'standalone-gateway' || process.role === 'api-listener') {
        process.role = 'api-standalone-gateway';
      }
      const inferredRole = inferProcessRole(process);
      if (!process.role && inferredRole) process.role = inferredRole;
    }
  }
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
      httpUrlEnv: `${appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
      clientHttpEnv: `${clientPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
    };
  }
  const platformSurface = spec.surfaces['platform.api-gateway'];
  delete platformSurface.owner;
  delete platformSurface.bindEnv;
  delete platformSurface.autostartEnv;
  spec.cloudPublicHosts ??= {};
  if (!spec.cloudPublicHosts['platform.api-gateway']) {
    spec.cloudPublicHosts['platform.api-gateway'] = { httpHost: 'api.sdkwork.com' };
  }
  return spec;
}

function ensurePublicIngressCloudHost(spec) {
  if (!spec.surfaces?.['application.public-ingress']) return spec;

  if (spec.cloudPublicHosts?.['application.public-ingress']?.httpHost) return spec;

  const preferredSurfaceIds = [
    'application.app-http',
    'application.open-http',
    'application.web',
  ];
  const candidateSurfaceId = preferredSurfaceIds.find(
    (surfaceId) => spec.cloudPublicHosts?.[surfaceId]?.httpHost,
  ) ?? Object.keys(spec.cloudPublicHosts ?? {}).find((surfaceId) => (
    surfaceId.startsWith('application.')
    && !/(?:admin|backend|internal)/iu.test(surfaceId)
    && spec.cloudPublicHosts?.[surfaceId]?.httpHost
  ));
  if (!candidateSurfaceId) return spec;

  spec.cloudPublicHosts['application.public-ingress'] = {
    httpHost: spec.cloudPublicHosts[candidateSurfaceId].httpHost,
  };
  return spec;
}

function removeApplicationCloudGatewayImplementation(spec) {
  spec.components ??= {};
  delete spec.components.cloudGateway;
  delete spec.envKeys?.gatewayAutostart;
  delete spec.envKeys?.cloudGatewayBind;
  delete spec.envKeys?.cloudGatewayConfig;
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
  const processes = JSON.parse(JSON.stringify(standalone.processes ?? []))
    .filter((process) => process.role === 'client' || process.role === 'tunnel');
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

  if (spec.profileFiles?.['cloud.development']) {
    const current = spec.orchestration.profiles['cloud.development'] ?? {};
    const localClientOrTunnelProcesses = (current.processes ?? []).filter((process) => {
      if (process.role === 'client' || process.role === 'tunnel') return true;
      const id = String(process.id ?? process.name ?? process.binary ?? '');
      return /(?:client|browser|desktop|vite|tunnel|proxy)/iu.test(id)
        && !/(?:api(?:-server)?|gateway|public-ingress|database|postgres|redis|migrat|seed)/iu.test(id);
    });
    const healthSurfaces = ['application.public-ingress', 'platform.api-gateway']
      .filter((surfaceId) => spec.surfaces?.[surfaceId]);
    spec.orchestration.profiles['cloud.development'] = {
      ...current,
      processes: localClientOrTunnelProcesses,
      healthSurfaces,
    };
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

  const standaloneDevelopment = spec.orchestration.profiles['standalone.development'];
  if (spec.surfaces?.['application.public-ingress'] && standaloneDevelopment) {
    const processes = standaloneDevelopment.processes ?? [];
    const standaloneGateways = processes.filter(
      (process) => process.role === 'api-standalone-gateway',
    );
    const publicIngressProcesses = processes.filter(
      (process) => process.id === 'application.public-ingress',
    );
    const requiredProcesses = processes.filter((process) => process.required === true);
    const ingressCandidates = publicIngressProcesses.length > 0
      ? publicIngressProcesses
      : requiredProcesses.length === 1
        ? requiredProcesses
        : processes.length === 1
          ? processes
          : [];
    if (standaloneGateways.length === 0 && ingressCandidates.length === 1) {
      ingressCandidates[0].role = 'api-standalone-gateway';
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
    if (profileId === 'cloud.development') {
      const lines = [
        '# cloud.development - configure deployed development API URLs before use',
        `${appPrefix}_DEPLOYMENT_PROFILE=cloud`,
        `${appPrefix}_ENVIRONMENT=development`,
        `${appPrefix}_PROFILE_ID=cloud.development`,
        '',
      ];
      for (const surfaceId of ['application.public-ingress', 'platform.api-gateway']) {
        const surface = spec.surfaces?.[surfaceId];
        if (!surface) continue;
        if (surface.httpUrlEnv) lines.push(`${surface.httpUrlEnv}=`);
        if (surface.clientHttpEnv) lines.push(`${surface.clientHttpEnv}=`);
        if (surface.autostartEnv) lines.push(`${surface.autostartEnv}=false`);
      }
      lines.push('');
      content = lines.join('\n');
    } else if (template) {
      content = migrateEnvFileContent(template, spec, 'standalone.development', profileId);
    } else {
      const [deploymentProfile, environment] = profileId.split('.');
      content = [
        `# ${profileId}`,
        `${appPrefix}_DEPLOYMENT_PROFILE=${deploymentProfile}`,
        `${appPrefix}_ENVIRONMENT=${environment}`,
        `${appPrefix}_PROFILE_ID=${profileId}`,
        '',
        `${appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL=http://127.0.0.1:3900`,
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
  const dispatcherExists = fs.existsSync(path.join(repoRoot, 'scripts/sdkwork-command.mjs'));
  if (pkg.scripts.dev && dispatcherExists) {
    additions['dev:standalone'] =
      'node scripts/sdkwork-command.mjs dev --deployment-profile standalone --environment development';
    additions['dev:cloud'] =
      'node scripts/sdkwork-command.mjs dev --deployment-profile cloud --environment development';
    if (pkg.scripts.dev !== 'pnpm dev:standalone') {
      pkg.scripts.dev = 'pnpm dev:standalone';
      actions.push('delegate package.json script dev to dev:standalone');
    }
  }
  for (const [key, value] of Object.entries(additions)) {
    if (pkg.scripts[key]) continue;
    pkg.scripts[key] = value;
    actions.push(`add package.json script ${key}`);
  }
  const scriptActions = actions.filter((a) => a.startsWith('add package.json'));
  const devDelegated = actions.includes('delegate package.json script dev to dev:standalone');
  if (!dryRun && (scriptActions.length > 0 || devDelegated)) {
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
    const match = /^\s*"([^"]*(?:api-server|standalone-gateway)[^"]*)"/.exec(line);
    if (match) members.push(match[1]);
  }
  if (members.length !== 1) return null;
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
    schemaVersion: 5,
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
      standaloneGatewayBind: `${meta.appPrefix}_APPLICATION_PUBLIC_INGRESS_BIND`,
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
        httpUrlEnv: `${meta.appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
        clientHttpEnv: `VITE_${meta.appPrefix}_PLATFORM_API_GATEWAY_HTTP_URL`,
      },
    },
    cloudPublicHosts: {
      'application.public-ingress': { httpHost: `${appSlug}.sdkwork.com` },
      'platform.api-gateway': { httpHost: 'api.sdkwork.com' },
    },
    database: { appPrefix: meta.appPrefix },
    components: {
      applicationServer: { crate: api.crate, binary: api.binary },
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
  const originalSpecText = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : null;
  let spec = fs.existsSync(specPath) ? readJson(specPath) : bootstrapTopology(repoRoot, dryRun, actions);
  if (!spec) return actions;
  if (isDeclaredLibraryOnlyLegacyTopology(spec)) return actions;

  spec = ensureDeploymentVocabulary(spec);
  spec = migrateEnvKeys(spec);
  spec = migrateDefaults(spec);
  migrateEnvFilesOnDisk(spec, repoRoot, dryRun, actions);
  spec = migrateProfileFilesKeys(spec);
  spec = migrateOrchestrationKeys(spec);
  spec = ensurePlatformSurface(spec);
  spec = ensurePublicIngressCloudHost(spec);
  spec = removeApplicationCloudGatewayImplementation(spec);
  spec = ensureProfileFiles(spec, repoRoot);
  spec = ensureOrchestrationProfiles(spec);

  createMissingEnvFiles(spec, repoRoot, dryRun, actions);
  alignStandaloneDevelopmentEnv(spec, repoRoot, dryRun, actions);
  alignCloudDevelopmentEnv(spec, repoRoot, dryRun, actions);
  const meta = deriveAppMeta(repoRoot);
  if (meta) ensureRootAppConfig(repoRoot, meta, dryRun, actions);
  updateAppConfig(repoRoot, dryRun, actions);
  ensurePackageScripts(repoRoot, dryRun, actions);

  const nextSpecText = `${JSON.stringify(spec, null, 2)}\n`;
  if (originalSpecText !== nextSpecText) {
    actions.push('write specs/topology.spec.json');
    if (!dryRun) writeJson(specPath, spec, false);
  }
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
