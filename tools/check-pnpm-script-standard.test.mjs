import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';

const CHECKER = path.resolve('tools/check-pnpm-script-standard.mjs');

function makeRepo(manifest, { includeStop = true, normalizeDevProfiles = true } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-pnpm-script-standard-'));
  const normalizedManifest = {
    ...manifest,
    scripts: { ...manifest.scripts },
  };
  if (normalizeDevProfiles && normalizedManifest.scripts.dev) {
    normalizedManifest.scripts.dev = 'pnpm dev:standalone';
    normalizedManifest.scripts['dev:standalone'] ??=
      'node scripts/sdkwork-command.mjs dev --deployment-profile standalone --environment development';
    normalizedManifest.scripts['dev:cloud'] ??=
      'node scripts/sdkwork-command.mjs dev --deployment-profile cloud --environment development';
  }
  if (includeStop && normalizedManifest.scripts.dev && !normalizedManifest.scripts.stop) {
    normalizedManifest.scripts.stop = 'node scripts/sdkwork-stop.mjs';
  }
  writeFileSync(path.join(root, 'package.json'), `${JSON.stringify(normalizedManifest, null, 2)}\n`);
  return root;
}

function runChecker(root, productPrefix = 'demo') {
  return spawnSync(
    process.execPath,
    [CHECKER, '--root', root, '--application-code-prefix', productPrefix],
    { cwd: path.resolve('.'), encoding: 'utf8' },
  );
}

function canonicalAssemblyCommand(root, toolName) {
  const toolPath = path.resolve('tools', toolName);
  const relative = path.relative(root, toolPath).replaceAll('\\', '/');
  const commandPath = path.isAbsolute(relative) || /^[a-z]:\//iu.test(relative)
    ? relative
    : relative.startsWith('.') ? relative : `./${relative}`;
  return `node ${commandPath} --root .`;
}

function writeApplicationManifest(root) {
  writeFileSync(path.join(root, 'sdkwork.app.config.json'), '{}\n');
}

function writeAssemblyScripts(root, commands = {}) {
  const packagePath = path.join(root, 'package.json');
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
  manifest.scripts['api:assembly:materialize'] = commands.materialize
    ?? canonicalAssemblyCommand(root, 'materialize-api-assembly.mjs');
  manifest.scripts['api:assembly:validate'] = commands.validate
    ?? canonicalAssemblyCommand(root, 'validate-api-assembly.mjs');
  writeFileSync(packagePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

describe('check-pnpm-script-standard', () => {
  it('rejects a development root without a scoped stop command', () => {
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
    }, { includeStop: false });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /roots with dev must expose a scoped stop command/);
  });

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
      },
    });

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pnpm script standard ok/);
  });

  it('accepts standard npm lifecycle hooks without treating them as public namespaces', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        predev: 'node scripts/preflight.mjs',
        build: 'node scripts/sdkwork-command.mjs build',
        prebuild: 'node scripts/preflight.mjs',
        test: 'node scripts/sdkwork-command.mjs test',
        pretest: 'node scripts/generate.mjs',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        prepublishOnly: 'pnpm verify',
      },
    });

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('does not impose application runtime commands on a declared node package root', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        build: 'tsc',
        test: 'node --test',
      },
    }, { normalizeDevProfiles: false });
    mkdirSync(path.join(root, 'specs'));
    writeFileSync(path.join(root, 'specs', 'component.spec.json'), JSON.stringify({
      kind: 'sdkwork.component.spec',
      component: { type: 'node-package' },
    }));
    writeFileSync(path.join(root, 'sdkwork.app.config.json'), JSON.stringify({
      kind: 'sdkwork.app',
      runtime: { family: 'web' },
    }));

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('requires API assembly commands for an application root without HTTP routes', () => {
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
    writeFileSync(path.join(root, 'sdkwork.app.config.json'), '{}\n');

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing required API assembly script "api:assembly:materialize"/u);
    assert.match(result.stderr, /missing required API assembly script "api:assembly:validate"/u);
  });

  it('accepts direct canonical API assembly commands for an application root', () => {
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
    writeApplicationManifest(root);
    writeAssemblyScripts(root);

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects application-owned API assembly wrappers', () => {
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
    writeApplicationManifest(root);
    writeAssemblyScripts(root, {
      materialize: 'node scripts/gateway/assembly-materialize.mjs',
      validate: 'node scripts/gateway/assembly-validate.mjs',
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /api:assembly:materialize: must directly invoke the canonical sdkwork-specs tool/u);
    assert.match(result.stderr, /api:assembly:validate: must directly invoke the canonical sdkwork-specs tool/u);
    assert.match(result.stderr, /application-owned wrappers are forbidden/u);
  });

  it('rejects API assembly commands that invoke the wrong canonical tool', () => {
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
    writeApplicationManifest(root);
    writeAssemblyScripts(root, {
      materialize: canonicalAssemblyCommand(root, 'validate-api-assembly.mjs'),
      validate: canonicalAssemblyCommand(root, 'materialize-api-assembly.mjs'),
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /api:assembly:materialize: must directly invoke the canonical sdkwork-specs tool/u);
    assert.match(result.stderr, /api:assembly:validate: must directly invoke the canonical sdkwork-specs tool/u);
  });

  it('treats a component deployment as a delegated app surface instead of an independent API root', () => {
    const root = makeRepo({
      name: 'sdkwork-demo-pc',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:standalone': 'pnpm exec sdkwork-app dev --root ../.. --deployment-profile standalone',
        'dev:cloud': 'pnpm exec sdkwork-app dev --root ../.. --deployment-profile cloud',
        stop: 'pnpm exec sdkwork-app stop --root ../..',
      },
    }, { normalizeDevProfiles: false });
    mkdirSync(path.join(root, 'etc'), { recursive: true });
    writeFileSync(path.join(root, 'sdkwork.app.config.json'), JSON.stringify({
      kind: 'sdkwork.app',
      runtime: { family: 'desktop' },
    }));
    writeFileSync(path.join(root, 'etc', 'sdkwork.deployment.config.json'), JSON.stringify({
      kind: 'sdkwork.component-deployment',
      parentDeploymentConfig: '../../../etc/sdkwork.deployment.config.json',
      parentTopologySpec: '../../../specs/topology.spec.json',
    }));

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /API assembly/u);
  });

  it('rejects platform cloud gateway commands in application roots', () => {
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
        'gateway:cloud:bundle': 'node scripts/sdkwork-command.mjs gateway bundle --deployment-profile cloud',
        'gateway:package:platform-config': 'node scripts/sdkwork-command.mjs gateway package --deployment-profile cloud',
      },
    });

    const result = runChecker(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /application roots must not expose platform cloud gateway commands/u);
    assert.match(result.stderr, /gateway:cloud:bundle/u);
    assert.match(result.stderr, /gateway:package:platform-config/u);
  });

  it('accepts deterministic standalone/cloud development and paired release/deploy phases', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:standalone': 'node scripts/sdkwork-command.mjs dev --deployment-profile standalone --environment development',
        'dev:cloud': 'node scripts/sdkwork-command.mjs dev --deployment-profile cloud --environment development',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'release:package:standalone': 'node scripts/sdkwork-command.mjs release package --deployment-profile standalone',
        'release:package:cloud': 'node scripts/sdkwork-command.mjs release package --deployment-profile cloud',
        'deploy:plan:standalone': 'node scripts/sdkwork-command.mjs deploy plan --deployment-profile standalone',
        'deploy:plan:cloud': 'node scripts/sdkwork-command.mjs deploy plan --deployment-profile cloud',
      },
    });

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('requires only release profiles declared by fixed workflow targets', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:standalone': 'node scripts/sdkwork-command.mjs dev --deployment-profile standalone --environment development',
        'dev:cloud': 'node scripts/sdkwork-command.mjs dev --deployment-profile cloud --environment development',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'release:package:cloud': 'pnpm exec sdkwork-app release:package --deployment-profile cloud',
      },
    });
    writeFileSync(path.join(root, 'sdkwork.workflow.json'), JSON.stringify({
      targets: [{ deploymentProfile: 'cloud' }],
    }));

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('accepts private SDKWork lifecycle hooks behind the canonical public facade', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:standalone': 'pnpm exec sdkwork-app dev --deployment-profile standalone',
        'dev:cloud': 'pnpm exec sdkwork-app dev --deployment-profile cloud',
        build: 'pnpm exec sdkwork-app build',
        test: 'pnpm exec sdkwork-app test',
        check: 'pnpm exec sdkwork-app check',
        verify: 'pnpm exec sdkwork-app verify',
        clean: 'pnpm exec sdkwork-app clean',
        '_sdkwork:dev:standalone': 'node scripts/demo-dev.mjs --legacy-layout',
        '_sdkwork:dev:cloud': 'vite --mode cloud',
        '_sdkwork:stop': 'node scripts/demo-stop.mjs',
        '_sdkwork:build': 'cargo build --release',
        '_sdkwork:release:package': 'node scripts/demo-package.mjs',
      },
    });

    const result = runChecker(root);
    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects malformed private SDKWork hook names', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        '_sdkwork:custom': 'node scripts/custom.mjs',
      },
    });

    const result = runChecker(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /private SDKWork hooks must use an approved _sdkwork lifecycle or topology namespace/u);
  });

  it('rejects private development hooks without a scoped private stop hook', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        build: 'pnpm exec sdkwork-app build',
        test: 'pnpm exec sdkwork-app test',
        check: 'pnpm exec sdkwork-app check',
        verify: 'pnpm exec sdkwork-app verify',
        clean: 'pnpm exec sdkwork-app clean',
        '_sdkwork:dev:standalone': 'node scripts/dev.mjs',
      },
    });

    const result = runChecker(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /private _sdkwork:dev hooks require a scoped _sdkwork:stop hook/u);
  });

  it('accepts one runtime-configurable client release lane', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:standalone': 'node scripts/sdkwork-command.mjs dev --deployment-profile standalone --environment development',
        'dev:cloud': 'node scripts/sdkwork-command.mjs dev --deployment-profile cloud --environment development',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'release:package:desktop:runtime-configurable': 'node scripts/sdkwork-command.mjs release package --target desktop --profile-binding runtime-configurable',
      },
    });

    const result = runChecker(root);
    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects missing or ambiguous development profile entrypoints', () => {
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
    }, { normalizeDevProfiles: false });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing required root script "dev:standalone"/);
    assert.match(result.stderr, /missing required root script "dev:cloud"/);
    assert.match(result.stderr, /bare dev must directly delegate to "dev:standalone"/);
  });

  it('rejects cloud development that selects a local database', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:standalone': 'node scripts/sdkwork-command.mjs dev --deployment-profile standalone --environment development',
        'dev:cloud': 'node scripts/sdkwork-command.mjs dev --deployment-profile cloud --environment development --database postgres',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /remote cloud development must not select or bootstrap a local database/);
  });

  it('rejects target-specific cloud development scripts with a database axis', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        'dev:browser:postgres:cloud': 'node scripts/sdkwork-command.mjs dev --target browser --database postgres --deployment-profile cloud --environment development',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cloud development consumes deployed APIs and must not include a database axis/);
  });

  it('rejects profile-first lifecycle names and unpaired profile phases', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'release:cloud:package': 'node scripts/sdkwork-command.mjs release package --deployment-profile cloud',
        'release:package:cloud': 'node scripts/sdkwork-command.mjs release package --deployment-profile cloud',
        'deploy:cloud:apply': 'node scripts/sdkwork-command.mjs deploy apply --deployment-profile cloud',
        'deploy:apply:cloud': 'node scripts/sdkwork-command.mjs deploy apply --deployment-profile cloud',
      },
    });

    const result = runChecker(root);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /release:cloud:package: use release:<phase>/);
    assert.match(result.stderr, /deploy:cloud:apply: use deploy:<phase>/);
    assert.match(result.stderr, /release:package: exposed lifecycle phase must provide a standalone profile variant/);
    assert.match(result.stderr, /deploy:apply: exposed lifecycle phase must provide a standalone profile variant/);
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

  it('ignores vendored upstream package scripts', () => {
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
    const externalRoot = path.join(root, 'external', 'upstream');
    mkdirSync(externalRoot, { recursive: true });
    writeFileSync(
      path.join(externalRoot, 'package.json'),
      `${JSON.stringify({ scripts: { prepare: 'node upstream-build.mjs', 'dev:web': 'vite' } }, null, 2)}\n`,
    );

    const result = runChecker(root);

    assert.equal(result.status, 0, result.stderr);
  });

  it('accepts browser and desktop dev defaults that delegate to postgres standalone profiles', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:browser',
        'dev:browser': 'pnpm dev:browser:postgres:standalone',
        'dev:browser:postgres:standalone': 'node scripts/demo-dev.mjs --target browser --database postgres --deployment-profile standalone',
        'dev:desktop': 'pnpm dev:desktop:postgres:standalone',
        'dev:desktop:postgres:standalone': 'node scripts/demo-dev.mjs --target desktop --database postgres --deployment-profile standalone',
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
        'dev:browser': 'node scripts/demo-dev.mjs --target browser --database sqlite --deployment-profile standalone',
        'dev:desktop': 'node scripts/demo-dev.mjs --target desktop --database postgres --deployment-profile cloud',
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

  it('rejects retired service layout tokens in dev scripts and command values', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:browser',
        'dev:browser': 'pnpm dev:browser:postgres:split-services:standalone',
        'dev:browser:postgres:split-services:standalone': 'node scripts/demo-dev.mjs --target browser --database postgres --service-layout split-services --deployment-profile standalone',
        'dev:desktop': 'node scripts/demo-dev.mjs --target desktop --database postgres --service-layout unified-process --deployment-profile standalone',
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
      /dev:browser:postgres:split-services:standalone: retired token "split-services" must not appear in public scripts/,
    );
    assert.match(
      result.stderr,
      /dev:desktop: command value uses retired deployment token "service-layout"/,
    );
  });

  it('rejects browser and desktop dev defaults that use retired hosting flags', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'node scripts/sdkwork-command.mjs dev',
        'dev:browser': 'node scripts/demo-dev.mjs --target browser --database postgres --hosting self-hosted',
        'dev:desktop': 'node scripts/demo-dev.mjs --target desktop --database postgres --hosting cloud-hosted',
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

  it('rejects application-code-prefixed public scripts and gateway profile-first names', () => {
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
    assert.match(result.stderr, /demo:dev: application-code-prefixed public root scripts are forbidden/);
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
        'dev:browser': 'pnpm dev:browser:postgres:standalone',
        'dev:browser:postgres:standalone': 'node scripts/demo-dev.mjs --target browser --database postgres --deployment-profile standalone',
        'dev:desktop': 'pnpm dev:desktop:postgres:standalone',
        'dev:desktop:postgres:standalone': 'node scripts/demo-dev.mjs --target desktop --database postgres --deployment-profile standalone',
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
    assert.match(result.stderr, /README\.md:3: pnpm demo:dev: application-code-prefixed command examples are forbidden/);
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
        'api:assembly:materialize': 'node tools/materialize.mjs',
        'api:assembly:validate': 'node tools/validate.mjs',
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
    writeAssemblyScripts(root);

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /sdkwork\.app\.config\.json: devApp\.build\.targets\.0\.command: pnpm demo:build: application-code-prefixed command examples are forbidden/,
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
      /scripts[/\\]dev\.mjs:3: pnpm demo:dev: application-code-prefixed command examples are forbidden/,
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
        '- pnpm workspace configuration is owned by `pnpm-workspace.yaml`.',
        '- `pnpm check:pnpm-script-standard`: validate pnpm command standardization.',
      ].join('\n'),
    );

    const result = runChecker(root, 'demo');

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects application cloud gateway commands and requires API assembly commands for route owners', () => {
    const root = makeRepo({
      name: 'sdkwork-demo',
      scripts: {
        dev: 'pnpm dev:standalone',
        build: 'node scripts/sdkwork-command.mjs build',
        test: 'node scripts/sdkwork-command.mjs test',
        check: 'node scripts/sdkwork-command.mjs check',
        verify: 'node scripts/sdkwork-command.mjs verify',
        clean: 'node scripts/sdkwork-command.mjs clean',
        'gateway:run:cloud': 'cargo run -p sdkwork-api-cloud-gateway',
      },
    });
    writeFileSync(
      path.join(root, 'Cargo.toml'),
      '[workspace]\nmembers = ["crates/sdkwork-routes-demo-app-api"]\n',
    );

    const result = runChecker(root, 'demo');

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not expose platform cloud gateway commands/u);
    assert.match(result.stderr, /missing required API assembly script "api:assembly:materialize"/u);
    assert.match(result.stderr, /missing required API assembly script "api:assembly:validate"/u);
  });
});
