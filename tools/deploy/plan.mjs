import { resolveUpstreams } from './api.mjs';
import { buildDeployContext } from './validate.mjs';
import { loadProfileEnv } from './topology-env.mjs';
import { webRoots, binaryPath, hostRoot, nginxStagingFile } from './paths.mjs';

export function selectDeploymentBinary(topology, deployment) {
  if (deployment && deployment.deliveryKind !== 'host-package') return null;
  return topology?.components?.standaloneGateway?.binary
    ?? topology?.components?.appApiRouter?.binary
    ?? topology?.components?.cloudGateway?.binary
    ?? null;
}

export function shouldResolveDeploymentUpstreams(deployment) {
  return !deployment || deployment.deploymentDriver === 'nginx';
}

export function planDeploy(repoRoot, profileId, options = {}) {
  const context = buildDeployContext(repoRoot, profileId, options);
  const profileEnv = loadProfileEnv(context.repoRoot, context.topology, context.profileId);
  const upstreams = shouldResolveDeploymentUpstreams(context.deployment)
    ? resolveUpstreams(context.topology, context.overrides, profileEnv)
    : {};

  const binary = selectDeploymentBinary(context.topology, context.deployment);

  const expose = context.expose.map((item) => ({
    ...item,
    stagingFile: nginxStagingFile(item.domain),
    webRoots: (item.web?.surfaces ?? []).map((surface) => ({
      surface,
      path: webRoots({
        appId: context.appId,
        runtimeCode: context.runtimeCode,
        layout: context.layout,
        surface,
        repoRoot: context.repoRoot,
        dev: options.dev,
      }),
    })),
  }));

  return {
    ok: context.errors.length === 0,
    repoRoot: context.repoRoot,
    profileId: context.profileId,
    appId: context.appId,
    runtimeCode: context.runtimeCode,
    installLayout: context.layout,
    deployment: context.deployment,
    hostRoot: hostRoot({ appId: context.appId, layout: context.layout }),
    topology: context.topology,
    profileEnv,
    overrides: context.overrides,
    binary: binary
      ? {
          name: binary,
          path: binaryPath({
            appId: context.appId,
            runtimeCode: context.runtimeCode,
            layout: context.layout,
            binary,
            repoRoot: context.repoRoot,
            dev: options.dev,
          }),
        }
      : null,
    upstreams,
    apiSurfaces: context.apiSurfaces,
    websocketPath: context.websocketPath,
    expose,
    packages: context.packages,
    errors: context.errors,
    warnings: context.warnings,
  };
}

export function formatPlan(plan) {
  const lines = [];
  lines.push(`profileId:      ${plan.profileId}`);
  lines.push(`appId:          ${plan.appId}`);
  lines.push(`runtimeCode:    ${plan.runtimeCode}`);
  lines.push(`install.layout: ${plan.installLayout}`);
  if (plan.deployment) {
    lines.push(`deployment:     ${plan.deployment.deploymentProfile}.${plan.deployment.environment}`);
    lines.push(`driver:         ${plan.deployment.deploymentDriver}`);
    lines.push(`delivery:       ${plan.deployment.deliveryKind}`);
  }
  if (plan.hostRoot) lines.push(`hostRoot:       ${plan.hostRoot}`);
  if (plan.binary) lines.push(`binary:         ${plan.binary.path}`);
  const upstreams = Object.entries(plan.upstreams ?? {});
  if (upstreams.length > 0) {
    lines.push('upstreams:');
    for (const [key, value] of upstreams) {
      lines.push(`  ${key}: ${value}`);
    }
  }
  if (plan.apiSurfaces?.length > 0) {
    lines.push('apiSurfaces:');
    for (const item of plan.apiSurfaces) {
      lines.push(`  ${item.prefix} (${item.kind}, ${item.source})`);
    }
  }
  if (plan.websocketPath) lines.push(`websocketPath:  ${plan.websocketPath}`);
  lines.push('expose:');
  for (const item of plan.expose ?? []) {
    lines.push(`  - domain: ${item.domain}`);
    lines.push(`    siteFile: ${item.siteFile}`);
    lines.push(`    staging:  ${item.stagingFile}`);
    lines.push(`    mode:     ${item.mode}`);
    lines.push(`    tls:      ${item.tls}`);
    if (item.web) lines.push(`    webMode:  ${item.web.mode}`);
    for (const root of item.webRoots ?? []) {
      lines.push(`    web.${root.surface}: ${root.path}`);
    }
  }
  if (plan.packages?.length) {
    lines.push(`packages:       ${plan.packages.join(', ')}`);
  }
  if (plan.warnings?.length) {
    lines.push('warnings:');
    for (const warning of plan.warnings) lines.push(`  - ${warning}`);
  }
  if (plan.errors?.length) {
    lines.push('errors:');
    for (const error of plan.errors) lines.push(`  - ${error}`);
  }
  return lines.join('\n');
}
