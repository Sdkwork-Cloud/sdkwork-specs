#!/usr/bin/env node

/**
 * Canonical browser PC/H5 Vite build output layout helpers.
 * Authority: APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md §2.2,
 * FRONTEND_CODE_SPEC.md §7, ENVIRONMENT_SPEC.md §5.1.
 */

export const LIFECYCLE_ENVIRONMENTS = Object.freeze([
  'development',
  'test',
  'staging',
  'production',
]);

/** Dist directory segment aliases (not profile-id substitutes). */
export const BROWSER_DIST_ENV_ALIASES = Object.freeze({
  development: 'dev',
  test: 'test',
  staging: 'staging',
  production: 'prod',
});

export function browserDistEnvAlias(environment) {
  const alias = BROWSER_DIST_ENV_ALIASES[String(environment ?? '').trim()];
  if (!alias) {
    throw new Error(
      `browser dist environment must be one of ${LIFECYCLE_ENVIRONMENTS.join(', ')}`,
    );
  }
  return alias;
}

/**
 * Relative Vite `build.outDir` for one browser application root.
 * Example: `dist/prod` for production; never a bare `dist/`.
 */
export function resolveBrowserDistOutDir(environment) {
  return `dist/${browserDistEnvAlias(environment)}`;
}

/**
 * Absolute build output directory under an application root.
 */
export function resolveBrowserDistAbsoluteRoot(applicationRoot, environment) {
  return `${String(applicationRoot).replace(/[\\/]+$/u, '')}/${resolveBrowserDistOutDir(environment)}`;
}

/**
 * Installed Adaptive Web SPA roots (binary-package). Environment is selected
 * at packaging time; install paths do not retain dist/{alias} segments.
 */
export function resolveInstalledBrowserWebRoot(runtimeCode, architecture) {
  const code = String(runtimeCode ?? '').trim();
  const arch = String(architecture ?? '').trim();
  if (!code) {
    throw new Error('runtimeCode is required');
  }
  if (arch !== 'pc' && arch !== 'h5' && arch !== 'static') {
    throw new Error('architecture must be pc, h5, or static');
  }
  return `/usr/share/sdkwork/${code}/web/${arch}`;
}
