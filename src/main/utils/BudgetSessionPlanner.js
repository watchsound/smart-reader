/**
 * BudgetSessionPlanner — Phase 14d.
 *
 * Given (timeBudgetMin, dollarBudget, userId), returns a greedy-ROI plan
 * of (surface, learning_point) actions whose total time + cost fit the
 * budget. Pulls candidate lps from FSRS-due ∪ active-Quest below-mastery
 * scope, scores each via the Predictive Engine, sorts by ROI desc, and
 * fills until either budget exhausts.
 *
 * Spec: docs/superpowers/specs/2026-06-18-phase-14d-budget-session-planner-design.md
 */

const {
  TIME_PER_EVENT_SEC,
  DEFAULT_TIME_PER_EVENT_SEC,
  EXCLUDED_SURFACES,
} = require('../brain/predictive/predictiveEnums');

const CANDIDATE_CAP = 100;
const MASTERY_THRESHOLD = 80;
const SURFACE_LOOKBACK_DAYS = 30;
const DAY = 86_400_000;

function getDb() { return require('../db/dbManager').getDb(); }

/**
 * Pure greedy fill — sort candidates by ROI desc, add while budgets hold.
 * Extracted for unit testing without DB access.
 */
function greedyFill(candidates, { timeBudgetMin, dollarBudget }) {
  const sorted = [...candidates].sort((a, b) => {
    if (b.roi !== a.roi) return b.roi - a.roi;
    return b.expectedDelta - a.expectedDelta;
  });
  const chosen = [];
  let timeSpent = 0;
  let costSpent = 0;
  for (const c of sorted) {
    if (timeSpent + c.timeMin > timeBudgetMin) continue;
    if (costSpent + c.expectedCost > dollarBudget) continue;
    chosen.push(c);
    timeSpent += c.timeMin;
    costSpent += c.expectedCost;
  }
  return {
    items: chosen,
    totals: {
      timeMin: timeSpent,
      cost: costSpent,
      deltaMastery: chosen.reduce((s, c) => s + c.expectedDelta, 0),
    },
  };
}

function activeQuestBookIds(store) {
  if (!store) return [];
  try {
    const quests = store.get('brainShell.quests') || [];
    return Array.from(new Set(
      quests
        .filter((q) => q.status === 'active')
        .flatMap((q) => Array.isArray(q.bookIds) ? q.bookIds : []),
    ));
  } catch (_e) {
    return [];
  }
}

function collectCandidates({ userId }) {
  const db = getDb();
  // Active Quest scope is opportunistic — only consulted when the
  // brainShell store has a quest list; otherwise we fall back to "all
  // lps below mastery threshold."
  let store = null;
  try {
    store = global.shared && global.shared.store;
  } catch (_e) { /* ignore */ }
  const questBooks = activeQuestBookIds(store);

  const now = Date.now();
  // Pool A: FSRS-due.
  const dueRows = db.prepare(`
    SELECT id, title, book_id AS bookId, box, mastery_level AS masteryLevel,
           domain_type AS domainType, updated_at AS updatedAt,
           next_review AS nextReview
    FROM learning_point
    WHERE user_id = ?
      AND next_review IS NOT NULL
      AND next_review <= ?
    ORDER BY updated_at DESC
    LIMIT ?
  `).all(userId, new Date(now).toISOString(), CANDIDATE_CAP);

  let questRows = [];
  if (questBooks.length > 0) {
    const placeholders = questBooks.map(() => '?').join(',');
    questRows = db.prepare(`
      SELECT id, title, book_id AS bookId, box, mastery_level AS masteryLevel,
             domain_type AS domainType, updated_at AS updatedAt,
             next_review AS nextReview
      FROM learning_point
      WHERE user_id = ?
        AND book_id IN (${placeholders})
        AND (mastery_level IS NULL OR mastery_level < ?)
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(userId, ...questBooks, MASTERY_THRESHOLD, CANDIDATE_CAP);
  }

  const seen = new Set();
  const merged = [];
  for (const row of [...dueRows, ...questRows]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
    if (merged.length >= CANDIDATE_CAP) break;
  }
  return merged;
}

function surfacesForLp(lpId) {
  const excluded = EXCLUDED_SURFACES.map(() => '?').join(',');
  const fromMs = Date.now() - SURFACE_LOOKBACK_DAYS * DAY;
  const rows = getDb().prepare(`
    SELECT feature_surface AS surface, COUNT(*) AS n
    FROM mastery_event
    WHERE learning_point_id = ?
      AND ts >= ?
      AND feature_surface NOT IN (${excluded})
    GROUP BY feature_surface
    ORDER BY n DESC
  `).all(lpId, fromMs, ...EXCLUDED_SURFACES);
  if (rows.length === 0) return ['director-session'];
  return rows.map((r) => r.surface);
}

function actionTargetFor(surface) {
  switch (surface) {
    case 'production-prompt': return 'production-prompt';
    case 'director-session':  return 'director-session';
    case 'reading-microcard': return 'reading';
    case 'comprehension':     return 'reading';
    case 'pre-reading-diagnostic': return 'reading';
    default: return null;
  }
}

async function scoreCandidate({ lp, surface, engine }) {
  const time = TIME_PER_EVENT_SEC[surface] || DEFAULT_TIME_PER_EVENT_SEC;
  const timeMin = time / 60;
  let pred;
  try {
    pred = await engine.predict({
      featureSurface: surface,
      currentBox: lp.box || 1,
      domain: lp.domainType || 'knowledge',
    });
  } catch (_e) { return null; }
  if (pred.expectedCost <= 0 && pred.expectedMasteryDelta <= 0) return null;
  const roi = pred.expectedMasteryDelta / Math.max(pred.expectedCost, 1e-9);
  return {
    learningPointId: lp.id,
    title: lp.title,
    surface,
    domain: lp.domainType || 'knowledge',
    currentBox: lp.box || 1,
    expectedDelta: pred.expectedMasteryDelta,
    expectedCost: pred.expectedCost,
    timeMin,
    roi,
    shrinkageLevel: pred.shrinkageLevel,
    n: pred.n,
    actionTarget: actionTargetFor(surface),
    actionPayload: { bookId: lp.bookId, learningPointId: lp.id },
  };
}

async function computePlan({ timeBudgetMin = 15, dollarBudget = 0.30, userId = 1 } = {}) {
  const lps = collectCandidates({ userId });
  if (lps.length === 0) {
    return { items: [], totals: { timeMin: 0, cost: 0, deltaMastery: 0 } };
  }
  // eslint-disable-next-line global-require
  const PredictiveEngine = require('../brain/predictive/PredictiveEngine');
  const engine = new PredictiveEngine();

  const rows = [];
  for (const lp of lps) {
    const surfaces = surfacesForLp(lp.id);
    for (const surface of surfaces) {
      // eslint-disable-next-line no-await-in-loop
      const c = await scoreCandidate({ lp, surface, engine });
      if (c) rows.push(c);
    }
  }
  return greedyFill(rows, { timeBudgetMin, dollarBudget });
}

module.exports = {
  computePlan,
  greedyFill,
  CANDIDATE_CAP,
  MASTERY_THRESHOLD,
};
