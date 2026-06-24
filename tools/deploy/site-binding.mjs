export function parseSdkworkDeployBinding(runtimeConfig, fallbackDomain) {
  const binding = runtimeConfig?.sdkworkDeploy;
  if (!binding || typeof binding !== 'object') {
    return null;
  }

  const appRoot = typeof binding.appRoot === 'string' ? binding.appRoot.trim() : '';
  if (!appRoot) {
    return null;
  }

  const domain =
    typeof binding.domain === 'string' && binding.domain.trim()
      ? binding.domain.trim()
      : fallbackDomain ?? null;
  if (!domain) {
    return null;
  }

  return {
    appRoot,
    domain,
    profileId:
      typeof binding.profileId === 'string' && binding.profileId.trim()
        ? binding.profileId.trim()
        : null,
    siteFile:
      typeof binding.siteFile === 'string' && binding.siteFile.trim()
        ? binding.siteFile.trim()
        : null,
  };
}
