import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateDeploySchema } from './deploy/schema-validate.mjs';
import { assertSideEffectSelection, validateSideEffectSelection } from './deploy/selection.mjs';
import { resolveProfileBlock } from './deploy/load-manifest.mjs';
import { parseYaml } from './deploy/yaml-resolver.mjs';
import { loadArtifactEvidence } from './deploy/artifact-evidence.mjs';
import { requireExecutableDriver } from './deployctl.mjs';
import {
  formatPlan,
  selectDeploymentBinary,
  shouldResolveDeploymentUpstreams,
} from './deploy/plan.mjs';
import {
  applyNginxSite,
  atomicReplaceFile,
  rollbackBackupPath,
  rollbackNginxSite,
} from './deploy/nginx-lifecycle.mjs';

function deployment(overrides = {}) {
  return {
    deploymentProfile: 'cloud',
    environment: 'production',
    deliveryKind: 'container-image',
    deploymentDriver: 'kubernetes',
    managementModel: 'sdkwork-managed',
    tenancyModel: 'multi-tenant',
    isolationModel: 'shared',
    networkExposure: 'public',
    rolloutStrategy: 'rolling',
    availabilityMode: 'high-availability',
    ...overrides,
  };
}

test('deployment plans isolate host binaries and nginx upstreams by typed driver', () => {
  const topology = {
    components: {
      standaloneGateway: { binary: 'sdkwork-api-demo-standalone-gateway' },
      cloudGateway: { binary: 'sdkwork-api-cloud-gateway' },
    },
  };
  assert.equal(
    selectDeploymentBinary(topology, deployment({
      deliveryKind: 'host-package',
      deploymentDriver: 'nginx',
    })),
    'sdkwork-api-demo-standalone-gateway',
  );
  assert.equal(selectDeploymentBinary(topology, deployment()), null);
  assert.equal(shouldResolveDeploymentUpstreams(deployment()), false);
  assert.equal(
    shouldResolveDeploymentUpstreams(deployment({
      deliveryKind: 'host-package',
      deploymentDriver: 'nginx',
    })),
    true,
  );
});

test('deployment plan output omits empty optional network sections', () => {
  const output = formatPlan({
    profileId: 'cloud.production',
    appId: 'sdkwork-demo',
    runtimeCode: 'demo',
    installLayout: 'container-image',
    deployment: deployment(),
    upstreams: {},
    apiSurfaces: [],
    expose: [],
  });

  assert.doesNotMatch(output, /^upstreams:$/mu);
  assert.doesNotMatch(output, /^apiSurfaces:$/mu);
  assert.match(output, /^deployment:\s+cloud\.production$/mu);
});

test('top-level deploy dispatch executes only registered deployment drivers', () => {
  assert.equal(requireExecutableDriver({ deployment: { deploymentDriver: 'nginx' } }, 'apply'), 'nginx');
  assert.throws(
    () => requireExecutableDriver({ deployment: { deploymentDriver: 'kubernetes' } }, 'apply'),
    /no deployctl apply executor is registered for deploymentDriver kubernetes/u,
  );
});

function makeDeployRepo() {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-deploy-lifecycle-'));
  const repoRoot = path.join(workspace, 'sdkwork-demo');
  fs.mkdirSync(path.join(repoRoot, 'deployments'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'specs'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'etc', 'topology'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'deployments', 'deploy.yaml'), [
    'version: 2',
    'profile: cloud.production',
    'deployment:',
    '  deploymentProfile: cloud',
    '  environment: production',
    '  deliveryKind: configuration-bundle',
    '  deploymentDriver: nginx',
    '  managementModel: sdkwork-managed',
    '  tenancyModel: multi-tenant',
    '  isolationModel: shared',
    '  networkExposure: public',
    '  rolloutStrategy: rolling',
    '  availabilityMode: high-availability',
    'install:',
    '  layout: binary-package',
    'expose:',
    '  - domain: demo.sdkwork.com',
    '    tls: sdkwork.com',
    '    mode: api',
    'packages: []',
    'overrides: {}',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(repoRoot, 'specs', 'topology.spec.json'), JSON.stringify({
    schemaVersion: 5,
    kind: 'sdkwork.app.topology',
    appId: 'sdkwork-demo',
    database: { appPrefix: 'SDKWORK_DEMO' },
    profileFiles: { 'cloud.production': 'etc/topology/cloud.production.env' },
    surfaces: {
      'application.public-ingress': { bindEnv: 'SDKWORK_DEMO_BIND' },
    },
    cloudPublicHosts: {
      'application.public-ingress': { httpHost: 'demo.sdkwork.com' },
    },
  }, null, 2));
  fs.writeFileSync(
    path.join(repoRoot, 'etc', 'topology', 'cloud.production.env'),
    'SDKWORK_DEMO_BIND=127.0.0.1:9000\n',
  );
  const artifactPath = path.join(repoRoot, 'artifacts', 'sdkwork-demo.tar.gz');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, 'immutable-sdkwork-demo-artifact');
  const digest = `sha256:${createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex')}`;
  const evidencePath = path.join(repoRoot, 'artifact-evidence.json');
  fs.writeFileSync(evidencePath, JSON.stringify({
    artifactId: 'sdkwork-demo-1.0.0',
    artifactPath: 'artifacts/sdkwork-demo.tar.gz',
    digest,
    version: '1.0.0',
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    packageId: 'config-noarch-cloud-server-tar-gz',
    profileBinding: 'fixed',
    profile: 'cloud.production',
    environment: 'production',
    deploymentProfile: 'cloud',
    runtimeTarget: 'server',
    sbom: 'sbom.cdx.json',
    provenance: 'provenance.intoto.jsonl',
    signature: 'artifact.sig',
  }, null, 2));
  const selection = {
    profile: 'cloud.production',
    environment: 'production',
    artifactId: 'sdkwork-demo-1.0.0',
    artifactDigest: digest,
    rollbackTarget: 'sdkwork-demo-0.9.0',
    approvalRef: 'github-environment:production#run-123',
    artifactEvidence: evidencePath,
  };
  return { repoRoot, evidencePath, artifactPath, selection };
}

test('deploy manifest v2 accepts a typed production profile', () => {
  const errors = validateDeploySchema({
    version: 2,
    profile: 'cloud.production',
    deployment: deployment(),
    install: { layout: 'binary-package' },
    expose: [],
  });
  assert.deepEqual(errors, []);
});

test('deploy manifest rejects development and structured profile drift', () => {
  const developmentErrors = validateDeploySchema({
    version: 2,
    profile: 'cloud.development',
    deployment: deployment({ environment: 'development' }),
    expose: [],
  });
  assert.ok(developmentErrors.some((error) => error.includes('test|staging|production')));

  const driftErrors = validateDeploySchema({
    version: 2,
    profile: 'cloud.production',
    deployment: deployment({ deploymentProfile: 'standalone' }),
    expose: [],
  });
  assert.ok(driftErrors.some((error) => error.includes('must match profile id')));
});

test('production source-tree requires an exception reference', () => {
  const errors = validateDeploySchema({
    version: 2,
    profile: 'cloud.production',
    deployment: deployment(),
    install: { layout: 'source-tree' },
    expose: [],
  });
  assert.ok(errors.some((error) => error.includes('requires deployment.exceptionRef')));
});

test('deploy v2 rejects incompatible delivery and driver combinations', () => {
  const errors = validateDeploySchema({
    version: 2,
    profile: 'cloud.production',
    deployment: deployment({ deliveryKind: 'container-image', deploymentDriver: 'application-store' }),
    expose: [],
  });
  assert.ok(errors.some((error) => error.includes('cannot use deploymentDriver')));
});

test('deploy v2 requires provider evidence for multi-region and forbids cloud offline', () => {
  const multiRegionErrors = validateDeploySchema({
    version: 2,
    profile: 'cloud.production',
    deployment: deployment({ availabilityMode: 'multi-region' }),
    expose: [],
  });
  assert.ok(multiRegionErrors.some((error) => error.includes('multi-region requires')));

  const offlineErrors = validateDeploySchema({
    version: 2,
    profile: 'cloud.production',
    deployment: deployment({ networkExposure: 'offline' }),
    expose: [{ domain: 'demo.sdkwork.com', mode: 'api' }],
  });
  assert.ok(offlineErrors.some((error) => error.includes('cloud deployment cannot use')));
  assert.ok(offlineErrors.some((error) => error.includes('offline deployment cannot declare')));
});

test('side-effecting selection requires explicit immutable inputs', () => {
  assert.ok(validateSideEffectSelection({}).length >= 5);
  assert.throws(
    () => assertSideEffectSelection({ profile: 'cloud.production' }),
    /unsafe deployment selection/u,
  );

  assert.deepEqual(assertSideEffectSelection({
    profile: 'cloud.production',
    environment: 'production',
    'artifact-id': 'sdkwork-im-1.2.3',
    'artifact-digest': `sha256:${'a'.repeat(64)}`,
    'rollback-target': 'sdkwork-im-1.2.2',
    'approval-ref': 'github-environment:production#run-123',
    'artifact-evidence': 'evidence/sdkwork-im-1.2.3.json',
  }), {
    profile: 'cloud.production',
    environment: 'production',
    artifactId: 'sdkwork-im-1.2.3',
    artifactDigest: `sha256:${'a'.repeat(64)}`,
    rollbackTarget: 'sdkwork-im-1.2.2',
    approvalRef: 'github-environment:production#run-123',
    artifactEvidence: 'evidence/sdkwork-im-1.2.3.json',
  });
});

test('side-effecting profile resolution cannot consume defaultProfile', () => {
  const doc = {
    version: 2,
    defaultProfile: 'cloud.production',
    profiles: { 'cloud.production': { deployment: deployment() } },
  };
  assert.equal(resolveProfileBlock(doc, undefined).profileId, 'cloud.production');
  assert.throws(
    () => resolveProfileBlock(doc, undefined, { allowDefault: false }),
    /explicit --profile is required/u,
  );
});

test('deploy v2 examples satisfy the executable schema', () => {
  for (const name of ['multi-profile-mail.yaml', 'adaptive-web-production.yaml', 'simple-api-only.yaml']) {
    const file = path.resolve('examples/deploy', name);
    const doc = parseYaml(fs.readFileSync(file, 'utf8'), path.resolve('.'));
    assert.deepEqual(validateDeploySchema(doc), [], name);
  }
});

test('nginx rollback backups are keyed by the explicit rollback target', () => {
  assert.equal(
    rollbackBackupPath('/etc/nginx/sites-enabled/app.conf', 'sdkwork-im@1.2.2'),
    '/etc/nginx/sites-enabled/app.conf.rollback.sdkwork-im-1.2.2',
  );
});

test('artifact evidence must match immutable deployment selection', () => {
  const { repoRoot, evidencePath, artifactPath, selection } = makeDeployRepo();
  assert.equal(loadArtifactEvidence(evidencePath, selection, { artifactRoot: repoRoot }).document.artifactId, selection.artifactId);
  assert.throws(
    () => loadArtifactEvidence(evidencePath, { ...selection, artifactDigest: `sha256:${'b'.repeat(64)}` }, { artifactRoot: repoRoot }),
    /digest does not match/u,
  );
  fs.writeFileSync(artifactPath, 'mutated-sdkwork-demo-artifact');
  assert.throws(
    () => loadArtifactEvidence(evidencePath, selection, { artifactRoot: repoRoot }),
    /digest does not match packaged artifact bytes/u,
  );
});

test('atomic file replacement leaves complete target content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-atomic-replace-'));
  const source = path.join(dir, 'source.conf');
  const target = path.join(dir, 'target.conf');
  fs.writeFileSync(source, 'server { listen 8080; }\n');
  fs.writeFileSync(target, 'server { listen 80; }\n');
  atomicReplaceFile(source, target);
  assert.equal(fs.readFileSync(target, 'utf8'), 'server { listen 8080; }\n');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['source.conf', 'target.conf']);
});

test('nginx apply writes rollback evidence and rollback restores the requested backup', () => {
  const { repoRoot, selection } = makeDeployRepo();
  const siteFile = path.join(repoRoot, 'installed', 'demo.conf');
  fs.mkdirSync(path.dirname(siteFile), { recursive: true });
  fs.writeFileSync(siteFile, 'server { listen 80; }\n');
  const result = applyNginxSite(repoRoot, selection.profile, 'demo.sdkwork.com', {
    deploymentSelection: selection,
    siteFile,
    outputRoot: 'target/rendered',
    reload: true,
    runNginxTest: () => ({ ok: true, message: null }),
    runNginxReload: () => ({ ok: true, message: null }),
  });
  assert.match(fs.readFileSync(siteFile, 'utf8'), /GENERATED BY sdkwork-deploy/u);
  assert.equal(fs.readFileSync(result.backupPath, 'utf8'), 'server { listen 80; }\n');
  assert.equal(JSON.parse(fs.readFileSync(`${result.backupPath}.json`, 'utf8')).replacedByArtifactId, selection.artifactId);

  rollbackNginxSite(repoRoot, selection.profile, 'demo.sdkwork.com', {
    deploymentSelection: selection,
    siteFile,
    outputRoot: 'target/rendered',
    runNginxTest: () => ({ ok: true, message: null }),
  });
  assert.equal(fs.readFileSync(siteFile, 'utf8'), 'server { listen 80; }\n');
});

test('nginx test and reload failures restore the previous site', () => {
  for (const failure of ['test', 'reload']) {
    const { repoRoot, selection } = makeDeployRepo();
    const siteFile = path.join(repoRoot, 'installed', `${failure}.conf`);
    fs.mkdirSync(path.dirname(siteFile), { recursive: true });
    fs.writeFileSync(siteFile, 'server { listen 80; }\n');
    let reloadCalls = 0;
    assert.throws(() => applyNginxSite(repoRoot, selection.profile, 'demo.sdkwork.com', {
      deploymentSelection: selection,
      siteFile,
      outputRoot: `target/${failure}`,
      reload: failure === 'reload',
      runNginxTest: () => failure === 'test'
        ? { ok: false, message: 'synthetic test failure' }
        : { ok: true, message: null },
      runNginxReload: () => {
        reloadCalls += 1;
        return reloadCalls === 1
          ? { ok: false, message: 'synthetic reload failure' }
          : { ok: true, message: null };
      },
    }), failure === 'test' ? /nginx -t failed/u : /nginx reload failed/u);
    assert.equal(fs.readFileSync(siteFile, 'utf8'), 'server { listen 80; }\n');
  }
});
