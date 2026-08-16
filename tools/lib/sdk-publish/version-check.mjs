/**
 * Remote version existence checks per language registry.
 *
 * Each probe returns `true` when the (name, version) pair is already published,
 * `false` when not, or `null` when the probe itself failed (network/auth) —
 * the orchestrator treats `null` as "skip version gate, let publish attempt".
 *
 * Probes use `fetch` (Node 18+) against the registry REST API; they never
 * require local credentials.
 */

/**
 * @typedef {Object} VersionProbeResult
 * @property {boolean|null} exists
 * @property {string} [detail]
 */

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkNpm(name, version) {
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

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkCratesIo(name, version) {
  try {
    const res = await fetch(`https://crates.io/api/v1/crates/${encodeURIComponent(name)}`);
    if (res.status === 404) return { exists: false };
    if (!res.ok) return { exists: null, detail: `crates.io HTTP ${res.status}` };
    const body = await res.json();
    const versions = (body?.versions ?? []).map((v) => v.num);
    return { exists: versions.includes(version) };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkMavenCentral(name, version) {
  try {
    const [groupId, artifactId] = name.split(':');
    if (!groupId || !artifactId) return { exists: null, detail: 'invalid maven coordinate' };
    const url = `https://search.maven.org/solrsearch/select?q=g:${encodeURIComponent(groupId)}+AND+a:${encodeURIComponent(artifactId)}+AND+v:${encodeURIComponent(version)}&rows=1&wt=json`;
    const res = await fetch(url);
    if (!res.ok) return { exists: null, detail: `maven HTTP ${res.status}` };
    const body = await res.json();
    const count = body?.response?.numFound ?? 0;
    return { exists: count > 0 };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkPubDev(name, _version) {
  // pub.dev exposes no stable version-list JSON; we probe the version page.
  try {
    const res = await fetch(`https://pub.dev/packages/${encodeURIComponent(name)}`, {
      method: 'HEAD',
      redirect: 'manual',
    });
    if (res.status === 404) return { exists: false };
    if (res.status >= 200 && res.status < 400) return { exists: null, detail: 'pub.dev: package exists, per-version check deferred to publish' };
    return { exists: null, detail: `pub.dev HTTP ${res.status}` };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

/**
 * @param {string} name
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkPyPi(name, version) {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`);
    if (res.status === 404) return { exists: false };
    if (!res.ok) return { exists: null, detail: `pypi HTTP ${res.status}` };
    return { exists: true };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

/**
 * Go modules are versioned by git tag. Caller passes the repo URL.
 *
 * @param {string} repoUrl
 * @param {string} version
 * @returns {Promise<VersionProbeResult>}
 */
async function checkGoTag(repoUrl, version) {
  if (!repoUrl) return { exists: null, detail: 'no repo url' };
  try {
    const args = ['ls-remote', '--tags', repoUrl, `v${version}`, `refs/tags/v${version}`];
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync('git', args, { encoding: 'utf8' });
    if (r.error || r.status !== 0) return { exists: null, detail: 'git ls-remote failed' };
    return { exists: r.stdout.trim().length > 0 };
  } catch (err) {
    return { exists: null, detail: String(err.message || err) };
  }
}

const REGISTRY = {
  typescript: checkNpm,
  rust: checkCratesIo,
  java: checkMavenCentral,
  flutter: checkPubDev,
  python: checkPyPi,
  go: checkGoTag,
};

/**
 * @param {string} language
 * @param {string} name
 * @param {string} version
 * @param {object} [extra]
 * @returns {Promise<VersionProbeResult>}
 */
export async function checkRemoteVersion(language, name, version, extra = {}) {
  const fn = REGISTRY[language];
  if (!fn) return { exists: null, detail: `no probe for language ${language}` };
  if (language === 'go') return fn(extra.repoUrl ?? '', version);
  return fn(name, version);
}
