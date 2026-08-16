/**
 * Flutter mobile application packager.
 *
 * Build targets:
 *  - `android`: `flutter build appbundle` → `.aab`
 *  - `ios`:     `flutter build ipa`      → `.ipa`
 *
 * Artifacts:
 *  - android: `build/app/outputs/bundle/release/*.aab`
 *  - ios:     `build/ios/ipa/*.ipa`
 *
 * App-store upload (Play Console / App Store Connect) is intentionally out of
 * scope; artifacts are published to a GitHub Release / local staging area for
 * downstream store submission. See FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md.
 */
import fs from 'node:fs';
import path from 'node:path';

import { collectFiles, readJson, runCommand } from '../util.mjs';
import { artifactPackages } from './shared.mjs';

export const architecture = 'flutter-mobile';
export const defaultPlatforms = ['android', 'ios'];
export const registry = 'github';

/**
 * @returns {{ appKey: string, version: string, appRoot: string, platforms: string[] } | null}
 */
export function detect(appRoot, appConfig, { platformFilter } = {}) {
  // A Flutter app owns a pubspec.yaml at its root.
  if (!fs.existsSync(path.join(appRoot, 'pubspec.yaml'))) return null;

  const pkg = readJson(path.join(appRoot, 'package.json')) ?? {};
  const appKey = appConfig?.app?.key ?? path.basename(appRoot);
  const version = pkg.version || appConfig?.release?.currentVersion || '0.0.0';

  let platforms = artifactPackages(appConfig).map((p) => String(p.platform || '').toLowerCase());
  platforms = Array.from(new Set(platforms)).filter((p) => p === 'android' || p === 'ios');
  if (platforms.length === 0) platforms = defaultPlatforms.slice();

  if (platformFilter) {
    platforms = platforms.filter((p) => p === platformFilter);
    if (platforms.length === 0) return null;
  }

  return { appKey, version, appRoot, platforms };
}

/**
 * @returns {{ ok: boolean, detail: string }}
 */
export function build(appRoot, { skipBuild, platform, env } = {}) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };

  const args = platform === 'ios' ? ['build', 'ipa'] : platform === 'android' ? ['build', 'appbundle'] : null;
  if (!args) return { ok: false, detail: `unknown flutter platform: ${platform}` };

  const r = runCommand('flutter', args, { cwd: appRoot, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `flutter ${args.join(' ')} failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: `${platform} built` };
}

/**
 * @returns {Array<{ path: string, name: string, platform: string, packageId?: string, label?: string }>}
 */
export function collectArtifacts(appRoot, { platform, appConfig } = {}) {
  if (platform === 'android') {
    const found = collectFiles(path.join(appRoot, 'build', 'app', 'outputs', 'bundle'), /\.aab$/i);
    if (found.length === 0) return [];
    const pkg = artifactPackages(appConfig, 'android')[0];
    return [{ path: found[0], name: 'android.aab', platform: 'android', packageId: pkg?.id, label: 'Android App Bundle' }];
  }
  if (platform === 'ios') {
    const found = collectFiles(path.join(appRoot, 'build', 'ios'), /\.ipa$/i);
    if (found.length === 0) return [];
    const pkg = artifactPackages(appConfig, 'ios')[0];
    return [{ path: found[0], name: 'ios.ipa', platform: 'ios', packageId: pkg?.id, label: 'iOS App Package' }];
  }
  return [];
}
