#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDeploy } from './deploy/validate.mjs';

const repoRoot = process.cwd();

const result = validateDeploy(repoRoot, process.env.SDKWORK_DEPLOY_PROFILE);

let exitCode = 0;
for (const warning of result.warnings ?? []) {
  console.warn(`warning: ${warning}`);
}
if (!result.ok) {
  for (const error of result.errors ?? []) {
    console.error(`error: ${error}`);
  }
  exitCode = 1;
} else {
  console.log(`check-deploy-standard ok (${result.profileId})`);
}

process.exit(exitCode);
