import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';

const CHECKER = path.resolve('tools/check-pnpm-script-standard.mjs');

function makeRepo(manifest) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-pnpm-script-standard-'));
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return root;
}

function runChecker(root, productPrefix = 'demo') {
  return spawnSync(
    process.execPath,
    [CHECKER, '--root', root, '--product-prefix', productPrefix],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  );
}

describe('check-pnpm-script-standard', () => {
  it('accepts a repository root with canonical scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'gateway:package:cloud': 'node scripts/sdkwork-command.mjs gateway package --deployment-profile cloud',
      },
    });

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pnpm script standard ok/);
  });

  it('accepts UTF-8 BOM JSON command manifests', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const specsDir = path.join(root, 'specs');
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(
      path.join(specsDir, 'component.spec.json'),
      `\uFEFF${JSON.stringify({ scripts: { check: 'pnpm check' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('accepts browser and desktop dev defaults that delegate to postgres standalone profiles', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:browser',
        'dev:browser': 'pnpm dev:browser:postgres:unified-process:standalone',
        'dev:browser:postgres:unified-process:standalone': 'node scripts/demo-dev.mjs --target browser --database postgres --service-layout unified-process --deployment-profile standalone',
        'dev:desktop': 'pnpm dev:desktop:postgres:unified-process:standalone',
        'dev:desktop:postgres:unified-process:standalone': 'node scripts/demo-dev.mjs --target desktop --database postgres --service-layout unified-process --deployment-profile standalone',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects browser and desktop dev defaults that do not resolve to postgres standalone profiles', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        'dev:browser': 'node scripts/demo-dev.mjs --target browser --database sqlite --service-layout unified-process --deployment-profile standalone',
        'dev:desktop': 'node scripts/demo-dev.mjs --target desktop --database postgres --service-layout unified-process --deployment-profile cloud',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /dev:browser: default dev runtime must resolve to database "postgres"/,
    );
    assert.match(
      result.stderr,
      /dev:desktop: default dev runtime must resolve to deployment profile "standalone"/,
    );
  });

  it('rejects browser and desktop dev defaults that do not resolve to unified-process service layout', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:browser',
        'dev:browser': 'pnpm dev:browser:postgres:split-services:standalone',
        'dev:browser:postgres:split-services:standalone': 'node scripts/demo-dev.mjs --target browser --database postgres --service-layout split-services --deployment-profile standalone',
        'dev:desktop': 'node scripts/demo-dev.mjs --target desktop --database postgres --deployment-profile standalone',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /dev:browser: default dev runtime must resolve to service layout "unified-process"/,
    );
    assert.match(
      result.stderr,
      /dev:desktop: default dev runtime must resolve to service layout "unified-process"/,
    );
  });

  it('rejects browser and desktop dev defaults that use retired hosting flags', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        'dev:browser': 'node scripts/demo-dev.mjs --target browser --database postgres --service-layout unified-process --hosting self-hosted',
        'dev:desktop': 'node scripts/demo-dev.mjs --target desktop --database postgres --service-layout unified-process --hosting cloud-hosted',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /dev:browser: default dev runtime must use --deployment-profile standalone instead of retired --hosting/,
    );
    assert.match(
      result.stderr,
      /dev:desktop: default dev runtime must use --deployment-profile standalone instead of retired --hosting/,
    );
  });

  it('rejects retired deployment flags in root script command values', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build --hosting self-hosted',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'release:package': 'node scripts/release.mjs --deploymentMode cloud-hosted',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /build: command value uses retired deployment token "--hosting"/,
    );
    assert.match(
      result.stderr,
      /release:package: command value uses retired deployment token "deploymentMode"/,
    );
  });

  it('rejects missing required root scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing required root script "build"/);
    assert.match(result.stderr, /missing required root script "verify"/);
  });

  it('rejects product-prefixed public scripts and gateway profile-first names', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'demo:dev': 'node scripts/demo-dev.mjs',
        'gateway:cloud:bundle': 'node scripts/gateway-cloud-bundle.mjs bundle',
      },
    });

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /demo:dev: first segment "demo" is not a standard public namespace/);
    assert.match(result.stderr, /demo:dev: product-prefixed public root scripts are forbidden/);
    assert.match(result.stderr, /gateway:cloud:bundle: use gateway:<action>\[:deploymentProfile\]/);
  });

  it('rejects platform-first root runtime command aliases', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'desktop:dev': 'pnpm dev:desktop',
        'tauri:dev': 'pnpm dev:desktop',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /desktop:dev: use action-first runtime target script names such as dev:desktop/,
    );
    assert.match(
      result.stderr,
      /tauri:dev: use action-first runtime target script names such as dev:desktop/,
    );
  });

  it('rejects tauri as a runtime target suffix in public script names', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'dev:tauri': 'pnpm dev:desktop',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /dev:tauri: use runtime target "desktop" instead of tool alias "tauri", for example dev:desktop/,
    );
  });

  it('rejects nonstandard dev runtime target suffixes in root scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:browser',
        'dev:browser': 'pnpm dev:browser:postgres:unified-process:standalone',
        'dev:browser:postgres:unified-process:standalone': 'node scripts/demo-dev.mjs --target browser --database postgres --service-layout unified-process --deployment-profile standalone',
        'dev:desktop': 'pnpm dev:desktop:postgres:unified-process:standalone',
        'dev:desktop:postgres:unified-process:standalone': 'node scripts/demo-dev.mjs --target desktop --database postgres --service-layout unified-process --deployment-profile standalone',
        'dev:portal': 'node scripts/demo-dev.mjs --target browser-only',
        'dev:service': 'node scripts/demo-dev.mjs --target service',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /dev:portal: "portal" is not a standard dev runtime target; use one of/,
    );
    assert.match(
      result.stderr,
      /dev:service: "service" is not a standard dev runtime target; use one of/,
    );
  });

  it('rejects mobile, mini-program, and container platform-first root command aliases', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'android:build': 'gradle build',
        'flutter:dev': 'flutter run',
        'mini-program:build': 'node scripts/build-mini-program.mjs',
        'docker:build': 'docker build .',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /android:build: use action-first runtime target script names such as build:android-native/,
    );
    assert.match(
      result.stderr,
      /flutter:dev: use action-first runtime target script names such as dev:flutter-android/,
    );
    assert.match(
      result.stderr,
      /mini-program:build: use action-first runtime target script names such as build:mini-program/,
    );
    assert.match(
      result.stderr,
      /docker:build: use action-first runtime target script names such as build:container/,
    );
  });

  it('ignores generated package manifests while scanning local packages', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const generatedDir = path.join(root, 'sdks/demo/generated/server-openapi');
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(
      path.join(generatedDir, 'package.json'),
      `${JSON.stringify({ name: 'generated', scripts: { 'demo:dev': 'vite' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects package-local scripts that keep retired public namespaces', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const appDir = path.join(root, 'apps/demo-pc');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({ name: 'demo-pc', scripts: { 'product:check': 'pnpm typecheck && pnpm build' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /apps[/\\]demo-pc[/\\]package\.json#product:check: first segment "product" is not a standard local namespace/,
    );
  });

  it('rejects retired deployment flags in package-local command values', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const appDir = path.join(root, 'apps/demo-pc');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({ name: 'demo-pc', scripts: { dev: 'vite --hosting cloud-hosted' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /apps[/\\]demo-pc[/\\]package\.json#dev: command value uses retired deployment token "--hosting"/,
    );
  });

  it('rejects package-local platform-first runtime command aliases', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const appDir = path.join(root, 'apps/demo-pc');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({ name: 'demo-pc', scripts: { 'browser:dev': 'vite', 'desktop:build': 'tauri build' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /apps[/\\]demo-pc[/\\]package\.json#browser:dev: use action-first runtime target script names such as dev:browser/,
    );
    assert.match(
      result.stderr,
      /apps[/\\]demo-pc[/\\]package\.json#desktop:build: use action-first runtime target script names such as build:desktop/,
    );
  });

  it('rejects nonstandard dev runtime target suffixes in package-local scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const appDir = path.join(root, 'apps/demo-pc');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({ name: 'demo-pc', scripts: { 'dev:service': 'node service.mjs', 'dev:desktop:native-host': 'tauri dev' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /apps[/\\]demo-pc[/\\]package\.json#dev:service: "service" is not a standard dev runtime target/,
    );
    assert.match(
      result.stderr,
      /apps[/\\]demo-pc[/\\]package\.json#dev:desktop:native-host: "native-host" is not a standard dev axis value/,
    );
  });

  it('rejects package-local mobile and mini-program platform-first command aliases', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const appDir = path.join(root, 'apps/demo-mobile');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({ name: 'demo-mobile', scripts: { 'ios:build': 'xcodebuild', 'harmony:dev': 'hvigorw', 'mini-program:build': 'node scripts/mp.mjs' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /apps[/\\]demo-mobile[/\\]package\.json#ios:build: use action-first runtime target script names such as build:ios-native/,
    );
    assert.match(
      result.stderr,
      /apps[/\\]demo-mobile[/\\]package\.json#harmony:dev: use action-first runtime target script names such as dev:harmony-native/,
    );
    assert.match(
      result.stderr,
      /apps[/\\]demo-mobile[/\\]package\.json#mini-program:build: use action-first runtime target script names such as build:mini-program/,
    );
  });

  it('accepts package-local maintenance helper scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const appDir = path.join(root, 'apps/demo-pc');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(appDir, 'package.json'),
      `${JSON.stringify({ name: 'demo-pc', scripts: { 'deps:check': 'node scripts/check-deps.mjs' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects nonstandard pnpm command examples in markdown docs', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    writeFileSync(
      path.join(root, 'README.md'),
      [
        '# Demo',
        '',
        '- Use `pnpm demo:dev` for local development.',
        '- Use `pnpm server:dev` for backend-only development.',
        '- Use `pnpm gateway:cloud:bundle` for cloud packaging.',
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /README\.md:3: pnpm demo:dev: product-prefixed command examples are forbidden/);
    assert.match(result.stderr, /README\.md:4: pnpm server:dev: first segment "server" is not a standard public namespace/);
    assert.match(result.stderr, /README\.md:5: pnpm gateway:cloud:bundle: use gateway:<action>\[:deploymentProfile\]/);
  });

  it('rejects retired deployment flags in markdown pnpm command examples', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    writeFileSync(
      path.join(root, 'README.md'),
      [
        '# Demo',
        '',
        '- Use `pnpm dev:browser -- --hosting self-hosted` for local development.',
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /README\.md:3: pnpm dev:browser: command example uses retired deployment token "--hosting"/,
    );
  });

  it('rejects nonstandard pnpm commands in active command json files', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    writeFileSync(
      path.join(root, 'sdkwork.app.config.json'),
      `${JSON.stringify({ devApp: { build: { targets: [{ command: 'pnpm demo:build' }, { command: 'pnpm tauri:dev' }] } } }, null, 2)}\n`,
    );
    const specsDir = path.join(root, 'specs');
    mkdirSync(specsDir, { recursive: true });
    writeFileSync(
      path.join(specsDir, 'topology.spec.json'),
      `${JSON.stringify({ scripts: { pnpm: { portal: { script: 'pnpm browser:dev' } } } }, null, 2)}\n`,
    );

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /sdkwork\.app\.config\.json: devApp\.build\.targets\.0\.command: pnpm demo:build: product-prefixed command examples are forbidden/,
    );
    assert.match(
      result.stderr,
      /sdkwork\.app\.config\.json: devApp\.build\.targets\.1\.command: pnpm tauri:dev: use action-first runtime target script names such as dev:desktop/,
    );
    assert.match(
      result.stderr,
      /specs[/\\]topology\.spec\.json: scripts\.pnpm\.portal\.script: pnpm browser:dev: use action-first runtime target script names such as dev:browser/,
    );
  });

  it('rejects retired deployment flags in active command json files', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    writeFileSync(
      path.join(root, 'sdkwork.workflow.json'),
      `${JSON.stringify({ targets: [{ command: 'pnpm dev:desktop -- --hosting cloud-hosted' }] }, null, 2)}\n`,
    );

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /sdkwork\.workflow\.json: targets\.0\.command: pnpm dev:desktop: command example uses retired deployment token "--hosting"/,
    );
  });

  it('rejects nonstandard pnpm commands in active runner scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const scriptsDir = path.join(root, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(
      path.join(scriptsDir, 'dev.mjs'),
      [
        'const args = ["--dir", "apps/demo-pc", "browser:dev"];',
        'const command = "pnpm server:dev";',
        'const legacy = ["demo:dev"];',
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /scripts[/\\]dev\.mjs:1: pnpm browser:dev: use action-first runtime target script names such as dev:browser/,
    );
    assert.match(
      result.stderr,
      /scripts[/\\]dev\.mjs:2: pnpm server:dev: first segment "server" is not a standard public namespace/,
    );
    assert.match(
      result.stderr,
      /scripts[/\\]dev\.mjs:3: pnpm demo:dev: product-prefixed command examples are forbidden/,
    );
  });

  it('ignores non-command colon strings in active runner scripts', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    const scriptsDir = path.join(root, 'scripts');
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(
      path.join(scriptsDir, 'dev.mjs'),
      [
        "import fs from 'node:fs';",
        "const now = '2026-01-01T00:00:00Z';",
        "const schema = 'https://example.test/schema:sdkwork';",
        "const standardScript = 'dev:desktop';",
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.equal(result.status, 0, result.stderr);
  });

  it('ignores native pnpm commands in markdown docs', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    writeFileSync(
      path.join(root, 'README.md'),
      [
        '# Demo',
        '',
        '- Install with `pnpm install`.',
        '- Add packages with `pnpm add @sdkwork/demo`.',
        '- Run a binary with `pnpm exec sdkgen --help`.',
        '- Requires pnpm 10.x.',
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.equal(result.status, 0, result.stderr);
  });

  it('ignores prose that describes pnpm command standards without naming a script', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });
    writeFileSync(
      path.join(root, 'AGENTS.md'),
      [
        '# Repository Guidelines',
        '',
        '- pnpm command changes follow `../sdkwork-specs/PNPM_SCRIPT_SPEC.md`.',
        '- Use canonical root pnpm commands from `PNPM_SCRIPT_SPEC.md`.',
        '- `pnpm check:pnpm-script-standard`: validate pnpm command standardization.',
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.equal(result.status, 0, result.stderr);
  });
});
