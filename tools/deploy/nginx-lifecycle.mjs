import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planDeploy } from './plan.mjs';
import { writeNginxRender } from './nginx-render.mjs';
import { loadArtifactEvidence } from './artifact-evidence.mjs';

const DANGEROUS_PATTERNS = [
  /\blua_/i,
  /\bperl\b/i,
  /\broot\s+[^;]*\|/i,
  /\binclude\s+\/etc\/passwd/i,
  /\bproxy_pass\s+https?:\/\/(?!127\.0\.0\.1|localhost)/i,
];

export function inspectNginxConfig(content) {
  const errors = [];
  const trimmed = content?.trim?.() ?? '';
  if (!trimmed) {
    errors.push('config content is empty');
    return { valid: false, errors };
  }
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      errors.push(`forbidden nginx directive pattern: ${pattern}`);
    }
  }
  if (!trimmed.includes('server {') && !trimmed.includes('server{')) {
    errors.push('config must contain at least one server block');
  }
  return { valid: errors.length === 0, errors };
}

export function runNginxTest(configPath, options = {}) {
  const nginxBin = options.nginxBin ?? process.env.SDKWORK_DEPLOY_NGINX_BIN ?? 'nginx';
  const prefix = options.prefix ?? process.env.SDKWORK_DEPLOY_NGINX_PREFIX;
  const args = ['-t', '-c', configPath];
  if (prefix) {
    args.push('-p', prefix);
  }
  const result = spawnSync(nginxBin, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    return { ok: false, message: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      message: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || 'nginx -t failed',
    };
  }
  return { ok: true, message: null };
}

export function runNginxReload(options = {}) {
  const nginxBin = options.nginxBin ?? process.env.SDKWORK_DEPLOY_NGINX_BIN ?? 'nginx';
  const prefix = options.prefix ?? process.env.SDKWORK_DEPLOY_NGINX_PREFIX;
  const args = ['-s', 'reload'];
  if (prefix) {
    args.push('-p', prefix);
  }
  const result = spawnSync(nginxBin, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    return { ok: false, message: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      message: [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || 'nginx reload failed',
    };
  }
  return { ok: true, message: null };
}

function safeEvidenceToken(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');
}

export function rollbackBackupPath(siteFile, rollbackTarget) {
  const token = safeEvidenceToken(rollbackTarget);
  if (!token) throw new Error('rollback target cannot produce an empty backup identity');
  return `${siteFile}.rollback.${token}`;
}

function siblingTempPath(target) {
  return path.join(
    path.dirname(target),
    `.${path.basename(target)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
}

function syncFileBestEffort(file) {
  const fd = fs.openSync(file, 'r+');
  try {
    fs.fsyncSync(fd);
  } catch (error) {
    if (!['EINVAL', 'ENOTSUP', 'EPERM'].includes(error.code)) throw error;
  } finally {
    fs.closeSync(fd);
  }
}

export function atomicReplaceFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = siblingTempPath(target);
  const previousMode = fs.existsSync(target) ? fs.statSync(target).mode : null;
  try {
    fs.copyFileSync(source, temp);
    if (previousMode !== null) fs.chmodSync(temp, previousMode);
    syncFileBestEffort(temp);
    fs.renameSync(temp, target);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}

function atomicWriteFile(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = siblingTempPath(target);
  try {
    fs.writeFileSync(temp, content, 'utf8');
    syncFileBestEffort(temp);
    fs.renameSync(temp, target);
  } finally {
    if (fs.existsSync(temp)) fs.rmSync(temp, { force: true });
  }
}

function verifiedArtifactEvidence(repoRoot, selection, artifactRoot) {
  const evidencePath = path.isAbsolute(selection.artifactEvidence)
    ? selection.artifactEvidence
    : path.join(repoRoot, selection.artifactEvidence);
  return loadArtifactEvidence(evidencePath, selection, { artifactRoot: artifactRoot ?? repoRoot });
}

export function applyNginxSite(repoRoot, profileId, domain, options = {}) {
  const selection = options.deploymentSelection;
  if (!selection) {
    throw new Error('deploymentSelection is required for nginx apply');
  }
  const artifactEvidence = verifiedArtifactEvidence(repoRoot, selection, options.artifactRoot);
  const plan = planDeploy(repoRoot, profileId, options);
  if (!plan.ok) {
    throw new Error(`deploy plan failed: ${(plan.errors ?? []).join('; ')}`);
  }
  const exposeItem = plan.expose.find((item) => item.domain === domain);
  if (!exposeItem) {
    throw new Error(`domain "${domain}" not found in deploy plan`);
  }

  const rendered = writeNginxRender(repoRoot, plan, domain, options);
  const inspection = inspectNginxConfig(fs.readFileSync(rendered.mainPath, 'utf8'));
  if (!inspection.valid) {
    throw new Error(`nginx config inspection failed: ${inspection.errors.join('; ')}`);
  }

  const siteFile =
    process.env.SDKWORK_DEPLOY_NGINX_SITE_FILE ?? options.siteFile ?? exposeItem.siteFile;
  const backupPath = rollbackBackupPath(siteFile, selection.rollbackTarget);
  if (!fs.existsSync(siteFile) && !selection.rollbackTarget.startsWith('forward-fix:')) {
    throw new Error('first nginx apply requires rollbackTarget forward-fix:<approved-boundary>');
  }
  if (fs.existsSync(siteFile)) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    atomicReplaceFile(siteFile, backupPath);
    atomicWriteFile(`${backupPath}.json`, `${JSON.stringify({
      rollbackTarget: selection.rollbackTarget,
      replacedByArtifactId: selection.artifactId,
      replacedByArtifactDigest: selection.artifactDigest,
      artifactEvidence: path.relative(repoRoot, artifactEvidence.path).replaceAll('\\', '/'),
      approvalRef: selection.approvalRef,
      profileId,
    }, null, 2)}\n`, 'utf8');
  }

  if (options.install !== false && siteFile !== rendered.mainPath) {
    fs.mkdirSync(path.dirname(siteFile), { recursive: true });
    atomicReplaceFile(rendered.mainPath, siteFile);
    for (const snippetPath of rendered.snippetOutputs) {
      const targetSnippet = path.join(
        options.snippetInstallDir ?? path.dirname(siteFile).replace(/sites-enabled.*/, 'snippets/sdkwork'),
        path.basename(snippetPath),
      );
      fs.mkdirSync(path.dirname(targetSnippet), { recursive: true });
      atomicReplaceFile(snippetPath, targetSnippet);
    }
  }

  const restorePrevious = () => {
    if (fs.existsSync(backupPath)) atomicReplaceFile(backupPath, siteFile);
    else if (fs.existsSync(siteFile)) fs.rmSync(siteFile);
  };

  const testResult = (options.runNginxTest ?? runNginxTest)(siteFile, options);
  if (!testResult.ok) {
    restorePrevious();
    throw new Error(`nginx -t failed: ${testResult.message}`);
  }

  let reloadResult = { ok: false, message: 'reload skipped' };
  if (options.reload === true || process.env.SDKWORK_DEPLOY_NGINX_RELOAD === 'true') {
    reloadResult = (options.runNginxReload ?? runNginxReload)(options);
    if (!reloadResult.ok) {
      restorePrevious();
      const restoreReload = (options.runNginxReload ?? runNginxReload)(options);
      throw new Error(
        `nginx reload failed: ${reloadResult.message}; previous reload: ${restoreReload.message ?? 'ok'}`,
      );
    }
  }

  return {
    plan,
    rendered,
    siteFile,
    backupPath: fs.existsSync(backupPath) ? backupPath : null,
    artifactEvidence: artifactEvidence.path,
    test: testResult,
    reload: reloadResult,
  };
}

export function rollbackNginxSite(repoRoot, profileId, domain, options = {}) {
  const selection = options.deploymentSelection;
  if (!selection) {
    throw new Error('deploymentSelection is required for nginx rollback');
  }
  const artifactEvidence = verifiedArtifactEvidence(repoRoot, selection, options.artifactRoot);
  const plan = planDeploy(repoRoot, profileId, options);
  if (!plan.ok) {
    throw new Error(`deploy plan failed: ${(plan.errors ?? []).join('; ')}`);
  }
  const exposeItem = plan.expose.find((item) => item.domain === domain);
  if (!exposeItem) throw new Error(`domain "${domain}" not found in deploy plan`);

  const siteFile = process.env.SDKWORK_DEPLOY_NGINX_SITE_FILE
    ?? options.siteFile
    ?? exposeItem.siteFile;
  const backupPath = rollbackBackupPath(siteFile, selection.rollbackTarget);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`rollback backup not found: ${backupPath}`);
  }
  const content = fs.readFileSync(backupPath, 'utf8');
  const inspection = inspectNginxConfig(content);
  if (!inspection.valid) {
    throw new Error(`rollback config inspection failed: ${inspection.errors.join('; ')}`);
  }

  const failedPath = `${siteFile}.failed.${safeEvidenceToken(selection.artifactId)}`;
  if (fs.existsSync(siteFile)) atomicReplaceFile(siteFile, failedPath);
  fs.mkdirSync(path.dirname(siteFile), { recursive: true });
  atomicReplaceFile(backupPath, siteFile);

  const testResult = (options.runNginxTest ?? runNginxTest)(siteFile, options);
  if (!testResult.ok) {
    if (fs.existsSync(failedPath)) atomicReplaceFile(failedPath, siteFile);
    throw new Error(`nginx rollback test failed: ${testResult.message}`);
  }
  let reloadResult = { ok: false, message: 'reload skipped' };
  if (options.reload === true || process.env.SDKWORK_DEPLOY_NGINX_RELOAD === 'true') {
    reloadResult = (options.runNginxReload ?? runNginxReload)(options);
    if (!reloadResult.ok) {
      if (fs.existsSync(failedPath)) atomicReplaceFile(failedPath, siteFile);
      const restoreReload = (options.runNginxReload ?? runNginxReload)(options);
      throw new Error(
        `nginx rollback reload failed: ${reloadResult.message}; previous reload: ${restoreReload.message ?? 'ok'}`,
      );
    }
  }
  return { plan, siteFile, backupPath, failedPath, artifactEvidence: artifactEvidence.path, test: testResult, reload: reloadResult };
}
