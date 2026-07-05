/**
 * Materialize missing composed SDK facades for @sdkwork/* TypeScript SDK families.
 */
import fs from 'node:fs';
import path from 'node:path';

import { listWorkspaceRepos } from './app-sdk-consumer-import-patterns.mjs';

const APP_FACADE = `import {
  createClient as createGeneratedAppClient,
  SdkworkAppClient,
} from '../generated/server-openapi/src/index';
import type { SdkworkAppConfig } from '../generated/server-openapi/src/types/common';

export { SdkworkAppClient, createGeneratedAppClient };
export type { SdkworkAppConfig };
export * from '../generated/server-openapi/src/types';
export * from '../generated/server-openapi/src/api';
export * from '../generated/server-openapi/src/http';
export * from '../generated/server-openapi/src/auth';

export function createClient(config: SdkworkAppConfig): SdkworkAppClient {
  return createGeneratedAppClient(config);
}
`;

const BACKEND_FACADE = `import {
  createClient as createGeneratedBackendClient,
  SdkworkBackendClient,
} from '../generated/server-openapi/src/index';
import type { SdkworkBackendConfig } from '../generated/server-openapi/src/types/common';

export { SdkworkBackendClient, createGeneratedBackendClient };
export type { SdkworkBackendConfig };
export * from '../generated/server-openapi/src/types';
export * from '../generated/server-openapi/src/api';
export * from '../generated/server-openapi/src/http';
export * from '../generated/server-openapi/src/auth';

export function createClient(config: SdkworkBackendConfig): SdkworkBackendClient {
  return createGeneratedBackendClient(config);
}
`;

const OPEN_FACADE = `export {
  createClient,
  SdkworkOpenClient,
} from '../generated/server-openapi/src/index';
export type { SdkworkOpenConfig } from '../generated/server-openapi/src/types/common';
export * from '../generated/server-openapi/src/types';
export * from '../generated/server-openapi/src/api';
export * from '../generated/server-openapi/src/http';
export * from '../generated/server-openapi/src/auth';
`;

export function facadeBodyForConsumer(packageName) {
  if (packageName.endsWith('-backend-sdk')) return BACKEND_FACADE;
  if (packageName.endsWith('-internal-sdk')) return BACKEND_FACADE.replace(/Backend/gu, 'Internal').replace(/SdkworkInternalConfig/gu, 'SdkworkBackendConfig').replace(/SdkworkInternalClient/gu, 'SdkworkBackendClient');
  if (packageName.endsWith('-sdk') && !packageName.endsWith('-app-sdk') && !packageName.endsWith('-backend-sdk')) {
    return OPEN_FACADE.replace(/SdkworkOpenClient/gu, 'SdkworkClient').replace(/SdkworkOpenConfig/gu, 'SdkworkConfig');
  }
  return APP_FACADE;
}

function ensurePackageExports(packageJsonPath) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  let changed = false;
  if (!pkg.main) {
    pkg.main = './src/index.ts';
    changed = true;
  }
  if (!pkg.module) {
    pkg.module = './src/index.ts';
    changed = true;
  }
  if (!pkg.types) {
    pkg.types = './src/index.ts';
    changed = true;
  }
  if (!pkg.exports?.['.']) {
    pkg.exports = {
      ...(pkg.exports ?? {}),
      '.': {
        types: './src/index.ts',
        import: './src/index.ts',
        default: './src/index.ts',
      },
    };
    changed = true;
  }
  if (pkg.exports?.['./generated']) {
    delete pkg.exports['./generated'];
    changed = true;
  }
  if (changed) fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

export function materializeMissingComposedFacades(workspaceRoot) {
  const created = [];
  for (const repoRoot of listWorkspaceRepos(workspaceRoot)) {
    const sdksDir = path.join(repoRoot, 'sdks');
    if (!fs.existsSync(sdksDir)) continue;
    for (const family of fs.readdirSync(sdksDir, { withFileTypes: true })) {
      if (!family.isDirectory()) continue;
      const familyRoot = path.join(sdksDir, family.name);
      for (const entry of fs.readdirSync(familyRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.endsWith('-typescript')) continue;
        const typescriptRoot = path.join(familyRoot, entry.name);
        const packageJsonPath = path.join(typescriptRoot, 'package.json');
        const facadePath = path.join(typescriptRoot, 'src/index.ts');
        if (!fs.existsSync(packageJsonPath) || fs.existsSync(facadePath)) continue;
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (!String(pkg.name ?? '').startsWith('@sdkwork/')) continue;
        fs.mkdirSync(path.dirname(facadePath), { recursive: true });
        fs.writeFileSync(facadePath, facadeBodyForConsumer(String(pkg.name)), 'utf8');
        ensurePackageExports(packageJsonPath);
        created.push(facadePath);
      }
    }
  }
  return created;
}
