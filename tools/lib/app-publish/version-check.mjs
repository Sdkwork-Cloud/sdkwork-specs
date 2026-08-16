/**
 * Remote release existence checks per publish registry.
 *
 * Each probe returns `true` when the (app, version) pair is already published,
 * `false` when not, or `null` when the probe itself failed (network/auth) —
 * the orchestrator treats `null` as "skip version gate, let publish attempt".
 *
 * Mirrors lib/sdk-publish/version-check.mjs semantics. Apps are not versioned
 * in a language registry; instead we probe the release destination:
 *  - `github`: GitHub Release tag `<appKey>-v<version>` via the REST API.
 *  - `local`:  artifact already staged under `--out-dir/<appKey>/<version>/`.
 *  - `cdn`:    HEAD probe of the artifact URL declared in the app manifest.
 */

/**
 * @typedef {Object} VersionProbeResult
 * @property {boolean|null} exists
 * @property {string} [detail]
 */

/**
 * @param {string} repoSlug - `owner/repo`
 * @param {string} tag
 * @returns {Promise<VersionProbeResult>}
 */
async function checkGithubRelease(repoSlug, tag) {
  if (!repoSlug) return { exists: null, detail: 'no github repo slug' };
  try {
    const headers = { Accept: 'application/vnd.github+json' };
    const token = process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      `https://api.github.com/repos/${repoSlug}/releases/tags/${encodeURIComponent(tag)}`,
      { headers },
    );
    if (res.status === 404) return { exists: false };
    if (res.status === 200) return { exists: true };
    if (res.status === 401 || res.status === 403) {
      return { exists: null, detail: `github auth ${res.status}` };
    }
    return { exists: null, detail: `github HTTP ${res.status}` };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

/**
 * @param {string} outDir
 * @param {string} appKey
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkLocalStaged(outDir, appKey, version) {
  const path = await import('node:path');
  const fs = await import('node:fs');
  const dir = path.join(outDir, appKey, version);
  if (!fs.existsSync(dir)) return { exists: false };
  const staged = fs.readdirSync(dir).filter((f) => !f.endsWith('.json'));
  return { exists: staged.length > 0, detail: staged.length > 0 ? `${staged.length} staged` : 'empty' };
}

/**
 * @param {string} url
 * @returns {Promise<VersionProbeResult>}
 */
async function checkCdnUrl(url) {
  if (!url) return { exists: null, detail: 'no artifact url' };
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (res.status === 404) return { exists: false };
    if (res.status >= 200 && res.status < 400) return { exists: true };
    return { exists: null, detail: `cdn HTTP ${res.status}` };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

/**
 * Probe npmjs.com for an already-published dist package version. Mirrors
 * lib/sdk-publish/version-check.mjs checkNpm semantics.
 *
 * @param {string} name - dist package name, e.g. `@sdkwork/im-pc-dist-web`
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkNpm(name, version) {
  if (!name) return { exists: null, detail: 'no npm package name' };
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    if (res.status === 404) return { exists: false };
    if (!res.ok) return { exists: null, detail: `npm HTTP ${res.status}` };
    const body = await res.json();
    const versions = body?.versions ?? {};
    return { exists: Object.prototype.hasOwnProperty.call(versions, version) };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

const REGISTRY = {
  github: checkGithubRelease,
  local: checkLocalStaged,
  cdn: checkCdnUrl,
  npm: checkNpm,
};

/**
 * @param {string} registry - `github` | `local` | `cdn` | `npm`
 * @param {object} ctx
 * @param {string} ctx.appKey
 * @param {string} ctx.version
 * @param {string} [ctx.repoSlug]    - required for `github`
 * @param {string} [ctx.outDir]      - required for `local`
 * @param {string} [ctx.artifactUrl] - required for `cdn`
 * @param {string} [ctx.npmName]     - required for `npm` (dist package name)
 * @returns {Promise<VersionProbeResult>}
 */
export async function checkRemoteVersion(registry, ctx) {
  const fn = REGISTRY[registry];
  if (!fn) return { exists: null, detail: `no probe for registry ${registry}` };
  const tag = `${ctx.appKey}-v${ctx.version}`;
  if (registry === 'github') return fn(ctx.repoSlug ?? '', tag);
  if (registry === 'local') return fn(ctx.outDir ?? '', ctx.appKey, ctx.version);
  if (registry === 'cdn') return fn(ctx.artifactUrl ?? '');
  if (registry === 'npm') return fn(ctx.npmName ?? '', ctx.version);
  return { exists: null };
}
