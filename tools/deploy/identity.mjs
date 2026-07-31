import fs from 'node:fs';
import path from 'node:path';

export function resolveAppId(repoRoot, topology) {
  const repoName = path.basename(path.resolve(repoRoot));
  const topologyAppId = topology?.appId;
  if (topologyAppId && topologyAppId !== repoName) {
    return {
      appId: repoName,
      errors: [
        `appId mismatch: repository "${repoName}" vs topology.appId "${topologyAppId}"`,
      ],
    };
  }
  return { appId: repoName, errors: [] };
}

export function resolveRuntimeCode(topology) {
  const applicationCode = topology?.applicationCode;
  if (typeof applicationCode !== 'string'
    || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/u.test(applicationCode)) {
    return {
      runtimeCode: null,
      errors: ['topology.applicationCode must be a lowercase kebab-free runtime directory code'],
    };
  }
  return { runtimeCode: applicationCode, errors: [] };
}

export function surfaceRoot(appId, surface) {
  return `apps/${appId}-${surface}/`;
}

export function surfaceDist(appId, surface) {
  return `${surfaceRoot(appId, surface)}dist/`;
}

export function surfaceExists(repoRoot, appId, surface) {
  const root = path.join(repoRoot, surfaceRoot(appId, surface));
  return fs.existsSync(root) && fs.statSync(root).isDirectory();
}

export function packagePath(appId, packageName) {
  switch (packageName) {
    case 'mini-program-weixin':
      return `apps/${appId}-mini-program/dist/weixin/`;
    case 'mini-program-alipay':
      return `apps/${appId}-mini-program/dist/alipay/`;
    default: {
      const arch = packageName.replace(/^mini-program-/, '').replace(/^desktop-/, '');
      if (packageName.startsWith('desktop-')) {
        return null;
      }
      const clientArch =
        packageName === 'flutter-mobile' ||
        packageName === 'harmony-mobile' ||
        packageName === 'android-mobile' ||
        packageName === 'ios-mobile'
          ? packageName
          : arch;
      return `apps/${appId}-${clientArch}/`;
    }
  }
}
