import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  CANONICAL_HTTP_ROUTE_PREFIX,
  legacyFoundationPcReactName,
  legacyHttpRouteCrateName,
} from './lib/naming-patterns.mjs';

const CHECKER = path.resolve('tools/check-identity-naming.mjs');

function runChecker(root, mode = 'consumer') {
  return spawnSync(process.execPath, [CHECKER, '--root', root, '--mode', mode], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
}

describe('check-identity-naming route crate prefix', () => {
  it('rejects non-canonical legacy HTTP route crate names in consumer mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-identity-route-crate-'));
    const legacyCrate = legacyHttpRouteCrateName('video', 'open-api');
    const cratesDir = path.join(root, 'crates', legacyCrate);
    mkdirSync(cratesDir, { recursive: true });
    writeFileSync(path.join(cratesDir, 'Cargo.toml'), `name = "${legacyCrate}"\n`);

    const result = runChecker(root, 'consumer');

    assert.notEqual(result.status, 0, 'expected checker failure');
    assert.match(result.stderr, /sdkwork-routes-/);
  });

  it('accepts canonical sdkwork-routes-* HTTP route crates in consumer mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-identity-route-crate-'));
    const canonicalCrate = `${CANONICAL_HTTP_ROUTE_PREFIX}video-open-api`;
    const cratesDir = path.join(root, 'crates', canonicalCrate);
    mkdirSync(cratesDir, { recursive: true });
    writeFileSync(path.join(cratesDir, 'Cargo.toml'), `name = "${canonicalCrate}"\n`);

    const result = runChecker(root, 'consumer');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /identity naming ok/);
  });

  it('accepts canonical appbase foundation PC React packages in consumer mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-identity-route-crate-'));
    const pkgDir = path.join(root, 'packages', 'sdkwork-shell-pc-react');
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, 'package.json'), '{"name":"sdkwork-shell-pc-react"}\n');

    const result = runChecker(root, 'consumer');

    assert.equal(result.status, 0, result.stderr);
  });

  it('rejects non-canonical appbase foundation PC React package names in consumer mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-identity-foundation-pc-react-'));
    const legacyFoundation = legacyFoundationPcReactName();
    const pkgDir = path.join(root, 'packages', legacyFoundation);
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(path.join(pkgDir, 'package.json'), `{"name":"${legacyFoundation}"}\n`);

    const result = runChecker(root, 'consumer');

    assert.notEqual(result.status, 0, 'expected checker failure');
    assert.match(result.stderr, /sdkwork-shell-pc-react|sdkwork-workspace-pc-react/);
  });

  it('accepts gateway assembly crate names in standards mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-identity-standards-'));
    writeFileSync(path.join(root, 'README.md'), '# Standards\nrepository-kind: standards\n');
    writeFileSync(
      path.join(root, 'APPLICATION_GATEWAY_SPEC.md'),
      [
        '# Application Gateway Standard',
        '',
        'Gateway assembly crates use `sdkwork-<application-code>-gateway-assembly`.',
        '',
      ].join('\n'),
    );

    const result = runChecker(root, 'standards');

    assert.equal(result.status, 0, result.stderr);
  });
});
