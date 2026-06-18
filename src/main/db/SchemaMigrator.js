/**
 * SchemaMigrator — applies new tables / indices from db.sql to the live DB
 * on every boot. Safe because every CREATE in db.sql uses IF NOT EXISTS.
 *
 * Why this exists: dbManager only opens the SQLite file; nothing applies
 * schema changes when a new phase adds a table. Pre-this-module, when
 * Phase 9 / Phase 12 / Phase 13 added `brain_call_ledger`, `mastery_event`,
 * etc. to db.sql, existing dev DBs never picked them up — IPC handlers
 * crashed with `no such table` until the developer hand-ran the missing
 * CREATEs. This module closes that gap.
 *
 * Strategy:
 *  1. Read db.sql.
 *  2. Strip the leading DROP TABLE block (kept in db.sql for factory-reset
 *     workflows; would destroy user data if run on every boot).
 *  3. db.exec() the remaining SQL. With IF NOT EXISTS on every CREATE,
 *     this is idempotent — fresh DBs get full schema, populated DBs get
 *     only what's missing.
 *
 * Not in scope: ALTER TABLE for new columns on existing tables. SQLite's
 * `CREATE TABLE IF NOT EXISTS` is a no-op when the table exists, so new
 * columns won't be added retroactively. Phase 14+ should add a more
 * structured migration mechanism (versioned migration files + a
 * `schema_version` row) when the need arises. For now we accept the limit
 * because the only column-additions to date (Phase 13 mastery_event
 * columns) were applied via a one-shot script.
 */

const fs = require('fs');
const path = require('path');

const FIRST_CREATE_RE = /^CREATE (TABLE|INDEX|UNIQUE INDEX|VIEW|TRIGGER)/m;

let cachedSchemaBody = null;

function loadSchemaBody() {
  if (cachedSchemaBody != null) return cachedSchemaBody;
  // db.sql lives at project root in dev; in prod it's in resources.
  // Walk up from this file: src/main/db/SchemaMigrator.js -> project root.
  const candidates = [
    path.join(__dirname, '..', '..', '..', 'db.sql'),
    process.resourcesPath ? path.join(process.resourcesPath, 'db.sql') : null,
  ].filter(Boolean);
  let sql = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { sql = fs.readFileSync(p, 'utf8'); break; }
  }
  if (sql == null) {
    console.warn('[SchemaMigrator] db.sql not found; skipping migration');
    cachedSchemaBody = '';
    return cachedSchemaBody;
  }
  // Strip the leading DROP TABLE block. Take everything from the first CREATE.
  const match = sql.match(FIRST_CREATE_RE);
  cachedSchemaBody = match ? sql.slice(match.index) : sql;
  return cachedSchemaBody;
}

/**
 * Run all CREATEs (and idempotent UPDATEs) from db.sql against the open DB.
 * Idempotent: every CREATE uses IF NOT EXISTS; the only UPDATE in db.sql
 * (the Phase 13 backfill data migration) is also idempotent via its WHERE.
 *
 * Errors are logged but not rethrown — schema migration must never block
 * app boot. If a specific statement fails, IPC calls that reference the
 * missing table will surface a clear `no such table: X` error and we'll
 * know which migration step needs attention.
 */
function migrate(db) {
  // Two-phase migration. The body exec and the column additions live in
  // separate try blocks so a partial body failure (one bad CREATE killing
  // the rest, e.g. a missing IF NOT EXISTS) does NOT silently swallow the
  // column ALTERs.
  //
  // Concrete incident: from a0b39fa (when SchemaMigrator first shipped)
  // through 38f25ab, `CREATE TABLE image` in db.sql lacked IF NOT EXISTS.
  // On every boot of a populated DB, body.exec() threw on that line. The
  // single try/catch swallowed the error and skipped applyColumnAdditions.
  // Result: Phase 15a-1's attempt_n/failover_reason/error columns never
  // applied, and Phase 15a-2's latencyByIntent query failed with
  // "no such column: error". Fixed in this commit by (a) IF NOT EXISTS on
  // the image table and (b) splitting the try blocks so future similar
  // body breakage doesn't block column adds.
  let bodyApplied = false;
  let bodyErr = null;
  try {
    const body = loadSchemaBody();
    if (body) {
      db.exec(body);
      bodyApplied = true;
    }
  } catch (err) {
    bodyErr = err;
    console.error('[SchemaMigrator] body exec failed:', err && err.message);
  }
  let columnsApplied = false;
  let columnsErr = null;
  try {
    applyColumnAdditions(db);
    columnsApplied = true;
  } catch (err) {
    columnsErr = err;
    console.error('[SchemaMigrator] applyColumnAdditions failed:', err && err.message);
  }
  return {
    applied: bodyApplied || columnsApplied,
    bodyApplied,
    columnsApplied,
    bodyError: bodyErr && bodyErr.message,
    columnsError: columnsErr && columnsErr.message,
  };
}

/**
 * Idempotent ALTER TABLE ADD COLUMN helper. Reads PRAGMA table_info to
 * check whether the column already exists; ALTERs only if missing. This
 * closes the gap SchemaMigrator originally left open: CREATE IF NOT EXISTS
 * is a no-op when the table exists, so new columns added to db.sql never
 * propagate to populated DBs without a manual one-shot script.
 *
 * Add new columns here whenever a phase needs them. Once added, db.sql
 * should also carry the column in its CREATE TABLE so fresh DBs match.
 */
function ensureColumn(db, table, column, definition) {
  try {
    const cols = db.prepare(`PRAGMA table_info("${table}")`).all();
    if (cols.some((c) => c.name === column)) return false;
    db.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    return true;
  } catch (e) {
    console.warn(`[SchemaMigrator] ensureColumn ${table}.${column} failed:`, e && e.message);
    return false;
  }
}

function applyColumnAdditions(db) {
  // Phase 15 (Reset & Deepen — provider failover): per-attempt tracking
  // on the Call Ledger. attempt_n is 1-indexed within a single brainCall;
  // failover_reason names the error class that triggered the next attempt;
  // error captures the message for the row's own failed attempt (null on success).
  ensureColumn(db, 'brain_call_ledger', 'attempt_n', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'brain_call_ledger', 'failover_reason', 'TEXT');
  ensureColumn(db, 'brain_call_ledger', 'error', 'TEXT');
}

module.exports = { migrate, ensureColumn };
