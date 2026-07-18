import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseRustCargoManifest,
  validateRustBackendComposition,
} from './lib/rust-backend-composition.mjs';

const CHECKER = path.resolve(import.meta.dirname, 'check-rust-backend-composition.mjs');

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

test('Cargo parser includes dotted workspace dependency shorthand', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-workspace-dependency-'));
  const cargoPath = path.join(root, 'Cargo.toml');
  writeText(
    cargoPath,
    [
      '[package]',
      'name = "sdkwork-demo-gateway-assembly"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork_iam_gateway_assembly.workspace = true',
      '',
    ].join('\n'),
  );

  const manifest = parseRustCargoManifest(cargoPath);

  assert.deepEqual(
    manifest.dependencies.map((dependency) => dependency.name),
    ['sdkwork-iam-gateway-assembly'],
  );
});

test('service crates must not depend on concrete SQLx repository crates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-service-repo-'));
  writeText(
    path.join(root, 'crates/sdkwork-demo-chat-service/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-demo-chat-service"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-demo-chat-repository-sqlx = { workspace = true }',
      '',
    ].join('\n'),
  );

  const issues = validateRustBackendComposition(root);

  assert.ok(issues.some((issue) => issue.includes('service crate must not depend on concrete repository crate')));
});

test('route crates must not depend on generated SDKs for the same HTTP surface', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-route-sdk-'));
  writeText(
    path.join(root, 'crates/sdkwork-routes-chat-app-api/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-routes-chat-app-api"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-chat-app-sdk = { workspace = true }',
      '',
    ].join('\n'),
  );

  const issues = validateRustBackendComposition(root);

  assert.ok(issues.some((issue) => issue.includes('route crate must not depend on generated SDK for the same surface')));
});

test('SQLx repository crates must not depend on HTTP framework crates', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-repo-http-'));
  writeText(
    path.join(root, 'crates/sdkwork-demo-chat-repository-sqlx/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-demo-chat-repository-sqlx"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-web-framework = { workspace = true }',
      'axum = "0.8"',
      '',
    ].join('\n'),
  );

  const issues = validateRustBackendComposition(root);

  assert.ok(issues.some((issue) => issue.includes('repository crate must not depend on HTTP framework crate sdkwork-web-framework')));
  assert.ok(issues.some((issue) => issue.includes('repository crate must not depend on HTTP framework crate axum')));
});

test('member Cargo manifests must not declare direct sibling SDKWork path dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-member-path-'));
  writeText(
    path.join(root, 'crates/sdkwork-demo-chat-service/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-demo-chat-service"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-utils = { path = "../../sdkwork-utils/crates/sdkwork-utils" }',
      '',
    ].join('\n'),
  );

  const issues = validateRustBackendComposition(root);

  assert.ok(issues.some((issue) => issue.includes('member Cargo dependency sdkwork-utils must use workspace = true')));
});

test('CLI reports Rust backend composition violations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-cli-'));
  writeText(
    path.join(root, 'crates/sdkwork-demo-chat-service/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-demo-chat-service"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-demo-chat-repository-sqlx = { workspace = true }',
      '',
    ].join('\n'),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--root', root], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /service crate must not depend on concrete repository crate/u);
});

test('CLI scans child repositories with --workspace', () => {
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-workspace-cli-'));
  const repoRoot = path.join(workspace, 'sdkwork-demo');
  writeText(path.join(repoRoot, 'AGENTS.md'), '# Repository Guidelines\n');
  writeText(
    path.join(repoRoot, 'crates/sdkwork-demo-chat-service/Cargo.toml'),
    [
      '[package]',
      'name = "sdkwork-demo-chat-service"',
      'version = "0.0.0"',
      '',
      '[dependencies]',
      'sdkwork-demo-chat-repository-sqlx = { workspace = true }',
      '',
    ].join('\n'),
  );

  const result = spawnSync(process.execPath, [CHECKER, '--workspace', workspace], {
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sdkwork-demo/u);
  assert.match(result.stderr, /service crate must not depend on concrete repository crate/u);
});
