/**
 * conceptProjection — compute a 30-day forward mastery projection for a
 * single learning_point. Used by BrainVisibilityService.getConcept to
 * power the Phase 14c dashed sparkline + ETA chip.
 *
 * Spec: docs/superpowers/specs/2026-06-18-phase-14c-concept-eta-sparkline-design.md
 */

const { EXCLUDED_SURFACES } = require('./predictiveEnums');
// dbManager is lazy-required so the pure-math export (projectMastery)
// stays importable without triggering DB initialization in unit tests.
function getDb() { return require('../../db/dbManager').getDb(); }

const DAY = 86_400_000;
const MASTERY_TARGET = 80;
const RATE_CAP_PER_DAY = 5;
const PROJECTION_DAYS = 30;
const RATE_WINDOW_DAYS = 14;
const SURFACE_WINDOW_DAYS = 30;

/**
 * Pick the highest-frequency feature_surface for this concept in the last
 * 30 days. Falls through to domain-wide highest-frequency, then to
 * `'director-session'` as a final default.
 */
function pickSurface(learningPointId, domain) {
  const excluded = EXCLUDED_SURFACES.map(() => '?').join(',');
  const now = Date.now();
  const fromMs = now - SURFACE_WINDOW_DAYS * DAY;
  const db = getDb();

  const perConcept = db.prepare(`
    SELECT feature_surface AS surface, COUNT(*) AS n
    FROM mastery_event
    WHERE learning_point_id = ?
      AND ts >= ?
      AND feature_surface NOT IN (${excluded})
    GROUP BY feature_surface
    ORDER BY n DESC
    LIMIT 1
  `).get(learningPointId, fromMs, ...EXCLUDED_SURFACES);
  if (perConcept && perConcept.surface) return perConcept.surface;

  if (domain) {
    const perDomain = db.prepare(`
      SELECT e.feature_surface AS surface, COUNT(*) AS n
      FROM mastery_event e
      JOIN learning_point lp ON lp.id = e.learning_point_id
      WHERE lp.domain_type = ?
        AND e.ts >= ?
        AND e.feature_surface NOT IN (${excluded})
      GROUP BY e.feature_surface
      ORDER BY n DESC
      LIMIT 1
    `).get(domain, fromMs, ...EXCLUDED_SURFACES);
    if (perDomain && perDomain.surface) return perDomain.surface;
  }

  return 'director-session';
}

/**
 * Pick an event-rate-per-day estimate. Per-concept rate from last 14d if
 * concept has ≥2 events, else domain-wide rate spread across distinct
 * concepts in that domain. Capped at 5/day defensively.
 */
function pickEventRate(learningPointId, domain) {
  const now = Date.now();
  const fromMs = now - RATE_WINDOW_DAYS * DAY;
  const db = getDb();

  const perConceptRow = db.prepare(`
    SELECT COUNT(*) AS n FROM mastery_event
    WHERE learning_point_id = ? AND ts >= ?
  `).get(learningPointId, fromMs);
  const perConceptN = perConceptRow ? perConceptRow.n : 0;
  if (perConceptN >= 2) {
    return Math.min(perConceptN / RATE_WINDOW_DAYS, RATE_CAP_PER_DAY);
  }

  if (!domain) return 0;
  const domainRow = db.prepare(`
    SELECT COUNT(*) AS n FROM mastery_event e
    JOIN learning_point lp ON lp.id = e.learning_point_id
    WHERE lp.domain_type = ? AND e.ts >= ?
  `).get(domain, fromMs);
  const conceptCountRow = db.prepare(`
    SELECT COUNT(DISTINCT id) AS n FROM learning_point WHERE domain_type = ?
  `).get(domain);
  const domainN = domainRow ? domainRow.n : 0;
  const conceptCount = conceptCountRow ? Math.max(1, conceptCountRow.n) : 1;
  const rate = (domainN / RATE_WINDOW_DAYS) / conceptCount;
  return Math.min(rate, RATE_CAP_PER_DAY);
}

/**
 * Compute the projection given the per-cell prediction + chosen rate.
 * Pure function — extracted for unit-test isolation.
 */
function projectMastery({ currentMastery, expectedDeltaPerEvent, ratePerDay, n, shrinkageLevel }) {
  const series = [];
  const dailyDelta = ratePerDay * expectedDeltaPerEvent;
  const insufficientData = (n === 0 && shrinkageLevel === 'global') || ratePerDay === 0;
  let m = currentMastery;
  let etaDays = null;
  for (let d = 1; d <= PROJECTION_DAYS; d++) {
    if (!insufficientData) m = Math.min(100, m + dailyDelta);
    series.push({ day: d, mastery: m, isProjection: true });
    if (etaDays == null && !insufficientData && m >= MASTERY_TARGET) etaDays = d;
  }
  return { series, etaDays, insufficientData };
}

/**
 * Full projection for a concept. Uses the shared PredictiveEngine
 * singleton (lazy require to avoid circular deps).
 */
async function getConceptProjection({ learningPoint, engine }) {
  if (!learningPoint || !learningPoint.id) return null;
  const lp = learningPoint;
  const surface = pickSurface(lp.id, lp.domainType || lp.domain_type);
  const ratePerDay = pickEventRate(lp.id, lp.domainType || lp.domain_type);

  // eslint-disable-next-line global-require
  const PredictiveEngine = require('./PredictiveEngine');
  const eng = engine || new PredictiveEngine();
  let pred;
  try {
    pred = await eng.predict({
      featureSurface: surface,
      currentBox: lp.box || 1,
      domain: lp.domainType || lp.domain_type || 'knowledge',
    });
  } catch (_e) {
    return null;
  }

  const proj = projectMastery({
    currentMastery: lp.masteryLevel ?? lp.mastery_level ?? 0,
    expectedDeltaPerEvent: pred.expectedMasteryDelta,
    ratePerDay,
    n: pred.n,
    shrinkageLevel: pred.shrinkageLevel,
  });

  return {
    ...proj,
    basisSurface: surface,
    basisRate: ratePerDay,
    shrinkageLevel: pred.shrinkageLevel,
  };
}

module.exports = {
  getConceptProjection,
  projectMastery,
  pickSurface,
  pickEventRate,
  MASTERY_TARGET,
  PROJECTION_DAYS,
};
