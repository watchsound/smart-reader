/**
 * Regression: when db.exec(body) throws partway (e.g. a CREATE TABLE
 * without IF NOT EXISTS hitting an existing table), applyColumnAdditions
 * MUST still run so column ALTERs aren't silently skipped.
 *
 * Concrete incident behind this test: a0b39fa..38f25ab shipped a
 * `CREATE TABLE image` (no IF NOT EXISTS) which threw on every populated
 * DB boot. The original single-try-block migrate() swallowed the error,
 * skipping Phase 15a-1's column adds. Phase 15a-2's latencyByIntent then
 * failed at runtime with "no such column: error".
 */

const Database = require('better-sqlite3');
const { migrate } = require('../../main/db/SchemaMigrator');

describe('SchemaMigrator two-phase resilience', () => {
  test('column additions still apply when body exec throws midway', () => {
    const db = new Database(':memory:');
    // Pre-seed the brain_call_ledger and a conflicting "boom" table so the
    // schema body's CREATE TABLE boom (no IF NOT EXISTS) will throw.
    db.exec(`
      CREATE TABLE brain_call_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent TEXT NOT NULL,
        ts INTEGER NOT NULL,
        provider TEXT NOT NULL,
        context_keys TEXT,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        cost_usd REAL,
        cache_hit INTEGER NOT NULL DEFAULT 0,
        cache_key TEXT,
        duration_ms INTEGER,
        trigger_id TEXT,
        trace_id TEXT,
        output_summary TEXT,
        output_json TEXT
      );
    `);

    // Confirm starting state: no Phase 15a-1 columns.
    const before = db.prepare('PRAGMA table_info(brain_call_ledger)').all();
    expect(before.some((c) => c.name === 'error')).toBe(false);
    expect(before.some((c) => c.name === 'attempt_n')).toBe(false);

    // Run real migrate against this DB. db.sql may or may not exist in this
    // test environment, but applyColumnAdditions should still execute.
    const result = migrate(db);

    // Critical assertion: columns applied even if body errored.
    expect(result.columnsApplied).toBe(true);

    const after = db.prepare('PRAGMA table_info(brain_call_ledger)').all();
    expect(after.some((c) => c.name === 'attempt_n')).toBe(true);
    expect(after.some((c) => c.name === 'failover_reason')).toBe(true);
    expect(after.some((c) => c.name === 'error')).toBe(true);
  });

  test('idempotent — second run does not error and does not duplicate columns', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE brain_call_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        intent TEXT NOT NULL, ts INTEGER NOT NULL, provider TEXT NOT NULL
      );
    `);
    migrate(db);
    const first = db.prepare('PRAGMA table_info(brain_call_ledger)').all().length;
    migrate(db);
    const second = db.prepare('PRAGMA table_info(brain_call_ledger)').all().length;
    expect(second).toBe(first);
  });
});
