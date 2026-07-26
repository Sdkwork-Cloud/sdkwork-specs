import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { scanRustHttpHeaderStandard } from './check-rust-http-header-standard.mjs';

function fixture(source) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sdkwork-rust-header-'));
  fs.writeFileSync(path.join(root, 'response.rs'), source);
  return root;
}

test('accepts lowercase static header keys', () => {
  const root = fixture('HeaderName::from_static("x-sdkwork-trace-id");');
  assert.deepEqual(scanRustHttpHeaderStandard(root), []);
});

test('rejects display-cased literals and the shared display constant', () => {
  const root = fixture(`
    HeaderName::from_static("X-SdkWork-Trace-Id");
    HeaderName::from_static(SDKWORK_TRACE_ID_HEADER);
  `);
  const issues = scanRustHttpHeaderStandard(root);
  assert.equal(issues.length, 2);
});
