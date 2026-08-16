/**
 * Java publisher.
 *
 * Publishes a Maven artifact to Maven Central (OSSRH / Central Publishing Portal)
 * via `mvn deploy`. Coordinates are read from `pom.xml`.
 *
 * Credentials: `MAVEN_USERNAME`, `MAVEN_PASSWORD`, `MAVEN_GPG_PASSPHRASE`
 * (GPG signing required for Maven Central).
 */
import fs from 'node:fs';
import path from 'node:path';

import { readText, runCommand, toDisplayPath } from '../util.mjs';

export const language = 'java';
export const registry = 'maven-central';

function parsePomCoordinates(pomPath) {
  const text = readText(pomPath);
  if (!text) return null;

  // Minimal XML read: groupId, artifactId, version under <project>.
  const pick = (tag) => {
    const m = text.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`));
    return m ? m[1] : null;
  };

  const groupId = pick('groupId');
  const artifactId = pick('artifactId');
  const version = pick('version');
  if (!artifactId || !version) return null;
  return { groupId: groupId || '', artifactId, version };
}

export function detect(familyRoot, _manifest) {
  const stem = path.basename(familyRoot);
  const candidates = [
    path.join(familyRoot, `${stem}-java`),
    path.join(familyRoot, 'java'),
  ];

  for (const candidate of candidates) {
    const pomPath = path.join(candidate, 'pom.xml');
    if (!fs.existsSync(pomPath)) continue;
    const info = parsePomCoordinates(pomPath);
    if (!info) continue;
    return {
      packageName: info.groupId ? `${info.groupId}:${info.artifactId}` : info.artifactId,
      version: info.version,
      packagePath: candidate,
      packageJsonPath: pomPath,
    };
  }
  return null;
}

export function build(pkgPath, { skipBuild }) {
  if (skipBuild) return { ok: true, detail: 'skipped build' };
  const r = runCommand('mvn', ['-q', 'clean', 'package', '-DskipTests'], { cwd: pkgPath });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `mvn package failed (status ${r.status ?? 'null'})` };
  }
  return { ok: true, detail: 'built' };
}

export function publish(pkgPath, { env = {} }) {
  // Server credentials come from ~/.m2/settings.xml; env vars feed a profile
  // only when callers wire them. We pass them through for CI integration.
  const r = runCommand('mvn', ['-q', 'deploy', '-DskipTests'], { cwd: pkgPath, env });
  if (r.error || r.status !== 0) {
    return { ok: false, detail: `mvn deploy exit ${r.status ?? 'null'} at ${toDisplayPath(pkgPath)}` };
  }
  return { ok: true, detail: 'published to Maven Central' };
}

export function credentialName() {
  return 'MAVEN_USERNAME + MAVEN_PASSWORD + MAVEN_GPG_PASSPHRASE';
}

export function hasCredentials(env) {
  return Boolean(env.MAVEN_USERNAME && env.MAVEN_PASSWORD);
}
