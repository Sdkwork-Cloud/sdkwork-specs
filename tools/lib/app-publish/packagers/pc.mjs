/**
 * PC application packager (React + Tauri).
 *
 * Build targets:
 *  - `web`:      `pnpm run _sdkwork:build` (Vite build + esbuild server) → `dist/`
 *  - `windows` / `macos` / `linux`: Tauri desktop bundle via the app's
 *    `build:desktop:local` script when present.
 *
 * Artifacts:
 *  - web:   `dist/` archived as `web-universal.zip`
 *  - desktop: installers emitted by Tauri under `src-tauri/target/release/bundle/`
 *    (`.exe`/`.msi`, `.dmg`, `.AppImage`/`.deb`).
 *
 * Authority: APP_PC_ARCHITECTURE_SPEC.md, APP_PC_REACT_UI_SPEC.md,
 * RELEASE_SPEC.md §2 (application release type).
 */
import fs from 'node:fs';
import path from 'node:path';

import { archiveDirectory, collectFiles, readJson, runCommand } from '../util.mjs';
import { artifactPackages, resolveBuildScript, stagingDir } from './shared.mjs';

export const architecture = 'pc';
export const defaultPlatforms = ['web', 'windows', 'macos', 'linux'];
export const registry = 'github';

/**
 * @returns {{ appKey: string, version: string, appRoot: string, platforms: string[] } | null}
 */
export function detect(appRoot, appConfig, { platformFilter } = {}) {
  const pkg = readJson(path.join(appRoot, 'package.json'));
  if (!pkg || !pkg.name) return null;

  const appKey = appConfig?.app?.key ?? path.basename(appRoot);
  const version = pkg.version || appConfig?.release?.currentVersion || '0.0.0';

  // Resolve target platforms from the manifest artifact matrix.
  let platforms = artifactPackages(appConfig).map((p) => normalizePlatform(p.platform));
  platforms = Array.from(new Set(platforms)).filter(Boolean);
  if (platforms.length === 0) platforms = ['web'];

  if (platformFilter) {
    platforms = platforms.filter((p) => p === platformFilter || (platformFilter === 'desktop' && p !== 'web'));
    if (platforms.length === 0) return null;
  }
  if (platforms.length === 0) return null;

  return { appKey, version, appRoot, platforms };
}

function normalizePlatform(token) {
  const t = String(token || '').toLowerCase();
  if (t === 'web') return 'web';
  if (t === 'desktop_windows' || t === 'windows') return 'windows';
  if (t === 'desktop_macos' || t === 'macos') return 'macos';
  if (t === 'desktop_linux' || t === 'linux') return 'linux';
  if (t === 'desktop') return 'desktop';
  return null;
}

/**
 * @returns {{ ok: boolean, detail: string }}
 */
export function build(appRoot, { skipBuild, platform, env } = {}) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };

  if (platform === 'web') {
    const script = resolveBuildScript(appRoot);
    if (!script) return { ok: true, detail: 'no build script' };
    const r = runCommand('pnpm', ['-C', appRoot, 'run', script], { cwd: appRoot, env });
    if (r.error || r.status !== 0) {
      return { ok: false, detail: `web build failed (status ${r.status ?? 'null'})` };
    }
    return { ok: true, detail: 'web built' };
  }

  if (platform === 'windows' || platform === 'macos' || platform === 'linux') {
    // Desktop builds are Tauri-host builds; they run on the matching host
    // runner. The app exposes `build:desktop:local` (filter script) when
    // desktop packaging is wired.
    const pkg = readJson(path.join(appRoot, 'package.json')) ?? {};
    const hasDesktop = pkg.scripts && typeof pkg.scripts['build:desktop:local'] === 'string';
    if (!hasDesktop) {
      return { ok: false, detail: `no build:desktop:local script for ${platform} desktop` };
    }
    const r = runCommand('pnpm', ['-C', appRoot, 'run', 'build:desktop:local'], { cwd: appRoot, env });
    if (r.error || r.status !== 0) {
      return { ok: false, detail: `desktop build failed for ${platform} (status ${r.status ?? 'null'})` };
    }
    return { ok: true, detail: `${platform} desktop built` };
  }

  return { ok: false, detail: `unknown pc platform: ${platform}` };
}

/**
 * @returns {Array<{ path: string, name: string, platform: string, packageId?: string, label?: string }>}
 */
export function collectArtifacts(appRoot, { appKey, version, platform, appConfig } = {}) {
  const stage = stagingDir(appRoot);

  if (platform === 'web') {
    const distDir = path.join(appRoot, 'dist');
    if (!fs.existsSync(distDir)) return [];
    const out = path.join(stage, `${appKey}-${version}-web.zip`);
    const zipped = archiveDirectory(distDir, out);
    if (!zipped) return [];
    const pkg = artifactPackages(appConfig, 'web')[0];
    return [{ path: zipped, name: 'web-universal.zip', platform: 'web', packageId: pkg?.id, label: 'Web Bundle' }];
  }

  if (platform === 'windows' || platform === 'macos' || platform === 'linux') {
    const bundleRoot = path.join(appRoot, 'src-tauri', 'target', 'release', 'bundle');
    if (!fs.existsSync(bundleRoot)) return [];
    const patterns = {
      windows: /\.(exe|msi)$/i,
      macos: /\.dmg$/i,
      linux: /\.(AppImage|deb)$/i,
    };
    const found = collectFiles(bundleRoot, patterns[platform]);
    if (found.length === 0) return [];
    const pkg = artifactPackages(appConfig, platform)[0];
    return found.slice(-1).map((p) => ({
      path: p,
      name: path.basename(p),
      platform,
      packageId: pkg?.id,
      label: `${platform} desktop installer`,
    }));
  }

  return [];
}
