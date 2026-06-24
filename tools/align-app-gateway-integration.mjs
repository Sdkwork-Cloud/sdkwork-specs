#!/usr/bin/env node
/**
 * Complete standalone + cloud gateway integration for SDKWork application repositories.
 * Generates cloud gateway TOML configs, env references, topology packaging, and pnpm scripts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_WORKSPACE = path.resolve(SPECS_ROOT, '..');
const GATEWAY_BUNDLE = '../sdkwork-app-topology/scripts/gateway-cloud-bundle.mjs';

const SKIP_REPOS = new Set(['sdkwork-specs', 'sdkwork-app-topology', 'sdkwork-api-cloud-gateway']);

const GATEWAY_TAIL = `
[cors]
allowAnyOrigin = true
allowedOrigins = []

[request]
maxBodyBytes = 33554432
timeoutMs = 0

[readiness]
checkUpstreams = false
timeoutMs = 1000

[observability]
accessLogEnabled = true
auditLogEnabled = true
accessLogSampleRateBasisPoints = 10000
auditLogSampleRateBasisPoints = 10000
metricsEnabled = false
metricsPath = "/metrics"
tracingEnabled = false
redactHeaders = ["authorization", "access-token", "cookie", "x-api-key", "set-cookie"]

[diagnostics]
enabled = false
path = "/internal/gateway/diagnostics"
includePolicyInventory = true
includeRouteInventory = true

[security]
allowedHosts = []
trustedProxyCidrs = []
secureHeadersEnabled = true
maxHeaderBytes = 65536
maxHeaderCount = 128
rejectCredentialHeadersOnAnonymousAuthRoutes = true
csrfGuardEnabled = false

[security.waf]
enabled = false
mode = "monitor"
inspectQuery = true
inspectHeaders = true
inspectJsonBody = false

[traffic]
rateLimitEnabled = false
compatXRateLimitHeaders = true
globalMaxInFlight = 1024
rateLimits = []
concurrencyLimits = []

[policy]
enabled = true
dryRun = false
rules = []

[resilience]
retryEnabled = false
maxAttempts = 1
retryStatuses = [502, 503, 504]
retryBackoffMs = 0
circuitBreakerEnabled = false
failureThreshold = 5
openSeconds = 30
halfOpenMaxAttempts = 1
`;

const APPBASE_SURFACE = `[[dependencySurfaces]]
serviceId = "sdkwork-appbase-app-api"
workspace = "sdkwork-appbase"
sdkFamily = "sdkwork-appbase-app-sdk"
apiAuthority = "sdkwork-appbase-app-api"
surface = "app"
apiPrefix = "/app/v3/api"
runtimeMode = "split-or-embedded"
sameOriginAllowed = true
executableExport = "sdkwork_router_iam_app_api::build_sdkwork_appbase_app_api_router"
cargoFeature = "foundation-appbase"
cargoDependency = "sdkwork_router_iam_app_api"
coverage = "appbase-iam-routes"
requiredBaseUrlKey = "SDKWORK_APPBASE_APP_API_BASE_URL"
`;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value, dryRun) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appPrefix(spec) {
  return spec.database?.appPrefix ?? 'SDKWORK_APP';
}

function configSlug(spec) {
  const glob = spec.components?.cloudGateway?.configGlob ?? '';
  const match = /sdkwork-api-cloud-gateway\.([^.]+)\.\{profile\}/.exec(glob);
  if (match) return match[1];
  return (spec.appId ?? 'app').replace(/^sdkwork-/, '');
}

function parseBindFromEnv(content, bindEnv) {
  const re = new RegExp(`^${bindEnv}=(.+)$`, 'm');
  const match = re.exec(content);
  return match?.[1]?.trim() ?? '127.0.0.1:8080';
}

function deriveApiSurfaces(spec, manifest) {
  const appId = spec.appId ?? 'sdkwork-app';
  const prefix = appPrefix(spec);
  const surfaces = [];

  const manifestSurfaces = manifest.backend?.apiSurfaces;
  if (Array.isArray(manifestSurfaces) && manifestSurfaces.length > 0) {
    for (const item of manifestSurfaces) {
      const surface = item.surface ?? 'app';
      const authority = item.authority ?? `${appId}-${surface}-api`;
      surfaces.push({
        serviceId: authority,
        workspace: appId,
        sdkFamily: `${appId}-${surface}-sdk`.replace('sdkwork-', 'sdkwork-'),
        apiAuthority: authority,
        surface: surface === 'open-api' ? 'open' : surface.replace('-api', ''),
        apiPrefix: item.prefix ?? `/app/v3/api`,
        requiredBaseUrlKey: surface === 'backend-api'
          ? `${prefix}_APPLICATION_BACKEND_HTTP_URL`
          : surface === 'open-api'
            ? `${prefix}_APPLICATION_OPEN_HTTP_URL`
            : `${prefix}_APPLICATION_PUBLIC_HTTP_URL`,
        coverage: `${configSlug(spec)}-${surface}-upstream-routes`,
      });
    }
    return surfaces;
  }

  const components = spec.components ?? {};
  const componentMap = [
    ['appApiRouter', 'app', '/app/v3/api', '_APPLICATION_PUBLIC_HTTP_URL'],
    ['backendApiRouter', 'backend', '/backend/v3/api', '_APPLICATION_BACKEND_HTTP_URL'],
    ['openApiRouter', 'open', '/open/v3/api', '_APPLICATION_OPEN_HTTP_URL'],
    ['applicationServer', 'app', '/app/v3/api', '_APPLICATION_PUBLIC_HTTP_URL'],
  ];

  for (const [key, surface, defaultPrefix, urlSuffix] of componentMap) {
    if (!components[key]) continue;
    const slug = configSlug(spec);
    const apiPrefix = defaultPrefix.includes('{')
      ? defaultPrefix
      : `${defaultPrefix}/${slug}`.replace(/\/+/g, '/').replace('/app/v3/api/', '/app/v3/api/');
    surfaces.push({
      serviceId: `${appId}-${surface}-api`.replace('open-api', 'open-api'),
      workspace: appId,
      sdkFamily: `${appId}-${surface === 'app' ? 'app' : surface}-sdk`,
      apiAuthority: components[key].crate?.replace('-api-server', `-${surface}-api`) ?? `${appId}-${surface}-api`,
      surface: surface === 'open' ? 'open' : surface,
      apiPrefix: surface === 'app' ? `/app/v3/api/${slug}` : surface === 'backend' ? `/backend/v3/api/${slug}` : `/${slug}/v3/api`,
      requiredBaseUrlKey: `${prefix}${urlSuffix}`,
      coverage: `${slug}-${surface}-api-upstream-routes`,
    });
  }

  if (surfaces.length === 0 && components.applicationServer) {
    const slug = configSlug(spec);
    surfaces.push({
      serviceId: `${appId}-app-api`,
      workspace: appId,
      sdkFamily: `${appId}-app-sdk`,
      apiAuthority: `${appId}-app-api`,
      surface: 'app',
      apiPrefix: `/app/v3/api/${slug}`,
      requiredBaseUrlKey: `${prefix}_APPLICATION_PUBLIC_HTTP_URL`,
      coverage: `${slug}-app-api-upstream-routes`,
    });
  }

  return surfaces;
}

function buildCloudGatewayToml(spec, manifest, environment, upstreamBaseUrl) {
  const mode = spec.archetype === 'realtime-application-platform' ? 'split' : 'embedded';
  const surfaces = deriveApiSurfaces(spec, manifest);
  const blocks = surfaces.map(
    (s) => `[[dependencySurfaces]]
serviceId = "${s.serviceId}"
workspace = "${s.workspace}"
sdkFamily = "${s.sdkFamily}"
apiAuthority = "${s.apiAuthority}"
surface = "${s.surface}"
apiPrefix = "${s.apiPrefix}"
runtimeMode = "split"
sameOriginAllowed = true
requiredBaseUrlKey = "${s.requiredBaseUrlKey}"
coverage = "${s.coverage}"
`,
  );

  const upstreams = surfaces.map(
    (s) => `[[upstreams]]
serviceId = "${s.serviceId}"
baseUrl = "http://${upstreamBaseUrl.replace(/^https?:\/\//, '')}"
`,
  );

  const includeAppbase = spec.surfaces?.['platform.api-gateway'] && mode === 'split';
  return [
    `mode = "${mode}"`,
    '',
    '[service]',
    'name = "sdkwork-api-cloud-gateway"',
    `environment = "${environment}"`,
    '',
    '[server]',
    'bind = "127.0.0.1:3900"',
    '',
    ...(includeAppbase ? [APPBASE_SURFACE, ''] : []),
    ...blocks,
    ...upstreams,
    GATEWAY_TAIL.trim(),
    '',
  ].join('\n');
}

function cloudConfigFileNames(spec) {
  const slug = configSlug(spec);
  return [
    `sdkwork-api-cloud-gateway.${slug}.development.toml`,
    `sdkwork-api-cloud-gateway.${slug}.production.toml`,
  ];
}

function ensureCloudConfigs(repoRoot, spec, manifest, dryRun, actions) {
  if (!spec.surfaces?.['platform.api-gateway']) return;

  const prefix = appPrefix(spec);
  const bindEnv = spec.surfaces['application.public-ingress']?.bindEnv ?? `${prefix}_APPLICATION_PUBLIC_INGRESS_BIND`;
  const standaloneEnvPath = path.join(
    repoRoot,
    spec.profileFiles?.['standalone.unified-process.development']
      ?? 'configs/topology/standalone.unified-process.development.env',
  );
  const standaloneEnv = fs.existsSync(standaloneEnvPath)
    ? fs.readFileSync(standaloneEnvPath, 'utf8')
    : '';
  const upstreamHost = parseBindFromEnv(standaloneEnv, bindEnv);

  fs.mkdirSync(path.join(repoRoot, 'configs'), { recursive: true });
  const files = cloudConfigFileNames(spec);
  for (const [index, fileName] of files.entries()) {
    const env = index === 0 ? 'development' : 'production';
    const abs = path.join(repoRoot, 'configs', fileName);
    const content = buildCloudGatewayToml(spec, manifest, env, upstreamHost);
    if (!fs.existsSync(abs)) {
      actions.push(`write configs/${fileName}`);
      if (!dryRun) fs.writeFileSync(abs, content, 'utf8');
    }
  }

  spec.packaging ??= {};
  spec.packaging.cloudConfigFiles = files;
  if (!spec.packaging.targets) {
    spec.packaging.targets = [
      {
        id: 'container-noarch-cloud-container-config-bundle-tar-gz',
        profile: 'container',
        platform: 'container',
        architecture: 'noarch',
        formats: ['tar.gz'],
        runner: 'ubuntu-24.04',
        outputGlob: `dist/cloud-config/${spec.appId}-api-gateway-config-*.tar.gz`,
        deploymentProfile: 'cloud',
        runtimeTarget: 'container',
        variant: 'config-bundle',
      },
    ];
  }
}

function patchCloudEnvFiles(repoRoot, spec, dryRun, actions) {
  const slug = configSlug(spec);
  const devConfig = `configs/sdkwork-api-cloud-gateway.${slug}.development.toml`;
  const prodConfig = `configs/sdkwork-api-cloud-gateway.${slug}.production.toml`;

  for (const [profileId, relativePath] of Object.entries(spec.profileFiles ?? {})) {
    if (!profileId.startsWith('cloud.')) continue;
    const abs = path.join(repoRoot, relativePath);
    if (!fs.existsSync(abs)) continue;
    let content = fs.readFileSync(abs, 'utf8');
    const configRef = profileId.includes('production') ? prodConfig : devConfig;
    const configLine = `SDKWORK_API_CLOUD_GATEWAY_CONFIG=${configRef}`;
    if (!content.includes('SDKWORK_API_CLOUD_GATEWAY_CONFIG=')) {
      content = `${content.trimEnd()}\n${configLine}\n`;
      actions.push(`patch ${relativePath} with cloud gateway config path`);
      if (!dryRun) fs.writeFileSync(abs, content, 'utf8');
    }
  }
}

function ensurePackageScripts(repoRoot, spec, dryRun, actions) {
  const pkgPath = path.join(repoRoot, 'package.json');
  if (!fs.existsSync(pkgPath)) return;
  const pkg = readJson(pkgPath);
  pkg.scripts ??= {};

  const additions = {
    'topology:validate':
      'node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs validate --root . --spec specs/topology.spec.json',
    'topology:plan':
      'node ../sdkwork-app-topology/scripts/sdkwork-topology.mjs plan --root . --spec specs/topology.spec.json',
  };

  if (spec.surfaces?.['platform.api-gateway']) {
    const ownsAppCloudGateway = Boolean(
      spec.components?.gatewayService?.crate?.includes('-cloud-gateway') ||
        (spec.components?.cloudGateway?.crate?.includes('-cloud-gateway') &&
          !spec.components.cloudGateway.crate.includes('api-cloud')),
    );
    if (!ownsAppCloudGateway) {
      additions['gateway:package:cloud'] = `node ${GATEWAY_BUNDLE} bundle --root .`;
      additions['gateway:validate:cloud'] = `node ${GATEWAY_BUNDLE} validate --root .`;
    } else {
      additions['gateway:package:platform-config'] = `node ${GATEWAY_BUNDLE} bundle --root .`;
      additions['gateway:validate:platform-config'] = `node ${GATEWAY_BUNDLE} validate --root .`;
    }
  }

  const standaloneGateway =
    spec.components?.standaloneGateway ?? spec.components?.edgeServer;
  if (standaloneGateway?.crate) {
    const bin = standaloneGateway.binary ?? standaloneGateway.crate;
    additions['gateway:run:standalone'] ??= `cargo run -p ${standaloneGateway.crate} --bin ${bin}`;
    additions['gateway:build:standalone'] ??= `cargo build -p ${standaloneGateway.crate} --bin ${bin}`;
    additions['gateway:package:standalone'] ??=
      `cargo build -p ${standaloneGateway.crate} --release --bin ${bin}`;
    additions['gateway:validate:standalone'] ??= `cargo check -p ${standaloneGateway.crate}`;
  }

  const cloudGatewayApp =
    spec.components?.cloudGateway?.crate?.includes('clawrouter-cloud') ||
    spec.components?.gatewayService?.crate?.includes('cloud-gateway')
      ? (spec.components.gatewayService ?? spec.components.cloudGateway)
      : null;
  if (
    cloudGatewayApp?.crate &&
    cloudGatewayApp.crate.includes('cloud-gateway') &&
    !cloudGatewayApp.crate.includes('api-cloud')
  ) {
    const bin = cloudGatewayApp.binary ?? cloudGatewayApp.crate;
    additions['gateway:run:cloud'] ??= `cargo run -p ${cloudGatewayApp.crate} --bin ${bin}`;
    additions['gateway:build:cloud'] ??= `cargo build -p ${cloudGatewayApp.crate} --bin ${bin}`;
    additions['gateway:package:cloud'] ??= `cargo build -p ${cloudGatewayApp.crate} --release --bin ${bin}`;
    additions['gateway:validate:cloud'] ??= `cargo check -p ${cloudGatewayApp.crate}`;
  }

  const cloudGateway = spec.components?.cloudGateway;
  if (
    cloudGateway?.crate &&
    cloudGateway.crate.includes('cloud-gateway') &&
    !cloudGateway.crate.includes('api-cloud') &&
    !cloudGatewayApp
  ) {
    const bin = cloudGateway.binary ?? cloudGateway.crate;
    additions['gateway:run:cloud'] ??= `cargo run -p ${cloudGateway.crate} --bin ${bin}`;
    additions['gateway:build:cloud'] ??= `cargo build -p ${cloudGateway.crate} --bin ${bin}`;
    additions['gateway:package:cloud'] ??= `cargo build -p ${cloudGateway.crate} --release --bin ${bin}`;
    additions['gateway:validate:cloud'] ??= `cargo check -p ${cloudGateway.crate}`;
  }

  let changed = false;
  for (const [key, value] of Object.entries(additions)) {
    if (pkg.scripts[key] === value) continue;
    if (pkg.scripts[key] && key.startsWith('gateway:') && pkg.scripts[key].includes('gateway-cloud-bundle')) {
      continue;
    }
    if (pkg.scripts[key] && key === 'topology:validate') continue;
    pkg.scripts[key] = value;
    actions.push(`add script ${key}`);
    changed = true;
  }

  if (changed && !dryRun) writeJson(pkgPath, pkg, false);
}

function alignRepo(repoRoot, dryRun) {
  const actions = [];
  const specPath = path.join(repoRoot, 'specs/topology.spec.json');
  if (!fs.existsSync(specPath)) return actions;

  const spec = readJson(specPath);
  const manifestPath = path.join(repoRoot, 'sdkwork.app.config.json');
  const manifest = fs.existsSync(manifestPath) ? readJson(manifestPath) : {};

  ensureCloudConfigs(repoRoot, spec, manifest, dryRun, actions);
  patchCloudEnvFiles(repoRoot, spec, dryRun, actions);
  ensurePackageScripts(repoRoot, spec, dryRun, actions);

  if (actions.some((a) => a.startsWith('write configs/'))) {
    actions.push('update specs/topology.spec.json packaging');
    if (!dryRun) writeJson(specPath, spec, false);
  } else if (!spec.packaging?.cloudConfigFiles?.length && spec.surfaces?.['platform.api-gateway']) {
    spec.packaging ??= {};
    spec.packaging.cloudConfigFiles = cloudConfigFileNames(spec);
    actions.push('update specs/topology.spec.json packaging');
    if (!dryRun) writeJson(specPath, spec, false);
  }

  return actions;
}

function main() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: DEFAULT_WORKSPACE },
      repo: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log('Usage: node tools/align-app-gateway-integration.mjs [--workspace <path>] [--repo <name>] [--dry-run]');
    return;
  }

  const workspace = path.resolve(values.workspace);
  const dryRun = values['dry-run'];
  const repos = values.repo
    ? [path.join(workspace, values.repo)]
    : fs
        .readdirSync(workspace)
        .filter((name) => name.startsWith('sdkwork-') && !SKIP_REPOS.has(name))
        .map((name) => path.join(workspace, name))
        .filter((repo) => fs.existsSync(path.join(repo, 'specs/topology.spec.json')));

  let total = 0;
  for (const repoRoot of repos) {
    const actions = alignRepo(repoRoot, dryRun);
    if (actions.length === 0) continue;
    console.log(`\n${path.basename(repoRoot)}${dryRun ? ' (dry-run)' : ''}:`);
    for (const action of actions) actions.forEach((a) => console.log(`  - ${a}`));
    total += actions.length;
  }
  console.log(`\nTotal integration actions: ${total}`);
}

main();
