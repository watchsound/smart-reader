const dbManager = require('../../db/dbManager');
const { EXCLUDED_SURFACES } = require('./predictiveEnums');

function aggregateMasteryEventsByCell({ fromMs, toMs }) {
  const excluded = EXCLUDED_SURFACES.map(() => '?').join(',');
  return dbManager.getDb().prepare(`
    SELECT
      e.feature_surface AS featureSurface,
      e.prev_box AS currentBox,
      lp.domain_type AS domain,
      COUNT(*) AS n,
      COALESCE(SUM(e.new_mastery - e.prev_mastery), 0) AS sumDelta,
      COALESCE(SUM((e.new_mastery - e.prev_mastery) * (e.new_mastery - e.prev_mastery)), 0) AS sumDeltaSq,
      SUM(CASE WHEN e.new_box > e.prev_box THEN 1 ELSE 0 END) AS boxUpCount
    FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE e.ts >= ? AND e.ts < ?
      AND e.feature_surface NOT IN (${excluded})
      AND e.prev_box IS NOT NULL
      AND e.prev_mastery IS NOT NULL AND e.new_mastery IS NOT NULL
      AND lp.domain_type IS NOT NULL
    GROUP BY e.feature_surface, e.prev_box, lp.domain_type
  `).all(fromMs, toMs, ...EXCLUDED_SURFACES);
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[Math.max(0, idx)];
}

function aggregateCostBySurface({ fromMs, toMs }) {
  const rows = dbManager.getDb().prepare(`
    SELECT e.feature_surface AS featureSurface, c.cost_usd AS cost
    FROM mastery_event e
    JOIN brain_call_ledger c ON c.id = e.proximate_call_id
    WHERE e.ts >= ? AND e.ts < ?
      AND e.proximate_call_id IS NOT NULL
  `).all(fromMs, toMs);

  const bySurface = new Map();
  for (const r of rows) {
    if (!bySurface.has(r.featureSurface)) bySurface.set(r.featureSurface, []);
    bySurface.get(r.featureSurface).push(r.cost || 0);
  }

  return Array.from(bySurface.entries()).map(([featureSurface, costs]) => {
    costs.sort((a, b) => a - b);
    const mean = costs.reduce((s, v) => s + v, 0) / costs.length;
    return { featureSurface, meanCost: mean, p95Cost: percentile(costs, 0.95), n: costs.length };
  });
}

module.exports = { aggregateMasteryEventsByCell, aggregateCostBySurface };
