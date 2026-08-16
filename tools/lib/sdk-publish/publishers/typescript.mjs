/**
 * TypeScript publisher.
 *
 * Publishes the composed consumer package (`@sdkwork/*`) to npmjs.com.
 * The transport package (`*-generated-typescript` under `generated/server-openapi/`)
 * is NEVER published — see SDK_PACKAGE_NAMING_SPEC.md §1.1.
 *
 * Credentials: `NPM_TOKEN` (preferred). Falls back to a logged-in `.npmrc`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readJson, runCommand, toDisplayPath } from '../util.mjs';

export const language = 'typescript';
export const registry = 'npm';

/**
 * Detect a publishable TypeScript consumer package.
 * Returns `{ packageName, version, packagePath }` or `null`.
 */
export function detect(familyRoot, manifest) {
  const stem = path.basename(familyRoot);
  const candidates = [
    manifest?.typescript?.composedRoot
      ? path.join(familyRoot, manifest.typescript.composedRoot)
      : null,
    path.join(familyRoot, `${stem}-typescript`),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const pkgPath = path.join(candidate, 'package.json');
    const pkg = readJson(pkgPath);
    if (!pkg || !pkg.name) continue;

    // Hard rule: never publish generated transport packages.
    if (pkg.name.endsWith('-generated-typescript')) continue;
    // Only SDKWork consumer packages are in scope.
    if (!pkg.name.startsWith('@sdkwork/')) continue;
    // Skip packages explicitly marked private.
    if (pkg.private === true) continue;

    return {
      packageName: pkg.name,
      version: pkg.version,
      packagePath: candidate,
      packageJsonPath: pkgPath,
    };
  }
  return null;
}

export function build(pkgPath, { skipBuild }) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const pkg = readJson(path.join(pkgPath, 'package.json')) ?? {};
  const hasBuildScript = pkg.scripts && typeof pkg.scripts.build === 'string';
  if (!hasBuildScript) return { ok: true, detail: 'no build script' };

  const r = runCommand('pnpm', ['-C', pkgPath, 'run', 'build'], { cwd: pkgPath });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `build failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'built' };
}

export function publish(pkgPath, { tag = 'latest', access = 'public', env = {} }) {
  const args = ['publish', '--access', access, '--tag', tag];
  // When NPM_TOKEN is in env, pass it via CLI so it overrides any stale ~/.npmrc
  // entry. This avoids writing token files and works in CI without .npmrc.
  const token = env.NPM_TOKEN || process.env.NPM_TOKEN;
  if (token) {
    args.push(`--//registry.npmjs.org/:_authToken=${token}`);
  }
  const r = runCommand('npm', args, { cwd: pkgPath, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `npm publish exit ${r.status ?? 'null'} at ${toDisplayPath(pkgPath)}` };
  }
  return { ok: true, detail: `published to npm (${tag})` };
}

export function credentialName() {
  return 'NPM_TOKEN or ~/.npmrc authToken';
}

export function hasCredentials(env) {
  if (env.NPM_TOKEN || env.NODE_AUTH_TOKEN) return true;
  // Fallback: a logged-in ~/.npmrc (global or project-local) is also valid auth.
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
}
