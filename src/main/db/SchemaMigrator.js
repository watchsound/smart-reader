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
  try {
    const body = loadSchemaBody();
    if (!body) return { applied: false, reason: 'no schema body' };
    db.exec(body);
    return { applied: true };
  } catch (err) {
    console.error('[SchemaMigrator] migration failed:', err && err.message);
    return { applied: false, error: err && err.message };
  }
}

module.exports = { migrate };
