/**
 * H5 (mobile browser) application packager (React + Vite).
 *
 * Build target:
 *  - `web`: `pnpm run _sdkwork:build` (Vite build + esbuild server) → `dist/`
 *
 * Artifacts:
 *  - `dist/` archived as `web-universal.zip` for CDN / static hosting.
 *
 * Authority: APP_H5_ARCHITECTURE_SPEC.md, RELEASE_SPEC.md §2.
 */
import fs from 'node:fs';
import path from 'node:path';

import { archiveDirectory, readJson, runCommand } from '../util.mjs';
import { artifactPackages, resolveBuildScript, stagingDir } from './shared.mjs';

export const architecture = 'h5';
export const defaultPlatforms = ['web'];
export const registry = 'github';

/**
 * @returns {{ appKey: string, version: string, appRoot: string, platforms: string[] } | null}
 */
export function detect(appRoot, appConfig, { platformFilter } = {}) {
  const pkg = readJson(path.join(appRoot, 'package.json'));
  if (!pkg || !pkg.name) return null;

  const appKey = appConfig?.app?.key ?? path.basename(appRoot);
  const version = pkg.version || appConfig?.release?.currentVersion || '0.0.0';

  let platforms = artifactPackages(appConfig).map((p) => String(p.platform || '').toLowerCase());
  platforms = Array.from(new Set(platforms)).filter((p) => p === 'web' || p === 'h5');
  if (platforms.length === 0) platforms = ['web'];
  // Normalize h5 → web.
  platforms = platforms.map((p) => (p === 'h5' ? 'web' : p));

  if (platformFilter && platformFilter !== 'web' && platformFilter !== 'h5') return null;

  return { appKey, version, appRoot, platforms };
}

/**
 * @returns {{ ok: boolean, detail: string }}
 */
export function build(appRoot, { skipBuild, env } = {}) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const script = resolveBuildScript(appRoot);
  if (!script) return { ok: true, detail: 'no build script' };
  const r = runCommand('pnpm', ['-C', appRoot, 'run', script], { cwd: appRoot, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `web build failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'web built' };
}

/**
 * @returns {Array<{ path: string, name: string, platform: string, packageId?: string, label?: string }>}
 */
export function collectArtifacts(appRoot, { appKey, version, appConfig } = {}) {
  const distDir = path.join(appRoot, 'dist');
  if (!fs.existsSync(distDir)) return [];
  const stage = stagingDir(appRoot);
  const out = path.join(stage, `${appKey}-${version}-web.zip`);
  const zipped = archiveDirectory(distDir, out);
  if (!zipped) return [];
  const pkg = artifactPackages(appConfig, 'web')[0];
  return [{ path: zipped, name: 'web-universal.zip', platform: 'web', packageId: pkg?.id, label: 'Web Bundle' }];
}
