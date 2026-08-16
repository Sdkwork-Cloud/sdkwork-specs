/**
 * Release destination uploaders.
 *
 * Unlike SDK publishers (where each language owns a distinct registry), app
 * publish transport is uniform across architectures: build produces files,
 * an uploader ships them to a release destination. The orchestrator selects
 * the uploader via `--registry`; each packager delegates to it.
 *
 * Supported registries:
 *  - `github` (default): create a GitHub Release tagged `<appKey>-v<version>`
 *    and upload each artifact as a release asset via the `gh` CLI.
 *  - `local`: copy artifacts into `<outDir>/<appKey>/<version>/` and write a
 *    manifest JSON. No credentials required; ideal for staging / inspection.
 *  - `npm`: publish each artifact as an independent dist package on npmjs.com.
 *    App packages themselves are `private:true` with `workspace:*` deps and
 *    cannot be published; instead each artifact is wrapped in a minimal
 *    package named `@sdkwork/<app-base>-dist-<platform>` (e.g.
 *    `@sdkwork/im-pc-dist-web`) containing only the built artifact file.
 *    Consumers can `npm install @sdkwork/im-pc-dist-web` and serve the zip
 *    via unpkg/jsdelivr or extract it for hosting.
 *
 * Credentials come from the environment, never from manifests or config.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  ensureDir,
  fileSizeLabel,
  releaseTag,
  runCommand,
  sha256File,
  toDisplayPath,
} from './util.mjs';

export const SUPPORTED_REGISTRIES = ['github', 'local', 'npm'];

/**
 * @typedef {Object} Artifact
 * @property {string} path        - absolute path to the built artifact file
 * @property {string} name        - canonical asset name (basename used for upload)
 * @property {string} platform    - target platform label (e.g. web, windows, android)
 * @property {string} [label]     - human label for the release asset
 * @property {string} [packageId] - app manifest artifact package id
 */

const github = {
  registry: 'github',
  credentialName() {
    return 'GITHUB_TOKEN (and gh CLI authenticated, or token with repo scope)';
  },
  hasCredentials(env) {
    if (env.GITHUB_TOKEN) return true;
    // Fallback: a logged-in `gh` CLI is also valid auth.
    const r = runCommand('gh', ['auth', 'status'], { stdio: 'pipe' });
    return r.status === 0;
  },
  /**
   * @param {Artifact[]} artifacts
   * @param {object} opts
   * @param {string} opts.appKey
   * @param {string} opts.version
   * @param {string} opts.repoSlug - `owner/repo`
   * @param {string} [opts.channel]
   * @param {string} [opts.notes]
   * @returns {{ ok: boolean, detail: string }}
   */
  upload(artifacts, { appKey, version, repoSlug, channel, notes }) {
    const tag = releaseTag(appKey, version);
    const title = `${appKey} ${version}`;
    const prerelease = channel && channel !== 'stable' && channel !== 'STABLE';

    if (!repoSlug) {
      return { ok: false, detail: 'github upload requires --repo-slug owner/repo (no origin remote detected)' };
    }

    const baseArgs = [
      'release',
      'create',
      tag,
      '--repo',
      repoSlug,
      '--title',
      title,
      prerelease ? '--prerelease' : '--latest',
    ];
    if (notes) baseArgs.push('--notes', notes);
    else baseArgs.push('--generate-notes');

    // Create the release (idempotent: if it exists, gh errors; fall back to
    // uploading assets against the existing release).
    const create = runCommand('gh', baseArgs, { stdio: 'pipe' });
    if (create.status !== 0) {
      const stderr = (create.stderr || '').toString().trim();
      // `already exists` is fine — we just attach assets to it.
      if (!/already exists/i.test(stderr)) {
        return { ok: false, detail: `gh release create failed: ${stderr || `exit ${create.status}`}` };
      }
    }

    // Upload assets.
    const uploaded = [];
    for (const art of artifacts) {
      if (!fs.existsSync(art.path)) {
        return { ok: false, detail: `artifact missing: ${toDisplayPath(art.path)}` };
      }
      const args = [
        'release',
        'upload',
        tag,
        art.path,
        '--repo',
        repoSlug,
      ];
      if (art.label) args.push('--clobber');
      const r = runCommand('gh', args, { stdio: 'pipe' });
      if (r.status !== 0) {
        const stderr = (r.stderr || '').toString().trim();
        // Asset already attached is not a failure.
        if (!/already exists/i.test(stderr)) {
          return { ok: false, detail: `gh release upload failed for ${art.name}: ${stderr || `exit ${r.status}`}` };
        }
      }
      uploaded.push(art.name);
    }
    return { ok: true, detail: `uploaded ${uploaded.length} asset(s) to ${repoSlug}@${tag}` };
  },
};

const local = {
  registry: 'local',
  credentialName() {
    return 'none (local staging)';
  },
  hasCredentials(_env) {
    return true;
  },
  /**
   * @param {Artifact[]} artifacts
   * @param {object} opts
   * @param {string} opts.appKey
   * @param {string} opts.version
   * @param {string} opts.outDir
   * @returns {{ ok: boolean, detail: string }}
   */
  upload(artifacts, { appKey, version, outDir }) {
    if (!outDir) return { ok: false, detail: 'local upload requires --out-dir' };
    const dest = path.join(outDir, appKey, version);
    ensureDir(dest);

    const manifest = { appKey, version, stagedAt: new Date().toISOString(), assets: [] };
    for (const art of artifacts) {
      if (!fs.existsSync(art.path)) {
        return { ok: false, detail: `artifact missing: ${toDisplayPath(art.path)}` };
      }
      const destPath = path.join(dest, art.name);
      fs.copyFileSync(art.path, destPath);
      const checksum = sha256File(destPath);
      manifest.assets.push({
        name: art.name,
        platform: art.platform,
        packageId: art.packageId ?? null,
        size: fileSizeLabel(destPath),
        sha256: checksum,
      });
    }
    fs.writeFileSync(
      path.join(dest, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf8',
    );
    return { ok: true, detail: `staged ${artifacts.length} artifact(s) at ${toDisplayPath(dest)}` };
  },
};

/**
 * Derive the npm dist package name from the app's package.json#name and the
 * target platform. Convention: `@sdkwork/<app-base>-dist-<platform>`.
 *
 * Example: `@sdkwork/im-pc` + `web` → `@sdkwork/im-pc-dist-web`.
 * The `-dist-` infix separates the publishable artifact package from the
 * private app source package so consumers never confuse the two.
 *
 * @param {string} appName - app package.json#name (e.g. `@sdkwork/im-pc`)
 * @param {string} platform - target platform (e.g. `web`, `windows`)
 * @returns {string}
 */
export function distPackageName(appName, platform) {
  const base = String(appName || '').replace(/^@[^/]+\//, '') || 'app';
  return `@sdkwork/${base}-dist-${platform}`;
}

const npm = {
  registry: 'npm',
  credentialName() {
    return 'NPM_TOKEN or ~/.npmrc authToken';
  },
  hasCredentials(env) {
    if (env.NPM_TOKEN || env.NODE_AUTH_TOKEN) return true;
    // Fallback: a logged-in ~/.npmrc (global or project-local) is also valid.
    try {
      for (const candidate of [path.join(os.homedir(), '.npmrc'), '.npmrc']) {
        if (fs.existsSync(candidate)) {
          const text = fs.readFileSync(candidate, 'utf8');
          if (/_authToken\s*=/.test(text)) return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  },
  /**
   * Publish each artifact as an independent npm dist package. The app source
   * package (`@sdkwork/im-pc`, private:true + workspace:* deps) is never
   * published; instead we synthesize a minimal package containing only the
   * built artifact file.
   *
   * @param {Artifact[]} artifacts
   * @param {object} opts
   * @param {string} opts.appKey
   * @param {string} opts.appName  - app package.json#name, for dist name derivation
   * @param {string} opts.version
   * @param {string} [opts.access] - npm scoped package access (default: public)
   * @param {string} [opts.tag]    - npm dist-tag (default: latest)
   * @param {object} [opts.env]    - merged into process.env for npm publish
   * @returns {{ ok: boolean, detail: string }}
   */
  upload(artifacts, { appKey, appName, version, access = 'public', tag = 'latest', env = {} }) {
    const published = [];
    for (const art of artifacts) {
      if (!fs.existsSync(art.path)) {
        return { ok: false, detail: `artifact missing: ${toDisplayPath(art.path)}` };
      }
      const pkgName = distPackageName(appName || appKey, art.platform);

      // Synthesize a minimal publishable package in a temp dir.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `sdkwork-npm-${appKey}-${art.platform}-`));
      const destFile = path.join(tmpDir, art.name);
      fs.copyFileSync(art.path, destFile);

      const pkgJson = {
        name: pkgName,
        version,
        description: `Distributable artifact for ${appName || appKey} (${art.platform} platform).`,
        private: false,
        files: [art.name],
        publishConfig: { access },
      };
      if (art.label) pkgJson.keywords = ['sdkwork', art.platform, 'dist'];
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify(pkgJson, null, 2) + '\n',
        'utf8',
      );

      const args = ['publish', '--access', access, '--tag', tag];
      const token = env.NPM_TOKEN || process.env.NPM_TOKEN;
      if (token) {
        args.push(`--//registry.npmjs.org/:_authToken=${token}`);
      }
      const r = runCommand('npm', args, { cwd: tmpDir, env });

      // Clean up the temp package dir regardless of outcome.
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }

      if (r.error || r.status !== 0) {
        const stderr = (r.stderr || '').toString().trim();
        return {
          ok: false,
          detail: `npm publish failed for ${pkgName}@${version}: ${stderr || `exit ${r.status ?? 'null'}`} at ${toDisplayPath(art.path)}`,
        };
      }
      published.push(`${pkgName}@${version}`);
    }
    return { ok: true, detail: `published ${published.length} package(s) to npm: ${published.join(', ')}` };
  },
};

const REGISTRY = { github, local, npm };

/**
 * @param {string} registry
 * @returns {object|null}
 */
export function getUploader(registry) {
  return REGISTRY[registry] ?? null;
}
