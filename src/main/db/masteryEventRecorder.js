/**
 * masteryEventRecorder — single DRY helper for Phase 13 attribution writes.
 *
 * Every mastery-event write site goes through this helper instead of calling
 * MasteryEventStore.record directly. It:
 *   1. Looks up the most recent brain_call_ledger row for the given trace_id
 *      (if any) to populate proximate_call_id.
 *   2. Stamps the supplied feature_surface.
 *   3. Delegates to MasteryEventStore.record.
 *
 * Callers without a traceId (e.g. micro-card accept — chained, no direct
 * proximate call) pass traceId: null and get proximate_call_id: null.
 */
const dbManager = require('./dbManager');
const MasteryEventStore = require('./MasteryEventStore');
const { isValidFeatureSurface } = require('../../commons/model/featureSurface');

function lookupProximateCallId(traceId) {
  if (!traceId) return null;
  const row = dbManager.getDb().prepare(
    `SELECT id FROM brain_call_ledger WHERE trace_id = ? ORDER BY ts DESC LIMIT 1`
  ).get(traceId);
  return row ? row.id : null;
}

/**
 * @param {object} args
 * @param {string|null} args.traceId    — trace_id to look up; null skips lookup
 * @param {string}      args.surface    — feature_surface enum value
 * @param {string}      args.learningPointId
 * @param {number}      args.userId
 * @param {number}      args.ts
 * @param {string}      args.eventType  — 'review' | 'mastery_change' | etc.
 * @param {string}      args.source     — legacy source label
 * @param {string|null} [args.sourceRef]
 * @param {number|null} [args.prevBox]
 * @param {number|null} [args.newBox]
 * @param {number|null} [args.prevMastery]
 * @param {number|null} [args.newMastery]
 * @param {string|null} [args.rating]
 * @param {string|null} [args.notes]
 * @param {number|null} [args.explicitCallId]  — optional: skip lookup, use this directly
 */
function recordWithProximateCall(args) {
  if (!isValidFeatureSurface(args.surface)) {
    console.warn(`[masteryEventRecorder] invalid surface "${args.surface}" — coerced to 'unknown'`);
  }
  const proximateCallId = args.explicitCallId != null
    ? args.explicitCallId
    : lookupProximateCallId(args.traceId);

  MasteryEventStore.record({
    learningPointId: args.learningPointId,
    userId: args.userId,
    ts: args.ts,
    eventType: args.eventType,
    prevBox: args.prevBox,
    newBox: args.newBox,
    prevMastery: args.prevMastery,
    newMastery: args.newMastery,
    rating: args.rating,
    source: args.source,
    sourceRef: args.sourceRef,
    notes: args.notes,
    proximateCallId,
    featureSurface: args.surface,
  });
}

module.exports = { recordWithProximateCall };
