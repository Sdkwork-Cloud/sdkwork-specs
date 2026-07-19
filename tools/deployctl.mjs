#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validateDeploy } from './deploy/validate.mjs';
import { planDeploy, formatPlan } from './deploy/plan.mjs';
import { writeNginxRender } from './deploy/nginx-render.mjs';
import { getYaml } from './deploy/yaml-resolver.mjs';
import { assertSideEffectSelection } from './deploy/selection.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      root: { type: 'string', default: '.' },
      profile: { type: 'string' },
      environment: { type: 'string' },
      'artifact-id': { type: 'string' },
      'artifact-digest': { type: 'string' },
      'rollback-target': { type: 'string' },
      'approval-ref': { type: 'string' },
      'artifact-evidence': { type: 'string' },
      'artifact-root': { type: 'string' },
      domain: { type: 'string' },
      dev: { type: 'boolean', default: false },
      'output-root': { type: 'string' },
      'snippet-dir': { type: 'string' },
    },
    allowPositionals: true,
  });
  const command = positionals[0];
  if (!command) {
    throw new Error('command required: validate | plan | apply | rollback | init | nginx');
  }
  return { command, values, positionals };
}

function requireExecutableDriver(plan, command) {
  const driver = plan.deployment?.deploymentDriver;
  if (!driver) throw new Error(`deploy ${command} requires deployment.deploymentDriver`);
  if (driver !== 'nginx') {
    throw new Error(
      `no deployctl ${command} executor is registered for deploymentDriver ${driver}; use the approved sdkwork-github-workflow deployment lifecycle adapter`,
    );
  }
  return driver;
}

async function runNginxSideEffect(repoRoot, values, sub, { enforceDriver = false } = {}) {
  const selection = assertSideEffectSelection(values);
  if (sub === 'rollback' && selection.rollbackTarget.startsWith('forward-fix:')) {
    throw new Error('nginx rollback requires a concrete rollback target, not a forward-fix boundary');
  }
  const plan = planDeploy(repoRoot, values.profile, { dev: values.dev });
  if (!plan.ok) throw new Error(formatPlan(plan));
  if (enforceDriver) requireExecutableDriver(plan, sub);
  const domain = values.domain ?? plan.expose?.[0]?.domain;
  if (!domain) throw new Error('--domain required when expose is empty');
  const commonOptions = {
    dev: values.dev,
    outputRoot: values['output-root'],
    snippetDir: values['snippet-dir'],
    reload: process.env.SDKWORK_DEPLOY_NGINX_RELOAD === 'true',
    deploymentSelection: selection,
    artifactEvidence: values['artifact-evidence'],
    artifactRoot: values['artifact-root'],
  };
  if (sub === 'apply') {
    const { applyNginxSite } = await import('./deploy/nginx-lifecycle.mjs');
    const result = applyNginxSite(repoRoot, values.profile, domain, commonOptions);
    console.log(`applied ${result.siteFile}`);
    console.log(`artifact ${selection.artifactId} (${selection.artifactDigest})`);
    console.log(`artifact-evidence ${result.artifactEvidence}`);
    console.log(`rollback ${selection.rollbackTarget}`);
    console.log(`approval ${selection.approvalRef}`);
    if (result.backupPath) console.log(`backup ${result.backupPath}`);
    return;
  }
  const { rollbackNginxSite } = await import('./deploy/nginx-lifecycle.mjs');
  const result = rollbackNginxSite(repoRoot, values.profile, domain, commonOptions);
  console.log(`rolled back ${result.siteFile}`);
  console.log(`restored ${result.backupPath}`);
  console.log(`approval ${selection.approvalRef}`);
}

async function main() {
  const { command, values, positionals } = parseCli(process.argv.slice(2));
  const repoRoot = path.resolve(values.root);

  // Ensure yaml can be resolved for repos using deploy tooling through deployments workspace.
  getYaml(repoRoot);

  switch (command) {
    case 'validate': {
      const result = validateDeploy(repoRoot, values.profile, { dev: values.dev });
      for (const warning of result.warnings ?? []) {
        console.warn(`warning: ${warning}`);
      }
      if (!result.ok) {
        for (const error of result.errors ?? []) {
          console.error(`error: ${error}`);
        }
        process.exitCode = 1;
        return;
      }
      console.log(`deploy validate ok (${result.profileId})`);
      return;
    }
    case 'plan': {
      const plan = planDeploy(repoRoot, values.profile, { dev: values.dev });
      console.log(formatPlan(plan));
      if (!plan.ok) process.exitCode = 1;
      return;
    }
    case 'apply':
    case 'rollback': {
      await runNginxSideEffect(repoRoot, values, command, { enforceDriver: true });
      return;
    }
    case 'init': {
      const { initDeployManifest } = await import('./deploy/init.mjs');
      const deployPath = initDeployManifest(repoRoot);
      console.log(`created ${deployPath}`);
      return;
    }
    case 'nginx': {
      const sub = positionals[1];
      if (!sub) throw new Error('nginx subcommand required: plan | render | apply | rollback');
      if (sub === 'apply' || sub === 'rollback') {
        await runNginxSideEffect(repoRoot, values, sub);
        return;
      }
      const plan = planDeploy(repoRoot, values.profile, { dev: values.dev });
      if (!plan.ok) {
        console.error(formatPlan(plan));
        process.exitCode = 1;
        return;
      }
      const domain = values.domain ?? plan.expose?.[0]?.domain;
      if (!domain) throw new Error('--domain required when expose is empty');
      if (sub === 'render') {
        const result = writeNginxRender(repoRoot, plan, domain, {
          outputRoot: values['output-root'],
          snippetDir: values['snippet-dir'],
        });
        console.log(`wrote ${result.mainPath}`);
        for (const snippet of result.snippetOutputs) {
          console.log(`wrote ${snippet}`);
        }
        return;
      }
      if (sub === 'plan') {
        const item = plan.expose.find((entry) => entry.domain === domain);
        console.log(`siteFile: ${item?.siteFile}`);
        console.log(`staging:  ${item?.stagingFile}`);
        return;
      }
      throw new Error(`unknown nginx subcommand: ${sub}`);
    }
    default:
      throw new Error(`unknown command: ${command}`);
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message ?? error);
    process.exitCode = 1;
  });
}

export { main, requireExecutableDriver, runNginxSideEffect };
