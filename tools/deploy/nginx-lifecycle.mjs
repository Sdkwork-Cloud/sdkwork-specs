import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planDeploy } from './plan.mjs';
import { writeNginxRender } from './nginx-render.mjs';

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

export function applyNginxSite(repoRoot, profileId, domain, options = {}) {
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
  const backupPath = `${siteFile}.bak`;
  if (fs.existsSync(siteFile) && options.backup !== false) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(siteFile, backupPath);
  }

  if (options.install !== false && siteFile !== rendered.mainPath) {
    fs.mkdirSync(path.dirname(siteFile), { recursive: true });
    fs.copyFileSync(rendered.mainPath, siteFile);
    for (const snippetPath of rendered.snippetOutputs) {
      const targetSnippet = path.join(
        options.snippetInstallDir ?? path.dirname(siteFile).replace(/sites-enabled.*/, 'snippets/sdkwork'),
        path.basename(snippetPath),
      );
      fs.mkdirSync(path.dirname(targetSnippet), { recursive: true });
      fs.copyFileSync(snippetPath, targetSnippet);
    }
  }

  let testResult = { ok: true, message: null };
  if (options.test !== false && process.env.SDKWORK_DEPLOY_NGINX_SKIP_TEST !== 'true') {
    testResult = runNginxTest(siteFile, options);
    if (!testResult.ok && process.env.SDKWORK_DEPLOY_NGINX_TEST_REQUIRED === 'true') {
      throw new Error(`nginx -t failed: ${testResult.message}`);
    }
  }

  let reloadResult = { ok: false, message: 'reload skipped' };
  if (options.reload === true || process.env.SDKWORK_DEPLOY_NGINX_RELOAD === 'true') {
    reloadResult = runNginxReload(options);
    if (!reloadResult.ok) {
      throw new Error(`nginx reload failed: ${reloadResult.message}`);
    }
  }

  return {
    plan,
    rendered,
    siteFile,
    backupPath: fs.existsSync(backupPath) ? backupPath : null,
    test: testResult,
    reload: reloadResult,
  };
}
