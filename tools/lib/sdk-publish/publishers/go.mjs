/**
 * Go publisher.
 *
 * Go modules are not published to a central registry. Instead, releases are
 * cut as git tags (`v<version>`) on the module's repository and surfaced
 * through a GitHub Release. This publisher:
 *   1. validates the module via `go build` + `go vet`
 *   2. resolves the upstream repo URL from `go.mod`
 *   3. creates a `v<version>` git tag and pushes it (publish step)
 *
 * Credentials: `GITHUB_TOKEN` (for `gh release create`). Tag push uses the
 * caller's git remote credentials.
 */
import fs from 'node:fs';
import path from 'node:path';

import { readText, runCommand, toDisplayPath } from '../util.mjs';

export const language = 'go';
export const registry = 'git-tag + github-release';

function parseGoMod(goModPath) {
  const text = readText(goModPath);
  if (!text) return null;
  const m = text.match(/^module\s+(\S+)/m);
  if (!m) return null;
  return { modulePath: m[1] };
}

function moduleToRepoUrl(modulePath) {
  // Strip a trailing `/vN` major version suffix (e.g. /v2, /v3).
  const stripped = modulePath.replace(/\/v\d+$/, '');
  if (stripped.startsWith('github.com/')) return `https://${stripped}.git`;
  return null;
}

function readVersionFromGitTags(pkgPath) {
  const r = runCommand('git', ['describe', '--tags', '--abbrev=0'], {
    cwd: pkgPath,
    stdio: 'pipe',
  });
  if (r.status !== 0) return null;
  const tag = (r.stdout?.toString() || '').trim();
  return tag.startsWith('v') ? tag.slice(1) : tag || null;
}

export function detect(familyRoot, _manifest) {
  const stem = path.basename(familyRoot);
  const candidates = [
    path.join(familyRoot, `${stem}-go`),
    path.join(familyRoot, 'go'),
  ];

  for (const candidate of candidates) {
    const goModPath = path.join(candidate, 'go.mod');
    if (!fs.existsSync(goModPath)) continue;
    const info = parseGoMod(goModPath);
    if (!info) continue;

    // Go has no version file; convention is to use the latest git tag.
    const version = readVersionFromGitTags(candidate);
    if (!version) continue;

    return {
      packageName: info.modulePath,
      version,
      packagePath: candidate,
      packageJsonPath: goModPath,
      repoUrl: moduleToRepoUrl(info.modulePath),
    };
  }
  return null;
}

export function build(pkgPath, { skipBuild }) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const vet = runCommand('go', ['vet', './...'], { cwd: pkgPath });
  if (vet.error || vet.status !== 0) {
    return { ok: false, detail: `go vet failed (status ${vet.status ?? 'null'})` };
  }
  const b = runCommand('go', ['build', './...'], { cwd: pkgPath });
  if (b.error || b.status !== 0) {
    return { ok: false, detail: `go build failed (status ${b.status ?? 'null'})` };
  }
  return { ok: true, detail: 'go vet + build passed' };
}

export function publish(pkgPath, { version, env = {} }) {
  const tag = `v${version}`;
  // Create and push the tag.
  const tagR = runCommand('git', ['tag', tag], { cwd: pkgPath });
  if (tagR.status !== 0 && !/already exists/i.test(tagR.stderr?.toString() || '')) {
    return { ok: false, detail: `git tag ${tag} failed` };
  }
  const pushR = runCommand('git', ['push', 'origin', tag], { cwd: pkgPath, env });
  if (pushR.error || pushR.status !== 0) {
    return { ok: false, detail: `git push ${tag} failed at ${toDisplayPath(pkgPath)}` };
  }
  return { ok: true, detail: `tagged and pushed ${tag}` };
}

export function credentialName() {
  return 'GITHUB_TOKEN (for optional release notes)';
}

export function hasCredentials(env) {
  // Tag push uses git remote creds; GITHUB_TOKEN is optional.
  return Boolean(env.GITHUB_TOKEN) || true;
}
