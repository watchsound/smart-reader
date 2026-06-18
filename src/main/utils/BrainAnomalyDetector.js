/**
 * BrainAnomalyDetector — Phase 15b.
 *
 * Threshold-based detectors over Phase 12 trajectory, Phase 13 attribution
 * join, and Phase 15a-1's per-attempt ledger column. v1 covers four classes:
 *
 *   - mastery-regression       concept dropped ≥ N points in window
 *   - zero-roi-spend           intent burned ≥ $X with zero attributed moves
 *   - provider-error-spike     provider error rate > T% over min N calls
 *   - stalled-quest-concept    in-Quest concept idle ≥ N days, mastery < 80
 *
 * Each detector is pure-fn (sql + thresholds → rows) for testability.
 * The persister upserts into `brain_anomaly` keyed on (kind, key) so a
 * re-scan is idempotent and existing rows keep their acknowledged_at.
 *
 * Spec: 14-direction C ("anomaly/regression").
 */

const { ANOMALY } = require('../brain/predictive/predictiveEnums');

const DAY = 86_400_000;
const HOUR = 3_600_000;

function getDb() { return require('../db/dbManager').getDb(); }

function activeQuestBookIds(store) {
  if (!store) return [];
  try {
    const quests = store.get('brainShell.quests') || [];
    return Array.from(new Set(
      quests
        .filter((q) => q.status === 'active')
        .flatMap((q) => Array.isArray(q.bookIds) ? q.bookIds : []),
    ));
  } catch (_e) { return []; }
}

/**
 * Pure: classify a mastery-regression trajectory.
 * Input: per-lp { id, title, recentMin, recentMax, latestMastery, latestTs }
 * Output: anomaly or null.
 */
function classifyMasteryRegression(row) {
  const drop = row.recentMax - row.latestMastery;
  if (drop < ANOMALY.MASTERY_REGRESSION_DROP) return null;
  return {
    kind: 'mastery-regression',
    key: String(row.id),
    severity: drop >= 20 ? 'high' : 'medium',
    evidence: {
      learningPointId: row.id,
      title: row.title || row.id,
      peakMastery: row.recentMax,
      latestMastery: row.latestMastery,
      drop,
    },
    sinceTs: row.latestTs,
  };
}

function detectMasteryRegression() {
  const fromMs = Date.now() - ANOMALY.MASTERY_REGRESSION_WINDOW_DAYS * DAY;
  const rows = getDb().prepare(`
    SELECT lp.id, lp.title,
           MAX(e.new_mastery) AS recentMax,
           MIN(e.new_mastery) AS recentMin,
           (SELECT new_mastery FROM mastery_event
              WHERE learning_point_id = lp.id AND ts >= ?
              ORDER BY ts DESC LIMIT 1) AS latestMastery,
           (SELECT ts FROM mastery_event
              WHERE learning_point_id = lp.id AND ts >= ?
              ORDER BY ts DESC LIMIT 1) AS latestTs
    FROM learning_point lp
    JOIN mastery_event e ON e.learning_point_id = lp.id
    WHERE e.ts >= ? AND e.new_mastery IS NOT NULL
    GROUP BY lp.id
    HAVING recentMax IS NOT NULL AND latestMastery IS NOT NULL
  `).all(fromMs, fromMs, fromMs);
  return rows.map(classifyMasteryRegression).filter(Boolean);
}

/**
 * Pure: classify a zero-ROI spend row.
 * Input: { intent, totalCost, attributedEventCount, since }
 */
function classifyZeroRoi(row) {
  if (row.totalCost < ANOMALY.ZERO_ROI_SPEND_USD) return null;
  if (row.attributedEventCount > 0) return null;
  return {
    kind: 'zero-roi-spend',
    key: row.intent,
    severity: row.totalCost >= 0.20 ? 'high' : 'medium',
    evidence: {
      intent: row.intent,
      windowCostUsd: row.totalCost,
      attributedEventCount: 0,
    },
    sinceTs: row.since,
  };
}

function detectZeroRoiSpend() {
  const fromMs = Date.now() - ANOMALY.ZERO_ROI_WINDOW_DAYS * DAY;
  const rows = getDb().prepare(`
    SELECT c.intent,
           SUM(CASE WHEN c.cache_hit = 0 THEN COALESCE(c.cost_usd, 0) ELSE 0 END) AS totalCost,
           (SELECT COUNT(*) FROM mastery_event e
              WHERE e.proximate_call_id IN (
                SELECT id FROM brain_call_ledger
                WHERE intent = c.intent AND ts >= ?
              )) AS attributedEventCount,
           MIN(c.ts) AS since
    FROM brain_call_ledger c
    WHERE c.ts >= ?
      AND c.error IS NULL
    GROUP BY c.intent
  `).all(fromMs, fromMs);
  return rows.map(classifyZeroRoi).filter(Boolean);
}

/**
 * Pure: classify a provider error-rate row.
 * Input: { provider, totalCalls, errorCalls, sinceTs }
 */
function classifyProviderErrorSpike(row) {
  if (row.totalCalls < ANOMALY.PROVIDER_ERROR_MIN_CALLS) return null;
  const rate = row.errorCalls / row.totalCalls;
  if (rate < ANOMALY.PROVIDER_ERROR_RATE_THRESHOLD) return null;
  return {
    kind: 'provider-error-spike',
    key: row.provider,
    severity: rate >= 0.5 ? 'high' : 'medium',
    evidence: {
      provider: row.provider,
      windowHours: ANOMALY.PROVIDER_ERROR_WINDOW_HOURS,
      totalCalls: row.totalCalls,
      errorCalls: row.errorCalls,
      errorRate: rate,
    },
    sinceTs: row.sinceTs,
  };
}

function detectProviderErrorSpike() {
  const fromMs = Date.now() - ANOMALY.PROVIDER_ERROR_WINDOW_HOURS * HOUR;
  const rows = getDb().prepare(`
    SELECT provider,
           COUNT(*) AS totalCalls,
           SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS errorCalls,
           MIN(ts) AS sinceTs
    FROM brain_call_ledger
    WHERE ts >= ?
    GROUP BY provider
  `).all(fromMs);
  return rows.map(classifyProviderErrorSpike).filter(Boolean);
}

/**
 * Pure: classify a stalled-quest-concept row.
 * Input: { id, title, masteryLevel, lastEventTs, questId }
 */
function classifyStalled(row) {
  const now = Date.now();
  const stalledDays = row.lastEventTs == null
    ? null
    : Math.floor((now - row.lastEventTs) / DAY);
  // No events at all + mastery below threshold counts as stalled.
  if (stalledDays != null && stalledDays < ANOMALY.STALLED_CONCEPT_DAYS) return null;
  if ((row.masteryLevel || 0) >= ANOMALY.STALLED_CONCEPT_MASTERY_MAX) return null;
  return {
    kind: 'stalled-quest-concept',
    key: `${row.questId}:${row.id}`,
    severity: 'medium',
    evidence: {
      learningPointId: row.id,
      title: row.title || row.id,
      questId: row.questId,
      masteryLevel: row.masteryLevel || 0,
      stalledDays,
    },
    sinceTs: row.lastEventTs || now,
  };
}

function detectStalledQuestConcepts(store) {
  // Walk active Quests' bookIds, find lps below mastery threshold, check
  // their most-recent mastery_event ts. The brainShell.quests electron-store
  // key isn't visible in unit tests — when missing, this detector is a no-op.
  let quests = [];
  try {
    if (store && store.get) {
      const all = store.get('brainShell.quests') || [];
      quests = all.filter((q) => q.status === 'active'
        && Array.isArray(q.bookIds) && q.bookIds.length > 0);
    }
  } catch (_e) { /* ignore */ }
  if (quests.length === 0) return [];

  const out = [];
  const db = getDb();
  for (const q of quests) {
    const placeholders = q.bookIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT lp.id, lp.title,
             lp.mastery_level AS masteryLevel,
             (SELECT MAX(ts) FROM mastery_event WHERE learning_point_id = lp.id) AS lastEventTs
      FROM learning_point lp
      WHERE lp.book_id IN (${placeholders})
        AND (lp.mastery_level IS NULL OR lp.mastery_level < ?)
    `).all(...q.bookIds, ANOMALY.STALLED_CONCEPT_MASTERY_MAX);
    for (const r of rows) {
      const a = classifyStalled({ ...r, questId: q.id });
      if (a) out.push(a);
    }
  }
  return out;
}

/**
 * Run all detectors. Returns aggregated anomaly list (not yet persisted).
 */
function runDetectors({ store } = {}) {
  const sharedStore = store || (global.shared && global.shared.store);
  return [
    ...detectMasteryRegression(),
    ...detectZeroRoiSpend(),
    ...detectProviderErrorSpike(),
    ...detectStalledQuestConcepts(sharedStore),
  ];
}

/**
 * Upsert anomalies into brain_anomaly, preserving acknowledged_at on existing
 * rows. Stale rows (kind+key not in the new set) are dropped EXCEPT those
 * acknowledged within ACK_TTL_DAYS — we keep their tombstones so a re-trigger
 * inside the silence window doesn't surface again. Returns counts.
 */
function persistAnomalies(anomalies) {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    const seen = new Set();
    const upsert = db.prepare(`
      INSERT INTO brain_anomaly (kind, key, severity, evidence_json, since_ts, last_seen_ts)
      VALUES (@kind, @key, @severity, @evidence_json, @since_ts, @last_seen_ts)
      ON CONFLICT(kind, key) DO UPDATE SET
        severity = excluded.severity,
        evidence_json = excluded.evidence_json,
        last_seen_ts = excluded.last_seen_ts
    `);
    for (const a of anomalies) {
      seen.add(`${a.kind}::${a.key}`);
      upsert.run({
        kind: a.kind,
        key: a.key,
        severity: a.severity,
        evidence_json: JSON.stringify(a.evidence || {}),
        since_ts: a.sinceTs,
        last_seen_ts: now,
      });
    }
    // Drop rows that no longer trigger AND aren't recently acknowledged.
    // We can't pass `seen` to SQL directly; iterate in JS.
    const ackCutoff = now - ANOMALY.ACK_TTL_DAYS * DAY;
    const all = db.prepare(
      `SELECT id, kind, key, acknowledged_at FROM brain_anomaly`,
    ).all();
    const drop = db.prepare(`DELETE FROM brain_anomaly WHERE id = ?`);
    let removed = 0;
    for (const row of all) {
      if (seen.has(`${row.kind}::${row.key}`)) continue;
      if (row.acknowledged_at && row.acknowledged_at > ackCutoff) continue;
      drop.run(row.id);
      removed += 1;
    }
    return { upserted: anomalies.length, removed };
  });
  return tx();
}

function listAnomalies({ includeAcknowledged = false } = {}) {
  const now = Date.now();
  const ackCutoff = now - ANOMALY.ACK_TTL_DAYS * DAY;
  const rows = getDb().prepare(`
    SELECT id, kind, key, severity, evidence_json, since_ts, last_seen_ts, acknowledged_at
    FROM brain_anomaly
    ORDER BY last_seen_ts DESC
  `).all();
  return rows
    .filter((r) => includeAcknowledged
      || !r.acknowledged_at
      || r.acknowledged_at <= ackCutoff)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      key: r.key,
      severity: r.severity,
      evidence: r.evidence_json ? JSON.parse(r.evidence_json) : null,
      sinceTs: r.since_ts,
      lastSeenTs: r.last_seen_ts,
      acknowledgedAt: r.acknowledged_at,
    }));
}

function acknowledgeAnomaly(id) {
  const now = Date.now();
  getDb().prepare(
    `UPDATE brain_anomaly SET acknowledged_at = ? WHERE id = ?`,
  ).run(now, id);
  return { acknowledged: true, at: now };
}

async function runAndPersist({ store } = {}) {
  const found = runDetectors({ store });
  const counts = persistAnomalies(found);
  return { found: found.length, ...counts };
}

module.exports = {
  // pure classifiers (testable without DB)
  classifyMasteryRegression,
  classifyZeroRoi,
  classifyProviderErrorSpike,
  classifyStalled,
  // detector pipeline
  runDetectors,
  persistAnomalies,
  listAnomalies,
  acknowledgeAnomaly,
  runAndPersist,
  // helpers
  activeQuestBookIds,
};
