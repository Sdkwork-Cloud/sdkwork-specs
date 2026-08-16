/**
 * Publish run report. Emitted as JSON so it can be archived as release evidence
 * per RELEASE_SPEC.md §4.
 */
import fs from 'node:fs';
import path from 'node:path';

import { toDisplayPath } from './util.mjs';

/**
 * @typedef {Object} ReportItem
 * @property {string} repo
 * @property {string} family
 * @property {string} language
 * @property {string} packageName
 * @property {string} version
 * @property {'success'|'skipped'|'failed'|'dry-run'} status
 * @property {string} [registry]
 * @property {number} durationMs
 * @property {string} [reason]
 * @property {string} [languageRoot]
 */

export class ReportBuilder {
  constructor({ mode, workspace, startedAt }) {
    this.runId = startedAt;
    this.mode = mode; // 'dry-run' | 'publish'
    this.workspace = toDisplayPath(workspace);
    this.startedAt = startedAt;
    this.items = [];
  }

  add(item) {
    this.items.push(item);
  }

  summary() {
    const s = { total: this.items.length, success: 0, skipped: 0, failed: 0, dryRun: 0 };
    for (const it of this.items) {
      if (it.status === 'success') s.success += 1;
      else if (it.status === 'skipped') s.skipped += 1;
      else if (it.status === 'failed') s.failed += 1;
      else if (it.status === 'dry-run') s.dryRun += 1;
    }
    return s;
  }

  toJSON() {
    return {
      runId: this.runId,
      mode: this.mode,
      workspace: this.workspace,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      summary: this.summary(),
      items: this.items,
    };
  }

  write(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2) + '\n', 'utf8');
  }

  printConsole() {
    const s = this.summary();
    console.log('');
    console.log(`publish run ${this.runId} (${this.mode})`);
    console.log(`  total:   ${s.total}`);
    console.log(`  success: ${s.success}`);
    console.log(`  skipped: ${s.skipped}`);
    console.log(`  failed:  ${s.failed}`);
    if (this.mode === 'dry-run') console.log(`  dry-run: ${s.dryRun}`);

    const failures = this.items.filter((i) => i.status === 'failed');
    if (failures.length > 0) {
      console.log('');
      console.log('failures:');
      for (const f of failures) {
        console.log(`  - ${f.repo}/${f.family}/${f.language} ${f.packageName}@${f.version}: ${f.reason}`);
      }
    }
  }
}
