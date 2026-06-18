/**
 * AttributionService — thin amortization wrapper over CallLedgerStore.
 *
 * Owns: amortization arithmetic + lens grouping + label resolution.
 * Does NOT own raw SQL — CallLedgerStore handles all data access.
 *
 * Task 6 skeleton; Tasks 7 and 8 will implement getBars() and getGroupDetail().
 */

const CallLedgerStore = require('../db/CallLedgerStore');
const { ATTENTION_STATE, PHASE_GROUP } = require('../../commons/model/featureSurface');

// Intents that always carry their own proximate_call_id (events with these
// intents are direct attributions; their cost is NOT pooled for amortization).
const DIRECT_INTENTS = new Set([
  'director-session-step',
  'grade-comprehension',
  'production-grade',
]);

class AttributionService {
  async getBars({ lens, from, to, userId }) {
    const perSurface = CallLedgerStore.aggregateAttribution({ userId, fromMs: from, toMs: to });
    const intentSpend = CallLedgerStore.intentSpendInWindow({ fromMs: from, toMs: to });

    const totalAmortizingSpend = Object.entries(intentSpend)
      .filter(([intent]) => !DIRECT_INTENTS.has(intent))
      .reduce((s, [, v]) => s + v, 0);
    const totalAmortizedEvents = perSurface.reduce(
      (s, r) => s + (r.amortized_event_count || 0), 0);

    // Build the per-surface cost model: direct + amortized share
    const surfaceCost = {};
    perSurface.forEach((r) => {
      const amortized = (totalAmortizedEvents > 0 && r.amortized_event_count > 0)
        ? totalAmortizingSpend * (r.amortized_event_count / totalAmortizedEvents)
        : 0;
      surfaceCost[r.feature_surface] = {
        eventCount: (r.direct_event_count || 0) + (r.amortized_event_count || 0),
        totalCostUsd: (r.direct_cost_usd || 0) + amortized,
        direct_n: r.direct_event_count || 0,
        amortized_n: r.amortized_event_count || 0,
      };
    });

    if (lens === 'intent') {
      return this._barsByIntent({ userId, from, to });
    }

    const lensMap = lens === 'attention' ? ATTENTION_STATE : PHASE_GROUP;

    const groups = {};
    Object.entries(surfaceCost).forEach(([surface, v]) => {
      const key = lensMap[surface] || 'unknown';
      if (!groups[key]) groups[key] = { eventCount: 0, totalCostUsd: 0, direct_n: 0, amortized_n: 0 };
      groups[key].eventCount += v.eventCount;
      groups[key].totalCostUsd += v.totalCostUsd;
      groups[key].direct_n += v.direct_n;
      groups[key].amortized_n += v.amortized_n;
    });

    return Object.entries(groups).map(([key, g]) => ({
      groupKey: key,
      groupLabel: this._labelFor(lens, key),
      eventCount: g.eventCount,
      totalCostUsd: g.totalCostUsd,
      costPerEvent: g.eventCount > 0 ? g.totalCostUsd / g.eventCount : 0,
      directlyAttributedCount: g.direct_n,
      amortizedCount: g.amortized_n,
    })).sort((a, b) => a.costPerEvent - b.costPerEvent);
  }

  async _barsByIntent({ userId, from, to }) {
    const dbManager = require('../db/dbManager');
    const rows = dbManager.getDb().prepare(`
      SELECT c.intent AS intent, COUNT(*) AS event_count,
             SUM(c.cost_usd) AS total_cost_usd
      FROM mastery_event e
      JOIN brain_call_ledger c ON c.id = e.proximate_call_id
      WHERE e.user_id = ? AND e.ts >= ? AND e.ts < ?
      GROUP BY c.intent
    `).all(userId, from, to);

    return rows.map((r) => ({
      groupKey: r.intent,
      groupLabel: r.intent,
      eventCount: r.event_count,
      totalCostUsd: r.total_cost_usd || 0,
      costPerEvent: r.event_count > 0 ? (r.total_cost_usd || 0) / r.event_count : 0,
      directlyAttributedCount: r.event_count,
      amortizedCount: 0,
    })).sort((a, b) => a.costPerEvent - b.costPerEvent);
  }

  _labelFor(lens, key) {
    if (lens === 'attention') {
      return {
        'while-reading': 'While reading',
        'focused-session': 'Focused session',
        'historical': 'Untracked (historical)',
      }[key] || key;
    }
    if (lens === 'phase') {
      return {
        'reading-loop': 'Reading loop',
        'diagnostics': 'Pre-reading diagnostics',
        'director': 'Director sessions',
        'comprehension': 'Comprehension grading',
        'production-prompts': 'Production prompts',
        'manual-review': 'Manual review',
        'historical': 'Untracked (historical)',
      }[key] || key;
    }
    return key;
  }

  async getGroupDetail({ lens, groupKey, from, to, userId, limit = 50 }) {
    const lensMap = lens === 'attention' ? ATTENTION_STATE
                  : lens === 'phase'     ? PHASE_GROUP
                  : null;

    const rows = lens === 'intent'
      ? CallLedgerStore.attributionGroupDetail({
          userId, fromMs: from, toMs: to, intent: groupKey, limit,
        })
      : CallLedgerStore.attributionGroupDetail({
          userId, fromMs: from, toMs: to,
          surfaces: Object.keys(lensMap).filter((s) => lensMap[s] === groupKey),
          limit,
        });

    const bars = await this.getBars({ lens, from, to, userId });
    const groupBar = bars.find((b) => b.groupKey === groupKey)
      || { eventCount: 0, totalCostUsd: 0, groupLabel: groupKey };
    const amortizedUnitCost = groupBar.eventCount > 0
      ? groupBar.totalCostUsd / groupBar.eventCount : 0;

    return {
      group: {
        key: groupKey,
        label: groupBar.groupLabel,
        totalCostUsd: groupBar.totalCostUsd,
        eventCount: groupBar.eventCount,
      },
      events: rows.map((r) => ({
        learningPointId: r.learning_point_id,
        ts: r.ts,
        featureSurface: r.feature_surface,
        proximateCallId: r.proximate_call_id,
        intent: r.intent || null,
        eventCostUsd: r.proximate_cost_usd != null ? r.proximate_cost_usd : amortizedUnitCost,
        amortized: r.proximate_call_id == null,
      })),
    };
  }

  async getDensityStrip(opts)  { return CallLedgerStore.attributionDensityStrip(opts); }
}

module.exports = AttributionService;
