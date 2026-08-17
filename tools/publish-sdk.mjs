#!/usr/bin/env node
/**
 * SDKWork SDK publish orchestrator.
 *
 * Discovers SDK families across the workspace, filters by repo / family /
 * language, runs build + version-check + publish for each, and emits a JSON
 * report as release evidence (RELEASE_SPEC.md §4).
 *
 * Authority:
 *  - SDK_SPEC.md §1 (owner-first, generated-only)
 *  - SDK_MANIFEST_SPEC.md §3 (family-root manifest SSOT)
 *  - SDK_PACKAGE_NAMING_SPEC.md §1.1 (consumer-only publish; transport forbidden)
 *  - RELEASE_SPEC.md §2 (SDK release type) §4 (release evidence)
 *
 * Usage:
 *   pnpm publish:sdk -- --dry-run
 *   pnpm publish:sdk -- --repo sdkwork-iam --language typescript
 *   pnpm publish:sdk -- --family sdkwork-im-app-sdk --language all
 *
 * Credentials are read from the environment, never from manifest or config:
 *   NPM_TOKEN, CARGO_REGISTRY_TOKEN, MAVEN_USERNAME, MAVEN_PASSWORD,
 *   MAVEN_GPG_PASSPHRASE, PUB_DEV_TOKEN, PYPI_TOKEN, GITHUB_TOKEN
 */
import { parseArgs } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  discoverPublishableSdks,
  filterPublishable,
  describePublishable,
  SUPPORTED_LANGUAGES,
} from './lib/sdk-publish/discover-publishable-sdks.mjs';
import { getPublisher } from './lib/sdk-publish/publisher-registry.mjs';
import { checkRemoteVersion } from './lib/sdk-publish/version-check.mjs';
import { ReportBuilder } from './lib/sdk-publish/report.mjs';
import { isPreRelease, toDisplayPath } from './lib/sdk-publish/util.mjs';

const SPECS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseCli() {
  const { values } = parseArgs({
    options: {
      workspace: { type: 'string', default: path.resolve(SPECS_ROOT, '..') },
      repo: { type: 'string' },
      family: { type: 'string' },
      language: { type: 'string', default: 'all' },
      'dry-run': { type: 'boolean', default: false },
      tag: { type: 'string', default: 'latest' },
      access: { type: 'string', default: 'public' },
      'skip-build': { type: 'boolean', default: false },
      'allow-pre-release': { type: 'boolean', default: false },
      'skip-standard-check': { type: 'boolean', default: false },
      bump: { type: 'string' },
      report: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    allowNegative: true,
  });
  return values;
}

function printHelp() {
  console.log(`sdkwork publish-sdk — multi-language SDK publish orchestrator

Usage:
  node tools/publish-sdk.mjs [options]
  pnpm publish:sdk -- [options]

Options:
  --workspace <path>            workspace root (default: parent of sdkwork-specs)
  --repo <name>                 limit to one repository (e.g. sdkwork-iam)
  --family <stem>               limit to one SDK family (e.g. sdkwork-iam-app-sdk)
  --language <lang|all>         one of: ${SUPPORTED_LANGUAGES.join(', ')}, or all (default)
  --dry-run                     discover + build + version-check, skip publish
  --tag <npm-dist-tag>          npm dist-tag (default: latest)
  --access <public|restricted>  npm scoped package access (default: public)
  --skip-build                  skip per-package build step
  --allow-pre-release           allow publishing 0.x / -rc / -beta versions
  --skip-standard-check         skip pre-publish check-sdk-standard gate
  --bump <patch|minor|major>    bump version before publishing (writes package.json)
  --report <path>               write JSON report to this path

Credentials (env):
  NPM_TOKEN                     TypeScript (npmjs.com)
  CARGO_REGISTRY_TOKEN          Rust (crates.io)
  MAVEN_USERNAME                Java (Maven Central)
  MAVEN_PASSWORD                Java (Maven Central)
  MAVEN_GPG_PASSPHRASE          Java (Maven Central signing)
  PUB_DEV_TOKEN                 Flutter/Dart (pub.dev)
  PYPI_TOKEN                    Python (PyPI)
  GITHUB_TOKEN                  Go (GitHub Release, optional)

Examples:
  pnpm publish:sdk -- --dry-run
  pnpm publish:sdk -- --repo sdkwork-iam --language typescript
  pnpm publish:sdk -- --family sdkwork-im-app-sdk --language all --report ./publish-report.json
`);
}

async function main() {
  const opts = parseCli();
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (opts.language !== 'all' && !SUPPORTED_LANGUAGES.includes(opts.language)) {
    console.error(`unknown language: ${opts.language}`);
    console.error(`supported: ${SUPPORTED_LANGUAGES.join(', ')}`);
    process.exit(2);
  }

  if (opts.bump && !['patch', 'minor', 'major'].includes(opts.bump)) {
    console.error(`invalid --bump value: ${opts.bump} (must be patch|minor|major)`);
    process.exit(2);
  }

  const workspace = path.resolve(opts.workspace);
  const mode = opts['dry-run'] ? 'dry-run' : 'publish';
  const startedAt = new Date().toISOString();
  const report = new ReportBuilder({ mode, workspace, startedAt });

  console.log(`sdkwork publish-sdk (${mode})`);
  console.log(`  workspace: ${toDisplayPath(workspace)}`);
  console.log(`  filters:   repo=${opts.repo ?? '*'} family=${opts.family ?? '*'} language=${opts.language}`);

  const all = discoverPublishableSdks(workspace);
  const targets = filterPublishable(all, {
    repo: opts.repo,
    family: opts.family,
    language: opts.language,
  });

  console.log(`  discovered: ${all.length} package(s), ${targets.length} after filters`);
  if (targets.length === 0) {
    console.log('nothing to publish');
    report.printConsole();
    if (opts.report) report.write(path.resolve(opts.report));
    process.exit(0);
  }

  for (const item of targets) {
    console.log('');
    console.log(`• ${describePublishable(item)}`);
    await processOne(item, opts, report);
  }

  report.printConsole();
  if (opts.report) {
    const reportPath = path.resolve(opts.report);
    report.write(reportPath);
    console.log(`\nreport written: ${toDisplayPath(reportPath)}`);
  }

  const s = report.summary();
  process.exit(s.failed > 0 ? 1 : 0);
}

async function processOne(item, opts, report) {
  const publisher = getPublisher(item.language);
  if (!publisher) {
    report.add(makeItem(item, '', '', 'failed', 'no publisher registered', 0));
    return;
  }

  const detected = publisher.detect(item.familyRoot, item.manifest);
  if (!detected) {
    report.add(makeItem(item, '', '', 'skipped', 'no publishable package detected', 0));
    console.log(`  skipped: no publishable package detected`);
    return;
  }

  const { packageName, version: detectedVersion, packagePath } = detected;
  console.log(`  package: ${packageName}@${detectedVersion}`);

  // Optional version bump before publish. Used to republish when the existing
  // version on the registry is broken (npm forbids overwriting versions).
  let version = detectedVersion;
  if (opts.bump) {
    if (typeof publisher.bumpPackageVersion !== 'function') {
      report.add(makeItem(item, packageName, version, 'failed', `publisher does not support --bump (${item.language})`, 0));
      console.log(`  failed: --bump not supported for ${item.language}`);
      return;
    }
    const bumpResult = publisher.bumpPackageVersion(packagePath, opts.bump);
    if (!bumpResult.ok) {
      report.add(makeItem(item, packageName, version, 'failed', bumpResult.detail, 0));
      console.log(`  failed: bump failed: ${bumpResult.detail}`);
      return;
    }
    version = bumpResult.version;
    console.log(`  bumped:  ${detectedVersion} → ${version}`);
  }

  if (!opts['allow-pre-release'] && isPreRelease(version)) {
    report.add(makeItem(item, packageName, version, 'skipped', 'pre-release version (use --allow-pre-release)', 0));
    console.log(`  skipped: pre-release version`);
    return;
  }

  if (!publisher.hasCredentials(process.env) && !opts['dry-run']) {
    report.add(makeItem(item, packageName, version, 'skipped', `missing credential: ${publisher.credentialName()}`, 0));
    console.log(`  skipped: missing credential (${publisher.credentialName()})`);
    return;
  }

  // Remote version probe.
  const probe = await checkRemoteVersion(item.language, packageName, version, {
    repoUrl: detected.repoUrl,
  });
  if (probe.exists === true) {
    report.add(makeItem(item, packageName, version, 'skipped', `already published on ${publisher.registry}`, 0));
    console.log(`  skipped: ${version} already published on ${publisher.registry}`);
    return;
  }
  if (probe.exists === null) {
    console.log(`  warn: version probe inconclusive (${probe.detail ?? 'unknown'})`);
  }

  // Dry-run stops here: report what would be published, skip build + publish.
  if (opts['dry-run']) {
    report.add(makeItem(item, packageName, version, 'dry-run', `${publisher.registry} publish (dry-run)`, 0));
    console.log(`  dry-run: would publish to ${publisher.registry}`);
    return;
  }

  // Build.
  const buildStart = Date.now();
  const buildResult = publisher.build(packagePath, { skipBuild: opts['skip-build'] });
  const buildMs = Date.now() - buildStart;
  if (!buildResult.ok) {
    report.add(makeItem(item, packageName, version, 'failed', buildResult.detail, buildMs));
    console.log(`  failed: ${buildResult.detail}`);
    return;
  }
  console.log(`  build:   ${buildResult.detail} (${buildMs}ms)`);

  // Publish. Pass through process.env so credentials (NPM_TOKEN, etc.) reach
  // the underlying pnpm/cargo/mvn/twine process. pnpm also reads .npmrc which
  // can reference ${NPM_TOKEN}, so the env var must be visible to it.
  const pubStart = Date.now();
  const pubResult = publisher.publish(packagePath, {
    tag: opts.tag,
    access: opts.access,
    version,
    env: process.env,
  });
  const pubMs = Date.now() - pubStart;
  if (!pubResult.ok) {
    report.add(makeItem(item, packageName, version, 'failed', pubResult.detail, pubMs));
    console.log(`  failed: ${pubResult.detail}`);
    return;
  }
  report.add(makeItem(item, packageName, version, 'success', pubResult.detail, pubMs, publisher.registry));
  console.log(`  ok:      ${pubResult.detail} (${pubMs}ms)`);
}

function makeItem(item, packageName, version, status, reason, durationMs, registry) {
  return {
    repo: item.repoName,
    family: item.sdkFamily,
    language: item.language,
    packageName,
    version,
    status,
    registry,
    durationMs,
    reason,
    languageRoot: toDisplayPath(item.languageRoot),
  };
}

main().catch((err) => {
  console.error('publish-sdk fatal:', err);
  process.exit(1);
});
