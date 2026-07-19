import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const DIGEST = /^sha256:[a-f0-9]{64}$/u;
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const COMMIT = /^[0-9a-f]{7,64}$/u;

function sha256File(file) {
  const hash = createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return `sha256:${hash.digest('hex')}`;
}

function required(value, label, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} is required`);
}

export function validateArtifactEvidence(evidence, selection) {
  const errors = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return ['artifact evidence must be a JSON object'];
  }
  for (const field of ['artifactId', 'artifactPath', 'digest', 'version', 'sourceCommit', 'packageId', 'profileBinding', 'runtimeTarget']) {
    required(evidence[field], `artifact evidence ${field}`, errors);
  }
  if (typeof evidence.artifactPath === 'string') {
    const normalized = evidence.artifactPath.replaceAll('\\', '/');
    if (path.isAbsolute(evidence.artifactPath) || normalized.split('/').includes('..') || normalized === '.') {
      errors.push('artifact evidence artifactPath must be a safe relative path');
    }
  }
  if (evidence.digest && !DIGEST.test(evidence.digest)) errors.push('artifact evidence digest must use sha256:<64 lowercase hex characters>');
  if (evidence.version && !SEMVER.test(evidence.version)) errors.push('artifact evidence version must use SemVer');
  if (evidence.sourceCommit && !COMMIT.test(evidence.sourceCommit)) errors.push('artifact evidence sourceCommit must be a 7-64 character lowercase Git object id');
  if (!['fixed', 'runtime-configurable'].includes(evidence.profileBinding)) {
    errors.push('artifact evidence profileBinding must be fixed or runtime-configurable');
  }
  if (evidence.profileBinding === 'fixed') {
    if (!['standalone', 'cloud'].includes(evidence.deploymentProfile)) errors.push('fixed artifact evidence requires deploymentProfile');
    if (evidence.supportedDeploymentProfiles !== undefined) errors.push('fixed artifact evidence forbids supportedDeploymentProfiles');
  }
  if (evidence.profileBinding === 'runtime-configurable') {
    if (evidence.deploymentProfile !== undefined) errors.push('runtime-configurable artifact evidence forbids deploymentProfile');
    if (!Array.isArray(evidence.supportedDeploymentProfiles)
      || evidence.supportedDeploymentProfiles.length !== 2
      || !evidence.supportedDeploymentProfiles.includes('standalone')
      || !evidence.supportedDeploymentProfiles.includes('cloud')) {
      errors.push('runtime-configurable artifact evidence requires standalone and cloud support');
    }
  }
  if (selection) {
    if (evidence.artifactId !== selection.artifactId) errors.push('artifact evidence artifactId does not match --artifact-id');
    if (evidence.digest !== selection.artifactDigest) errors.push('artifact evidence digest does not match --artifact-digest');
    if (evidence.profile && evidence.profile !== selection.profile) errors.push('artifact evidence profile does not match --profile');
    if (evidence.environment && evidence.environment !== selection.environment) errors.push('artifact evidence environment does not match --environment');
    const profile = evidence.deploymentProfile;
    const supported = evidence.supportedDeploymentProfiles;
    if (profile && profile !== selection.profile.split('.')[0]) errors.push('artifact evidence deploymentProfile does not match --profile');
    if (Array.isArray(supported) && !supported.includes(selection.profile.split('.')[0])) {
      errors.push('artifact evidence supportedDeploymentProfiles does not include --profile');
    }
  }
  for (const field of ['sbom', 'provenance', 'signature']) {
    if (!evidence[field]
      || (typeof evidence[field] === 'string' && !evidence[field].trim())
      || (typeof evidence[field] === 'object' && Object.keys(evidence[field]).length === 0)) {
      errors.push(`artifact evidence ${field} reference is required`);
    }
  }
  return errors;
}

export function loadArtifactEvidence(file, selection, { artifactRoot = process.cwd() } = {}) {
  if (!file) throw new Error('--artifact-evidence is required for side-effecting deployment operations');
  const evidencePath = path.resolve(file);
  if (!fs.existsSync(evidencePath)) throw new Error(`artifact evidence not found: ${evidencePath}`);
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    throw new Error(`artifact evidence is not valid JSON: ${error.message}`);
  }
  const errors = validateArtifactEvidence(evidence, selection);
  if (typeof evidence.artifactPath === 'string' && !path.isAbsolute(evidence.artifactPath)) {
    const normalized = evidence.artifactPath.replaceAll('\\', '/');
    if (!normalized.split('/').includes('..')) {
      const artifactPath = path.resolve(artifactRoot, evidence.artifactPath);
      if (!fs.existsSync(artifactPath)) {
        errors.push(`artifact evidence artifactPath does not exist: ${artifactPath}`);
      } else {
        const actualDigest = sha256File(artifactPath);
        if (actualDigest !== evidence.digest) errors.push('artifact evidence digest does not match packaged artifact bytes');
      }
    }
  }
  if (errors.length > 0) throw new Error(`invalid artifact evidence: ${errors.join('; ')}`);
  return { path: evidencePath, document: evidence };
}
