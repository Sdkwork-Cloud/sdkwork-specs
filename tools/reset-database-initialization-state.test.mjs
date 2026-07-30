#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { sqliteAddColumnMigrationAlreadyPresent } from './reset-database-initialization-state.mjs';

const baseline = `
CREATE TABLE IF NOT EXISTS discovery_service_instance (
  id INTEGER PRIMARY KEY,
  health_check_json TEXT,
  health_check_state_json TEXT NOT NULL DEFAULT '{}'
);
`;

test('detects SQLite add-column migrations already represented by the baseline', () => {
  const migration = `
ALTER TABLE discovery_service_instance
  ADD COLUMN health_check_json TEXT;
ALTER TABLE discovery_service_instance
  ADD COLUMN health_check_state_json TEXT NOT NULL DEFAULT '{}';
`;

  assert.equal(sqliteAddColumnMigrationAlreadyPresent(migration, baseline), true);
});

test('keeps SQLite migrations with new columns or additional statements', () => {
  assert.equal(
    sqliteAddColumnMigrationAlreadyPresent(
      'ALTER TABLE discovery_service_instance ADD COLUMN health_probe_json TEXT;',
      baseline,
    ),
    false,
  );
  assert.equal(
    sqliteAddColumnMigrationAlreadyPresent(
      `ALTER TABLE discovery_service_instance ADD COLUMN health_check_json TEXT;
       CREATE INDEX idx_health ON discovery_service_instance (health_check_json);`,
      baseline,
    ),
    false,
  );
});
