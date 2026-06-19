const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const {
  KAPPA_0, ALPHA_0, BETA_0, EXCLUDED_SURFACES,
  REFRESH_INTERVAL_MS, DEFAULT_WINDOW_DAYS, SHRINKAGE_LEVELS,
} = require('./predictiveEnums');
const { aggregateMasteryEventsByCell, aggregateCostBySurface } = require('./predictiveDao');
const { buildHierarchy } = require('./hierarchy');
const { posteriorDelta, posteriorPBoxUp } = require('./ebMath');

function cachePath() {
  return path.join(app.getPath('userData'), 'predictive_model.json');
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(cachePath(), 'utf8'));
  } catch { return null; }
}

function writeCache(payload) {
  const tmp = `${cachePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, cachePath());
}

// Module-level memo of the parsed cache + derived lookup maps. Shared across
// every PredictiveEngine instance so a Quest pacing pass over 50 concepts
// pays one parse + one Map build, not fifty. Re-parse is gated on file mtime
// — fs.statSync is ~1ms vs readFileSync+JSON.parse on the typical model file.
let _modelMemo = null;

function buildModel(file, mtime) {
  return {
    mtime,
    computedAt: file.computedAt,
    surfaceBoxMap: new Map(file.surfaceBox),
    surfaceMap: new Map(file.surface),
    // Composite-key index replaces the per-call `cells.find(...)` linear scan
    // (O(1) lookup for the rest of the pacing fan-out).
    cellsByKey: new Map(
      (file.cells || []).map((c) => [
        `${c.featureSurface}|${c.currentBox}|${c.domain}`,
        c,
      ]),
    ),
    global: file.global,
    cost: file.cost,
  };
}

function getCachedModel() {
  let mtime;
  try {
    mtime = fs.statSync(cachePath()).mtimeMs;
  } catch {
    _modelMemo = null;
    return null;
  }
  if (_modelMemo && _modelMemo.mtime === mtime) return _modelMemo;
  const file = readCache();
  if (!file) {
    _modelMemo = null;
    return null;
  }
  _modelMemo = buildModel(file, mtime);
  return _modelMemo;
}

// Test seam — lets unit tests reset the module-level memo between cases.
function _resetCacheMemoForTests() {
  _modelMemo = null;
}

function aggToParent(agg, fallback = { mean: 0, var: 1 }) {
  if (!agg || !agg.n) return fallback;
  const m = agg.sumDelta / agg.n;
  const v = Math.max(0.01, agg.sumDeltaSq / agg.n - m * m);
  return { mean: m, var: v };
}

class PredictiveEngine {
  async predict({ featureSurface, currentBox, domain }) {
    if (EXCLUDED_SURFACES.includes(featureSurface)) {
      throw new Error(`predict: featureSurface "${featureSurface}" is excluded`);
    }
    let model = getCachedModel();
    if (!model || Date.now() - model.computedAt > REFRESH_INTERVAL_MS) {
      await this.refreshModel({ force: true });
      model = getCachedModel();
    }

    const globalParent = aggToParent(model.global);
    const surfaceAgg = model.surfaceMap.get(featureSurface);
    const surfaceParent = aggToParent(surfaceAgg, globalParent);
    const sbAgg = model.surfaceBoxMap.get(`${featureSurface}|${currentBox}`);
    const sbParent = aggToParent(sbAgg, surfaceParent);

    const cell = model.cellsByKey.get(
      `${featureSurface}|${currentBox}|${domain}`,
    );

    let level;
    let cellInput;
    if (cell && cell.n) {
      level = SHRINKAGE_LEVELS.CELL;
      cellInput = cell;
    } else if (sbAgg && sbAgg.n) {
      level = SHRINKAGE_LEVELS.SURFACE_BOX;
      cellInput = { ...sbAgg, s: sbAgg.boxUpCount };
    } else if (surfaceAgg && surfaceAgg.n) {
      level = SHRINKAGE_LEVELS.SURFACE;
      cellInput = { ...surfaceAgg, s: surfaceAgg.boxUpCount };
    } else {
      level = SHRINKAGE_LEVELS.GLOBAL;
      cellInput = { n: 0, sumDelta: 0, sumDeltaSq: 0, s: 0 };
    }

    const deltaPost = posteriorDelta(cellInput, sbParent);
    const pUpPost = posteriorPBoxUp(
      { n: cellInput.n, s: cellInput.s || 0 },
      { alpha: ALPHA_0, beta: BETA_0 },
    );

    const costRow = (model.cost || []).find((r) => r.featureSurface === featureSurface);
    const expectedCost = costRow ? costRow.meanCost : 0;
    const p95Cost = costRow ? costRow.p95Cost : 0;

    return {
      expectedMasteryDelta: deltaPost.mean,
      deltaStd: deltaPost.std,
      pBoxUp: pUpPost.mean,
      expectedCost,
      p95Cost,
      n: cellInput.n,
      shrinkageLevel: level,
      computedAt: model.computedAt,
    };
  }

  async rankCandidates(candidates) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const EPS = 1e-9;
    const enriched = await Promise.all(candidates.map(async (c) => {
      const prediction = await this.predict({
        featureSurface: c.featureSurface, currentBox: c.currentBox, domain: c.domain,
      });
      const roi = prediction.expectedMasteryDelta / Math.max(prediction.expectedCost, EPS);
      return { ...c, prediction, roi };
    }));
    enriched.sort((a, b) => {
      if (b.roi !== a.roi) return b.roi - a.roi;
      return b.prediction.expectedMasteryDelta - a.prediction.expectedMasteryDelta;
    });
    return enriched;
  }

  async refreshModel({ force = false } = {}) {
    const cache = readCache();
    if (!force && cache && Date.now() - cache.computedAt < REFRESH_INTERVAL_MS) {
      return { refreshed: false, cells: (cache.cells || []).length, computedAt: cache.computedAt };
    }
    const now = Date.now();
    const fromMs = now - DEFAULT_WINDOW_DAYS * 86_400_000;
    const cellAgg = aggregateMasteryEventsByCell({ fromMs, toMs: now });
    const cost = aggregateCostBySurface({ fromMs, toMs: now });
    const hierarchy = buildHierarchy(cellAgg);
    const payload = {
      cells: cellAgg.map((r) => ({ ...r, s: r.boxUpCount })),
      surfaceBox: Array.from(hierarchy.surfaceBox.entries()),
      surface: Array.from(hierarchy.surface.entries()),
      global: hierarchy.global,
      cost,
      windowDays: DEFAULT_WINDOW_DAYS,
      computedAt: now,
    };
    writeCache(payload);
    return { refreshed: true, cells: payload.cells.length, computedAt: now };
  }

  async calibrationReport(opts = {}) {
    const { computeReport } = require('./calibrationReport');
    return computeReport(this, opts);
  }
}

module.exports = PredictiveEngine;
module.exports.PredictiveEngine = PredictiveEngine;
module.exports._resetCacheMemoForTests = _resetCacheMemoForTests;
