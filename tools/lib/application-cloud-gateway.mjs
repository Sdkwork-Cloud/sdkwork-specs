export function isApplicationCloudGatewayScript(scriptName) {
  const parts = String(scriptName ?? '').split(':');
  if (parts[0] !== 'gateway') return false;
  return parts.includes('cloud') || parts.includes('platform-config');
}
