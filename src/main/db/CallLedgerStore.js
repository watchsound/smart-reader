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
       cost_usd, cache_hit, cache_key, duration_ms, trigger_id, trace_id,
       output_summary, output_json)
    VALUES
      (@intent, @ts, @provider, @context_keys, @prompt_tokens, @completion_tokens,
       @cost_usd, @cache_hit, @cache_key, @duration_ms, @trigger_id, @trace_id,
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
    trace_id: row.trace_id ?? null,
    output_summary: row.output_summary ?? null,
    output_json: row.output_json != null ? JSON.stringify(row.output_json) : null,
  });
  return info.lastInsertRowid;
}

/** Record a cache hit referencing an existing fresh call. Returns the new id. */
function recordCacheHit({ intent, cacheKey, triggerId, traceId }) {
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
       cost_usd, cache_hit, cache_key, duration_ms, trigger_id, trace_id,
       output_summary, output_json)
    VALUES
      (?, ?, ?, ?, NULL, NULL, NULL, 1, ?, NULL, ?, ?, ?, ?)
  `).run(
    src.intent, Date.now(), src.provider, src.context_keys,
    src.cache_key, triggerId || null, traceId || null, src.output_summary, src.output_json,
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
 * Age-based eviction runs first; row-count eviction then trims the remainder.
 *
 * @param {Object}  opts
 * @param {number} [opts.maxAgeMs] - omit to skip age-based eviction
 * @param {number} [opts.maxRows]  - omit to skip count-based eviction
 * @returns {number} count of rows pruned
 */
function prune({ maxAgeMs, maxRows }) {
  const db = DBManager.getDb();
  let dropped = 0;
  if (maxAgeMs && maxAgeMs > 0) {
    const cutoff = Date.now() - maxAgeMs;
    const info = db.prepare('DELETE FROM brain_call_ledger WHERE ts < ?').run(cutoff);
    dropped += info.changes;
  }
  if (maxRows && maxRows > 0) {
    const count = db.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    if (count > maxRows) {
      const excess = count - maxRows;
      const info = db.prepare(`
        DELETE FROM brain_call_ledger
        WHERE id IN (
          SELECT id FROM brain_call_ledger ORDER BY ts ASC LIMIT ?
        )
      `).run(excess);
      dropped += info.changes;
    }
  }
  return dropped;
}

/**
 * Return all ledger rows that share the same trace_id as `callId`.
 * If the row has no trace_id, returns just that single row.
 * Rows are ordered by ts ASC (i.e. Director iteration order).
 */
function tracesByCallId(callId) {
  const db = DBManager.getDb();
  const row = db.prepare('SELECT trace_id FROM brain_call_ledger WHERE id = ?').get(callId);
  if (!row) return [];
  if (!row.trace_id) {
    const single = db.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    return single ? [hydrate(single)] : [];
  }
  const rows = db.prepare(
    'SELECT * FROM brain_call_ledger WHERE trace_id = ? ORDER BY ts ASC',
  ).all(row.trace_id);
  return rows.map(hydrate);
}

/** Update the trigger_id of an existing call row. Used for post-emit backfill. */
function bindTriggerId(callId, triggerId) {
  const db = DBManager.getDb();
  const info = db.prepare(
    'UPDATE brain_call_ledger SET trigger_id = ? WHERE id = ?',
  ).run(triggerId, callId);
  if (info.changes === 0) throw new Error(`unknown callId: ${callId}`);
  return info.changes;
}

/**
 * Sum cost + tokens + counts for all ledger rows sharing a trace_id,
 * broken down per intent. Used by EconomicsPanel to show per-session spend.
 *
 * @param {string} traceId
 * @returns {{ traceId: string, totalCost: number, totalTokens: number, callCount: number, byIntent: Record<string, {count:number, cost:number, tokens:number}> }}
 */
function aggregateByTraceId(traceId) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent, cost_usd, prompt_tokens, completion_tokens
    FROM brain_call_ledger
    WHERE trace_id = ?
  `).all(traceId);
  const byIntent = {};
  let totalCost = 0;
  let totalTokens = 0;
  for (const r of rows) {
    if (!byIntent[r.intent]) byIntent[r.intent] = { count: 0, cost: 0, tokens: 0 };
    byIntent[r.intent].count++;
    byIntent[r.intent].cost += r.cost_usd || 0;
    byIntent[r.intent].tokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
    totalCost += r.cost_usd || 0;
    totalTokens += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
  }
  return { traceId, totalCost, totalTokens, callCount: rows.length, byIntent };
}

/**
 * Return distinct Director sessions (non-null trace_ids) ordered newest-first,
 * each with summary stats. Used by EconomicsPanel session list.
 *
 * @param {{ limit?: number }} [opts]
 * @returns {{ traceId: string, startedAt: number, endedAt: number, totalCost: number, callCount: number }[]}
 */
function listSessionTraces({ limit = 20 } = {}) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT trace_id AS traceId,
           MIN(ts) AS startedAt,
           MAX(ts) AS endedAt,
           SUM(cost_usd) AS totalCost,
           COUNT(*) AS callCount
    FROM brain_call_ledger
    WHERE trace_id IS NOT NULL
    GROUP BY trace_id
    ORDER BY startedAt DESC
    LIMIT ?
  `).all(limit);
  return rows;
}

/**
 * Phase 13 Attribution: per-surface aggregation in [fromMs, toMs).
 * Returns one row per feature_surface present in the window with:
 *   - direct_cost_usd, direct_event_count: events with proximate_call_id set
 *   - amortized_event_count: events without (cost computed downstream)
 *
 * @param {{ userId: number, fromMs: number, toMs: number }} opts
 * @returns {{ feature_surface: string, direct_cost_usd: number, direct_event_count: number, amortized_event_count: number }[]}
 */
function aggregateAttribution({ userId, fromMs, toMs }) {
  const db = DBManager.getDb();
  return db.prepare(`
    SELECT
      e.feature_surface,
      SUM(CASE WHEN e.proximate_call_id IS NOT NULL THEN COALESCE(c.cost_usd, 0) ELSE 0 END) AS direct_cost_usd,
      SUM(CASE WHEN e.proximate_call_id IS NOT NULL THEN 1 ELSE 0 END) AS direct_event_count,
      SUM(CASE WHEN e.proximate_call_id IS NULL THEN 1 ELSE 0 END) AS amortized_event_count
    FROM mastery_event e
    LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
    GROUP BY e.feature_surface
  `).all(userId, fromMs, toMs);
}

/**
 * Total cost_usd per intent within [fromMs, toMs). Used as the amortization
 * spend pool for surfaces whose calls cannot be directly attributed.
 *
 * @param {{ fromMs: number, toMs: number }} opts
 * @returns {Record<string, number>} map of intent → total cost
 */
function intentSpendInWindow({ fromMs, toMs }) {
  const db = DBManager.getDb();
  const rows = db.prepare(`
    SELECT intent, SUM(CASE WHEN cache_hit = 0 THEN cost_usd ELSE 0 END) AS total
    FROM brain_call_ledger
    WHERE ts >= ? AND ts < ?
    GROUP BY intent
  `).all(fromMs, toMs);
  return Object.fromEntries(rows.map((r) => [r.intent, r.total || 0]));
}

/**
 * Per-surface drill-down: events + their proximate call (intent + cost) if any.
 * Filter by `surfaces` list OR by a single `intent`. Ordered newest first.
 *
 * @param {{ userId: number, fromMs: number, toMs: number, surfaces?: string[], intent?: string, limit?: number }} opts
 */
function attributionGroupDetail({ userId, fromMs, toMs, surfaces, intent, limit = 50 }) {
  const db = DBManager.getDb();
  if (intent) {
    return db.prepare(`
      SELECT e.learning_point_id, e.ts, e.feature_surface, e.proximate_call_id,
             c.intent, c.cost_usd AS proximate_cost_usd
      FROM mastery_event e
      LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
      WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ? AND c.intent = ?
      ORDER BY e.ts DESC LIMIT ?
    `).all(userId, fromMs, toMs, intent, limit);
  }
  const placeholders = surfaces.map(() => '?').join(',');
  return db.prepare(`
    SELECT e.learning_point_id, e.ts, e.feature_surface, e.proximate_call_id,
           c.intent, c.cost_usd AS proximate_cost_usd
    FROM mastery_event e
    LEFT JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
      AND e.feature_surface IN (${placeholders})
    ORDER BY e.ts DESC LIMIT ?
  `).all(userId, fromMs, toMs, ...surfaces, limit);
}

/**
 * Daily mastery_event count for the brushable density timeline.
 * Returns one row per UTC day with { day: 'YYYY-MM-DD', count: number }, oldest first.
 *
 * @param {{ userId: number }} opts
 */
function attributionDensityStrip({ userId }) {
  const db = DBManager.getDb();
  return db.prepare(`
    SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(*) AS count
    FROM mastery_event
    WHERE user_id = ?
    GROUP BY day
    ORDER BY day ASC
  `).all(userId);
}

module.exports = {
  record,
  recordCacheHit,
  findCacheHit,
  findByTriggerId,
  tracesByCallId,
  aggregateByIntent,
  aggregateByProvider,
  aggregateByTraceId,
  cacheHitRateByIntent,
  listSessionTraces,
  prune,
  bindTriggerId,
  aggregateAttribution,
  intentSpendInWindow,
  attributionGroupDetail,
  attributionDensityStrip,
};
