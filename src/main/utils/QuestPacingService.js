/**
 * QuestPacingService — Phase 14e Quest pacing forecaster.
 *
 * Given a Quest's bookIds, returns:
 *   - completion fraction (lps at mastery ≥ 80)
 *   - max etaDays across analyzed lps (Quest ETA)
 *   - top-N bottleneck concepts sorted by (etaDays desc, mastery asc, stalled desc)
 *
 * Pure backend module — DB + PredictiveEngine reuse. Caps analysis to
 * `TOP_N_ANALYZED` most-recently-updated lps so per-concept projection
 * cost stays bounded for Quests spanning many books.
 *
 * Spec: docs/superpowers/specs/2026-06-18-phase-14e-quest-pacing-design.md
 */

const TOP_N_ANALYZED = 50;
const BOTTLENECK_LIMIT = 5;
const MASTERY_THRESHOLD = 80;
const STALLED_DAYS_THRESHOLD = 7;
const DAY = 86_400_000;

function getDb() { return require('../db/dbManager').getDb(); }

function pickLearningPointsInScope(bookIds) {
  if (!Array.isArray(bookIds) || bookIds.length === 0) return [];
  const placeholders = bookIds.map(() => '?').join(',');
  return getDb().prepare(`
    SELECT id, title, box, mastery_level AS masteryLevel, domain_type AS domainType,
           book_id AS bookId, updated_at AS updatedAt
    FROM learning_point
    WHERE book_id IN (${placeholders})
  `).all(...bookIds);
}

function lastEventTsForLp(learningPointId) {
  const row = getDb().prepare(
    `SELECT MAX(ts) AS lastTs FROM mastery_event WHERE learning_point_id = ?`,
  ).get(learningPointId);
  return row && row.lastTs ? row.lastTs : null;
}

function stalledDaysFor(learningPointId) {
  const last = lastEventTsForLp(learningPointId);
  if (!last) return null;
  return Math.floor((Date.now() - last) / DAY);
}

function bottleneckReason({ etaDays, masteryLevel, stalledDays, shrinkageLevel }) {
  if (stalledDays != null && stalledDays >= STALLED_DAYS_THRESHOLD) {
    return `stalled ${stalledDays}d`;
  }
  if (masteryLevel != null && masteryLevel < 40) return 'low mastery';
  if (shrinkageLevel === 'global' || shrinkageLevel === 'surface') return 'sparse coverage';
  if (etaDays != null && etaDays >= 25) return 'slow projection';
  return 'in progress';
}

async function computePacing({ bookIds, engine }) {
  const allLps = pickLearningPointsInScope(bookIds);
  if (allLps.length === 0) {
    return {
      conceptsTotal: 0,
      conceptsMastered: 0,
      completionFraction: 0,
      etaDays: null,
      indeterminateCount: 0,
      bottlenecks: [],
      basis: { topNAnalyzed: 0, scopeTotal: 0 },
    };
  }

  const conceptsTotal = allLps.length;
  const conceptsMastered = allLps.filter(
    (lp) => (lp.masteryLevel || 0) >= MASTERY_THRESHOLD,
  ).length;
  const completionFraction = conceptsMastered / conceptsTotal;

  const sorted = [...allLps].sort((a, b) => {
    const ax = a.updatedAt || '';
    const bx = b.updatedAt || '';
    return bx.localeCompare(ax);
  });
  const analyzed = sorted.slice(0, TOP_N_ANALYZED);

  const { getConceptProjection } = require('../brain/predictive/conceptProjection');
  const projections = await Promise.all(analyzed.map(async (lp) => {
    try {
      const projection = await getConceptProjection({ learningPoint: lp, engine });
      const stalledDays = stalledDaysFor(lp.id);
      return { lp, projection, stalledDays };
    } catch (_e) {
      return { lp, projection: null, stalledDays: null };
    }
  }));

  let maxEta = null;
  let indeterminateCount = 0;
  for (const { projection } of projections) {
    if (!projection || projection.etaDays == null) {
      indeterminateCount += 1;
    } else if (maxEta == null || projection.etaDays > maxEta) {
      maxEta = projection.etaDays;
    }
  }

  const rankedBottlenecks = projections
    .filter(({ lp }) => (lp.masteryLevel || 0) < MASTERY_THRESHOLD)
    .sort((a, b) => {
      const ae = a.projection?.etaDays ?? 999;
      const be = b.projection?.etaDays ?? 999;
      if (be !== ae) return be - ae;
      const am = a.lp.masteryLevel || 0;
      const bm = b.lp.masteryLevel || 0;
      if (am !== bm) return am - bm;
      const ast = a.stalledDays || 0;
      const bst = b.stalledDays || 0;
      return bst - ast;
    })
    .slice(0, BOTTLENECK_LIMIT)
    .map(({ lp, projection, stalledDays }) => ({
      learningPointId: lp.id,
      title: lp.title,
      etaDays: projection?.etaDays ?? null,
      currentMastery: lp.masteryLevel || 0,
      stalledDays,
      reason: bottleneckReason({
        etaDays: projection?.etaDays ?? null,
        masteryLevel: lp.masteryLevel,
        stalledDays,
        shrinkageLevel: projection?.shrinkageLevel,
      }),
    }));

  return {
    conceptsTotal,
    conceptsMastered,
    completionFraction,
    etaDays: maxEta,
    indeterminateCount,
    bottlenecks: rankedBottlenecks,
    basis: {
      topNAnalyzed: analyzed.length,
      scopeTotal: conceptsTotal,
    },
  };
}

module.exports = {
  computePacing,
  bottleneckReason,
  TOP_N_ANALYZED,
  BOTTLENECK_LIMIT,
  MASTERY_THRESHOLD,
  STALLED_DAYS_THRESHOLD,
};
