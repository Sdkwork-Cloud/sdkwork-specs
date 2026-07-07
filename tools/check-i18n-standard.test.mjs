import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

const CHECKER = path.resolve('tools/check-i18n-standard.mjs');

function write(root, relativePath, text) {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text, 'utf8');
}

function makeRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-i18n-check-'));
  write(root, 'AGENTS.md', '# Repository Guidelines\n');
  write(root, 'package.json', '{"name":"sdkwork-i18n-check"}\n');
  return root;
}

function runChecker(args) {
  return spawnSync(process.execPath, [CHECKER, ...args], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
  });
}

describe('check-i18n-standard', () => {
  it('accepts package-local source fragments and generated platform projections', () => {
    const root = makeRepo();
    write(root, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-auth/src/i18n/zh-CN/iam/auth/login.ts', 'export default { title: "登录" };\n');
    write(root, 'apps/sdkwork-demo-h5/packages/sdkwork-demo-h5-auth/src/i18n/en-US/iam/auth/login.json', '{ "title": "Login" }\n');
    write(root, 'apps/sdkwork-demo-flutter-mobile/packages/sdkwork_demo_flutter_mobile_auth/lib/src/i18n/zh-CN/iam/auth/login.arb', '{ "title": "登录" }\n');
    write(root, 'apps/sdkwork-demo-android-mobile/packages/sdkwork-demo-android-mobile-auth/src/main/i18n/zh-CN/iam/auth/login.json', '{ "title": "登录" }\n');
    write(root, 'apps/sdkwork-demo-android-mobile/packages/sdkwork-demo-android-mobile-auth/src/main/res/values-zh-rCN/strings.xml', '<!-- sdkwork-i18n-generated -->\n<resources><string name="iam_auth_login_title">登录</string></resources>\n');
    write(root, 'apps/sdkwork-demo-ios-mobile/packages/sdkwork-demo-ios-mobile-auth/Sources/SdkworkDemoIosMobileAuth/I18n/zh-CN/iam/auth/login.json', '{ "title": "登录" }\n');
    write(root, 'apps/sdkwork-demo-harmony-mobile/packages/sdkwork-demo-harmony-mobile-auth/src/main/ets/i18n/zh-CN/iam/auth/login.json', '{ "title": "登录" }\n');
    write(root, 'crates/sdkwork-iam-auth-service/resources/i18n/zh-CN/iam/auth/login.ftl', 'iam-auth-login-title = 登录\n');
    write(root, 'services/iam-auth/src/main/resources/i18n/zh-CN/iam/auth/login.properties', 'iam.auth.login.title=登录\n');
    write(root, 'database/seeds/locales/zh-CN/iam/auth/001_auth_seed.sql', '-- locale seed\n');
    write(root, 'packages/sdkwork-i18n-contract/src/i18n/keys/iam/auth.ts', 'export const loginTitle = "iam.auth.login.title";\n');

    const result = runChecker(['--root', root]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /i18n standard check passed/u);
  });

  it('rejects authored TypeScript locale monoliths and platform locale directory names as source roots', () => {
    const root = makeRepo();
    write(root, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-auth/src/i18n/zh-CN.ts', 'export default { loginTitle: "登录" };\n');
    write(root, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-auth/src/i18n/values-zh-rCN/iam/auth/login.ts', 'export default { title: "登录" };\n');

    const result = runChecker(['--root', root]);

    assert.notEqual(result.status, 0, 'expected checker failure');
    assert.match(result.stderr, /locale monolith/u);
    assert.match(result.stderr, /normalized BCP 47 locale/u);
  });

  it('rejects authored platform aggregate resources without generated markers', () => {
    const root = makeRepo();
    write(root, 'apps/sdkwork-demo-android-mobile/packages/sdkwork-demo-android-mobile-auth/src/main/res/values/strings.xml', `
<resources>
  <string name="iam_auth_login_title">Login</string>
  <string name="iam_auth_login_submit">Submit</string>
  <string name="iam_auth_login_error">Error</string>
</resources>
`);
    write(root, 'apps/sdkwork-demo-flutter-mobile/packages/sdkwork_demo_flutter_mobile_auth/lib/l10n/app_en.arb', `
{
  "loginTitle": "Login",
  "loginSubmit": "Submit",
  "loginError": "Error"
}
`);

    const result = runChecker(['--root', root]);

    assert.notEqual(result.status, 0, 'expected checker failure');
    assert.match(result.stderr, /platform aggregate/u);
    assert.match(result.stderr, /generated marker/u);
  });

  it('rejects backend message bundles outside the standard Rust and Java layouts', () => {
    const root = makeRepo();
    write(root, 'crates/sdkwork-iam-auth-service/src/i18n.rs', 'pub const LOGIN_TITLE: &str = "登录";\n');
    write(root, 'services/iam-auth/src/main/resources/messages_zh_CN.properties', 'iam.auth.login.title=登录\n');

    const result = runChecker(['--root', root]);

    assert.notEqual(result.status, 0, 'expected checker failure');
    assert.match(result.stderr, /Rust backend message resources/u);
    assert.match(result.stderr, /Java\/Spring backend message resources/u);
  });

  it('scans child repositories with --workspace', () => {
    const workspace = mkdtempSync(path.join(os.tmpdir(), 'sdkwork-i18n-workspace-'));
    const repoRoot = path.join(workspace, 'sdkwork-demo');
    write(repoRoot, 'AGENTS.md', '# Repository Guidelines\n');
    write(repoRoot, 'package.json', '{"name":"sdkwork-demo"}\n');
    write(repoRoot, 'apps/sdkwork-demo-pc/packages/sdkwork-demo-pc-auth/src/i18n/messages.json', '{ "loginTitle": "Login" }\n');

    const result = runChecker(['--workspace', workspace]);

    assert.notEqual(result.status, 0, 'expected checker failure');
    assert.match(result.stderr, /sdkwork-demo/u);
    assert.match(result.stderr, /locale monolith/u);
  });
});
