// src/main/db/CallLedgerStore.js
/**
 * CallLedgerStore — DAO over the `brain_call_ledger` table.
 *
 * Source of truth for Rationale Card and Economics Panel.
 * Used internally by the Brain Spine (`brainCall`, `meteredCall`).
 */

const DBManager = require('./DBManager');

/**
 * @typedef {Object} LedgerRow
 * @property {number} id
 * @property {string} intent
 * @property {number} ts          - epoch ms
 * @property {string} provider
 * @property {string[]} context_keys
 * @property {number} prompt_tokens
 * @property {number} completion_tokens
 * @property {number} cost_usd
 * @property {boolean} cache_hit
 * @property {string|null} cache_key
 * @property {number} duration_ms
 * @property {string|null} trigger_id
 * @property {string|null} output_summary
 * @property {object|null} output_json
 */

/**
 * @typedef {Object} AggregateRow
 * @property {string} key        - intent or provider name
 * @property {number} call_count
 * @property {number} total_cost_usd
 * @property {number} cache_hits
 */

/** Insert a fresh (non-cache-hit) call row. Returns the new id. */
async function record(row) {
  throw new Error('not implemented');
}

/** Record a cache hit referencing an existing fresh call. Returns the new id. */
async function recordCacheHit({ intent, cacheKey, triggerId }) {
  throw new Error('not implemented');
}

/** Find a usable cached output for (intent, cacheKey). Returns LedgerRow or null. */
async function findCacheHit(intent, cacheKey) {
  throw new Error('not implemented');
}

/** Fetch the most recent ledger row for a triggerId (for Rationale Card). */
async function findByTriggerId(triggerId) {
  throw new Error('not implemented');
}

/** Aggregate cost + call_count grouped by intent within [sinceMs, nowMs]. */
async function aggregateByIntent(sinceMs) {
  throw new Error('not implemented');
}

/** Aggregate cost + call_count grouped by provider within [sinceMs, nowMs]. */
async function aggregateByProvider(sinceMs) {
  throw new Error('not implemented');
}

/** Cache hit-rate per intent within [sinceMs, nowMs]. Returns Map<intent, ratio>. */
async function cacheHitRateByIntent(sinceMs) {
  throw new Error('not implemented');
}

/** Drop rows older than maxAgeMs OR oldest rows until count ≤ maxRows. Returns count pruned. */
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
