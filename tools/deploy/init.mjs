import fs from 'node:fs';
import path from 'node:path';
import { stringifyYaml } from './yaml-resolver.mjs';
import { surfaceExists } from './identity.mjs';
import { loadTopology } from './load-manifest.mjs';

export function initDeployManifest(repoRoot) {
  const topology = loadTopology(repoRoot);
  const appId = topology.appId ?? path.basename(path.resolve(repoRoot));
  const discoveredProfile =
    topology.defaults?.productionProfileId ??
    topology.defaults?.developmentProfileId ??
    'cloud.production';
  const profile = /\.(?:test|staging|production)$/u.test(discoveredProfile)
    ? discoveredProfile
    : `${discoveredProfile.startsWith('standalone.') ? 'standalone' : 'cloud'}.production`;

  const hasPc = surfaceExists(repoRoot, appId, 'pc');
  const hasH5 = surfaceExists(repoRoot, appId, 'h5');
  const cloudHosts = topology.cloudPublicHosts ?? {};
  const domain =
    cloudHosts['application.public-ingress']?.httpHost ?? `${appId}.sdkwork.com`;

  const doc = {
    version: 2,
    profile,
    deployment: {
      deploymentProfile: profile.startsWith('standalone.') ? 'standalone' : 'cloud',
      environment: profile.split('.')[1],
      deliveryKind: 'host-package',
      deploymentDriver: 'nginx',
      managementModel: 'customer-managed',
      tenancyModel: 'single-tenant',
      isolationModel: 'dedicated',
      networkExposure: 'public',
      rolloutStrategy: 'recreate',
      availabilityMode: 'single-instance',
    },
    install: {
      layout: 'binary-package',
    },
    expose: [
      {
        domain,
        tls: 'sdkwork.com',
        mode: hasPc || hasH5 ? 'web+api' : 'api',
        ...(hasPc || hasH5 ? { web: 'adaptive' } : {}),
      },
    ],
    packages: [],
    overrides: {},
  };

  const deployDir = path.join(repoRoot, 'deployments');
  fs.mkdirSync(deployDir, { recursive: true });
  const deployPath = path.join(deployDir, 'deploy.yaml');
  if (fs.existsSync(deployPath)) {
    throw new Error('deployments/deploy.yaml already exists');
  }
  fs.writeFileSync(deployPath, stringifyYaml(doc, repoRoot), 'utf8');
  return deployPath;
}
