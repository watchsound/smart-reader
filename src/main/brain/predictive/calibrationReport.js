const dbManager = require('../../db/dbManager');
const { COVERAGE_MIN_N, EXCLUDED_SURFACES, DEFAULT_WINDOW_DAYS } = require('./predictiveEnums');

async function computeReport(engine, { windowDays = DEFAULT_WINDOW_DAYS } = {}) {
  const now = Date.now();
  const fromMs = now - windowDays * 86_400_000;
  const excluded = EXCLUDED_SURFACES.map(() => '?').join(',');
  const events = dbManager.getDb().prepare(`
    SELECT e.feature_surface AS featureSurface, e.prev_box AS currentBox,
           lp.domain_type AS domain,
           (e.new_mastery - e.prev_mastery) AS delta,
           CASE WHEN e.new_box > e.prev_box THEN 1 ELSE 0 END AS boxUp
    FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE e.ts >= ? AND e.ts < ?
      AND e.feature_surface NOT IN (${excluded})
      AND e.prev_box IS NOT NULL
      AND e.prev_mastery IS NOT NULL AND e.new_mastery IS NOT NULL
      AND lp.domain_type IS NOT NULL
  `).all(fromMs, now, ...EXCLUDED_SURFACES);

  if (events.length === 0) {
    return { reliability: [], brierScore: 0, coverage: 0, asOf: now };
  }

  const predictions = await Promise.all(events.map(async (e) => {
    const p = await engine.predict({
      featureSurface: e.featureSurface, currentBox: e.currentBox, domain: e.domain,
    });
    return { ...e, predictedDelta: p.expectedMasteryDelta, pBoxUp: p.pBoxUp, n: p.n };
  }));

  const sorted = [...predictions].sort((a, b) => a.predictedDelta - b.predictedDelta);
  const bins = 5;
  const reliability = [];
  const binSize = Math.max(1, Math.floor(sorted.length / bins));
  for (let i = 0; i < bins; i++) {
    const slice = sorted.slice(i * binSize, i === bins - 1 ? sorted.length : (i + 1) * binSize);
    if (slice.length === 0) continue;
    const mp = slice.reduce((s, r) => s + r.predictedDelta, 0) / slice.length;
    const mr = slice.reduce((s, r) => s + r.delta, 0) / slice.length;
    reliability.push({ bin: i, predictedDelta: mp, realizedDelta: mr, n: slice.length });
  }

  const brier = predictions.reduce(
    (s, r) => s + (r.pBoxUp - r.boxUp) * (r.pBoxUp - r.boxUp), 0,
  ) / predictions.length;

  const covered = predictions.filter((r) => r.n >= COVERAGE_MIN_N).length;
  const coverage = covered / predictions.length;

  return { reliability, brierScore: brier, coverage, asOf: now };
}

module.exports = { computeReport };
