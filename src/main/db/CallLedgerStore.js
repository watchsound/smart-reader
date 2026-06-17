// src/main/db/CallLedgerStore.js
/**
 * CallLedgerStore — DAO over the `brain_call_ledger` table.
 *
 * Source of truth for Rationale Card and Economics Panel.
 * Used internally by the Brain Spine (`brainCall`, `meteredCall`).
 */

const DBManager = require('./dbManager');

/**
 * @typedef {Object} LedgerRow
 * @property {number} id
 * @property {string} intent
 * @property {number} ts          - epoch ms
 * @property {string} provider
 * @property {string[]} context_keys     - stored as JSON TEXT; serialize on write, parse on read
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 * @property {number} cost_usd
 * @property {boolean} cache_hit
 * @property {string|null} cache_key
 * @property {number} duration_ms
 * @property {string|null} trigger_id
 * @property {string|null} output_summary
 * @property {object|null} output_json   - stored as JSON TEXT; serialize on write, parse on read
 */

/**
 * @typedef {Object} AggregateRow
 * @property {string} key        - intent or provider name
 * @property {number} call_count
 * @property {number} total_cost_usd
 * @property {number} cache_hits
 */

/** Insert a fresh (non-cache-hit) call row. Returns the new id. */
function record(row) {
  const db = DBManager.getDb();
  const stmt = db.prepare(`
    INSERT INTO brain_call_ledger
      (intent, ts, provider, context_keys, prompt_tokens, completion_tokens,
       cost_usd, cache_hit, cache_key, duration_ms, trigger_id,
       output_summary, output_json)
    VALUES
      (@intent, @ts, @provider, @context_keys, @prompt_tokens, @completion_tokens,
       @cost_usd, @cache_hit, @cache_key, @duration_ms, @trigger_id,
       @output_summary, @output_json)
  `);
  const info = stmt.run({
    intent: row.intent,
    ts: row.ts,
    provider: row.provider,
    context_keys: JSON.stringify(row.context_keys || []),
    prompt_tokens: row.prompt_tokens ?? null,
    completion_tokens: row.completion_tokens ?? null,
    cost_usd: row.cost_usd ?? null,
    cache_hit: row.cache_hit ? 1 : 0,
    cache_key: row.cache_key ?? null,
    duration_ms: row.duration_ms ?? null,
    trigger_id: row.trigger_id ?? null,
    output_summary: row.output_summary ?? null,
    output_json: row.output_json != null ? JSON.stringify(row.output_json) : null,
  });
  return info.lastInsertRowid;
}

/** Record a cache hit referencing an existing fresh call. Returns the new id. */
function recordCacheHit({ intent, cacheKey, triggerId }) {
  const db = DBManager.getDb();
  const src = db.prepare(`
    SELECT * FROM brain_call_ledger
    WHERE intent = ? AND cache_key = ? AND cache_hit = 0
    ORDER BY ts DESC LIMIT 1
  `).get(intent, cacheKey);
  if (!src) {
    throw new Error(`recordCacheHit: no fresh row for ${intent}/${cacheKey}`);
  }
  const info = db.prepare(`
    INSERT INTO brain_call_ledger
      (intent, ts, provider, context_keys, prompt_tokens, completion_tokens,
       cost_usd, cache_hit, cache_key, duration_ms, trigger_id,
       output_summary, output_json)
    VALUES
      (?, ?, ?, ?, NULL, NULL, NULL, 1, ?, NULL, ?, ?, ?)
  `).run(
    src.intent, Date.now(), src.provider, src.context_keys,
    src.cache_key, triggerId || null, src.output_summary, src.output_json,
  );
  return info.lastInsertRowid;
}

/** Find the most recent fresh cached output for (intent, cacheKey). Returns LedgerRow or null. */
function findCacheHit(intent, cacheKey) {
  if (!cacheKey) return null;
  const db = DBManager.getDb();
  const row = db.prepare(`
    SELECT * FROM brain_call_ledger
    WHERE intent = ? AND cache_key = ? AND cache_hit = 0
    ORDER BY ts DESC LIMIT 1
  `).get(intent, cacheKey);
  if (!row) return null;
  return hydrate(row);
}

function hydrate(row) {
  return {
    ...row,
    context_keys: row.context_keys ? JSON.parse(row.context_keys) : [],
    output_json: row.output_json ? JSON.parse(row.output_json) : null,
    cache_hit: !!row.cache_hit,
  };
}

/** Fetch the most recent ledger row for a triggerId (for Rationale Card). */
function findByTriggerId(triggerId) {
  if (!triggerId) return null;
  const db = DBManager.getDb();
  const row = db.prepare(`
    SELECT * FROM brain_call_ledger
    WHERE trigger_id = ?
    ORDER BY ts DESC LIMIT 1
  `).get(triggerId);
  return row ? hydrate(row) : null;
}

/** Aggregate cost + call_count grouped by intent within [sinceMs, nowMs]. */
function aggregateByIntent(sinceMs) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent AS key,
           SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS call_count,
           SUM(CASE WHEN cache_hit = 0 THEN cost_usd ELSE 0 END) AS total_cost_usd,
           SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY intent
    ORDER BY total_cost_usd DESC
  `).all(sinceMs);
  return rows;
}

/** Aggregate cost + call_count grouped by provider within [sinceMs, nowMs]. */
function aggregateByProvider(sinceMs) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT provider AS key,
           SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS call_count,
           SUM(CASE WHEN cache_hit = 0 THEN cost_usd ELSE 0 END) AS total_cost_usd,
           SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY provider
    ORDER BY total_cost_usd DESC
  `).all(sinceMs);
  return rows;
}

/** Cache hit-rate per intent within [sinceMs, nowMs]. Returns Map<intent, ratio>. */
function cacheHitRateByIntent(sinceMs) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent,
           SUM(cache_hit) AS hits,
           COUNT(*) AS total
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY intent
  `).all(sinceMs);
  const out = new Map();
  for (const r of rows) {
    out.set(r.intent, r.total > 0 ? r.hits / r.total : 0);
  }
  return out;
}

/**
 * Drop rows older than maxAgeMs OR oldest rows until count ≤ maxRows.
 * Either constraint may be omitted (0 / falsy) to skip that eviction path.
 *
 * @param {Object}  opts
 * @param {number} [opts.maxAgeMs] - omit to skip age-based eviction
 * @param {number} [opts.maxRows]  - omit to skip count-based eviction
 * @returns {Promise<number>} count of rows pruned
 */
async function prune({ maxAgeMs, maxRows }) {
  throw new Error('not implemented');
}

module.exports = {
  record,
  recordCacheHit,
  findCacheHit,
  findByTriggerId,
  aggregateByIntent,
  aggregateByProvider,
  cacheHitRateByIntent,
  prune,
};
