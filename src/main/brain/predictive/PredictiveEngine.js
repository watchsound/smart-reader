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
    let cache = readCache();
    if (!cache || Date.now() - cache.computedAt > REFRESH_INTERVAL_MS) {
      await this.refreshModel({ force: true });
      cache = readCache();
    }

    const sbMap = new Map(cache.surfaceBox);
    const sMap = new Map(cache.surface);
    const globalAgg = cache.global;

    const globalParent = aggToParent(globalAgg);
    const surfaceAgg = sMap.get(featureSurface);
    const surfaceParent = aggToParent(surfaceAgg, globalParent);
    const sbAgg = sbMap.get(`${featureSurface}|${currentBox}`);
    const sbParent = aggToParent(sbAgg, surfaceParent);

    const cell = cache.cells.find(
      (c) => c.featureSurface === featureSurface && c.currentBox === currentBox && c.domain === domain,
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

    const costRow = (cache.cost || []).find((r) => r.featureSurface === featureSurface);
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
      computedAt: cache.computedAt,
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
