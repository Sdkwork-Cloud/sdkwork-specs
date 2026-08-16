/**
 * WeChat mini-program application packager (mp-weixin).
 *
 * Build target:
 *  - `weixin`: the app's `build` script (commonly `node scripts/build-runtime.mjs`)
 *    emits a mini-program dist tree ready for upload.
 *
 * Artifacts:
 *  - The built dist tree archived as `weixin.zip`. WeChat MP upload via
 *    `miniprogram-ci` requires `MINIPROGRAM_APPID` + `MINIPROGRAM_PRIVATE_KEY`
 *    and is delegated to downstream CI; this packager produces the artifact.
 *
 * Authority: MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md, APP_MINI_PROGRAM_UI_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';

import { archiveDirectory, readJson, runCommand } from '../util.mjs';
import { artifactPackages, resolveBuildScript, stagingDir } from './shared.mjs';

export const architecture = 'mini-program';
export const defaultPlatforms = ['weixin'];
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
  platforms = Array.from(new Set(platforms)).filter((p) => p === 'weixin' || p === 'mini_program');
  if (platforms.length === 0) platforms = ['weixin'];
  platforms = platforms.map((p) => (p === 'mini_program' ? 'weixin' : p));

  if (platformFilter && platformFilter !== 'weixin') return null;

  return { appKey, version, appRoot, platforms };
}

/**
 * @returns {{ ok: boolean, detail: string }}
 */
export function build(appRoot, { skipBuild, env } = {}) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const script = resolveBuildScript(appRoot, 'build');
  if (!script) return { ok: false, detail: 'no build script' };
  const r = runCommand('pnpm', ['-C', appRoot, 'run', script], { cwd: appRoot, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `mini-program build failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'weixin built' };
}

/**
 * @returns {Array<{ path: string, name: string, platform: string, packageId?: string, label?: string }>}
 */
export function collectArtifacts(appRoot, { appKey, version, appConfig } = {}) {
  // Mini-program build output is conventionally `dist/` or `miniprogram_dist/`.
  const candidates = [path.join(appRoot, 'dist'), path.join(appRoot, 'miniprogram_dist')];
  const distDir = candidates.find((d) => fs.existsSync(d));
  if (!distDir) return [];
  const stage = stagingDir(appRoot);
  const out = path.join(stage, `${appKey}-${version}-weixin.zip`);
  const zipped = archiveDirectory(distDir, out);
  if (!zipped) return [];
  const pkg = artifactPackages(appConfig, 'weixin')[0];
  return [{ path: zipped, name: 'weixin.zip', platform: 'weixin', packageId: pkg?.id, label: 'WeChat Mini-Program Package' }];
}
