/**
 * Python publisher.
 *
 * Publishes a Python distribution to PyPI via `twine upload`. Builds wheels
 * with `python -m build`.
 *
 * Credentials: `PYPI_TOKEN` (preferred, maps to `TWINE_USERNAME=__token__`
 * and `TWINE_PASSWORD=<token>`).
 */
import fs from 'node:fs';
import path from 'node:path';

import { readText, runCommand, toDisplayPath } from '../util.mjs';

export const language = 'python';
export const registry = 'pypi';

function parsePyproject(projectPath) {
  const text = readText(projectPath);
  if (!text) return null;

  // Minimal TOML read: `[project]` section `name` and `version`.
  let inProject = false;
  let name = null;
  let version = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('[')) {
      inProject = line === '[project]';
      continue;
    }
    if (!inProject) continue;
    const m = line.match(/^(name|version)\s*=\s*"([^"]+)"/);
    if (m) {
      if (m[1] === 'name') name = m[2];
      if (m[1] === 'version') version = m[2];
    }
  }

  if (!name || !version) return null;
  return { name, version };
}

export function detect(familyRoot, _manifest) {
  const stem = path.basename(familyRoot);
  const candidates = [
    path.join(familyRoot, `${stem}-python`),
    path.join(familyRoot, 'python'),
  ];

  for (const candidate of candidates) {
    const pyprojectPath = path.join(candidate, 'pyproject.toml');
    if (!fs.existsSync(pyprojectPath)) continue;
    const info = parsePyproject(pyprojectPath);
    if (!info) continue;
    return {
      packageName: info.name,
      version: info.version,
      packagePath: candidate,
      packageJsonPath: pyprojectPath,
    };
  }
  return null;
}

export function build(pkgPath, { skipBuild }) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const r = runCommand('python', ['-m', 'build'], { cwd: pkgPath });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `python -m build failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'built dist/' };
}

export function publish(pkgPath, { env = {} }) {
  const distDir = path.join(pkgPath, 'dist');
  const twineEnv = {
    ...env,
    TWINE_USERNAME: env.TWINE_USERNAME ?? (env.PYPI_TOKEN ? '__token__' : undefined),
    TWINE_PASSWORD: env.TWINE_PASSWORD ?? env.PYPI_TOKEN,
  };
  const r = runCommand('twine', ['upload', `${distDir}/*`], { cwd: pkgPath, env: twineEnv });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `twine upload exit ${r.status ?? 'null'} at ${toDisplayPath(pkgPath)}` };
  }
  return { ok: true, detail: 'published to PyPI' };
}

export function credentialName() {
  return 'PYPI_TOKEN';
}

export function hasCredentials(env) {
  return Boolean(env.PYPI_TOKEN || env.TWINE_PASSWORD);
}
