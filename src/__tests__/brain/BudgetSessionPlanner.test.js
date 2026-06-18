const { greedyFill } = require('../../main/utils/BudgetSessionPlanner');

function c(id, opts) {
  return {
    learningPointId: id,
    title: id,
    surface: opts.surface || 'director-session',
    timeMin: opts.timeMin,
    expectedCost: opts.expectedCost,
    expectedDelta: opts.expectedDelta,
    roi: opts.expectedDelta / Math.max(opts.expectedCost, 1e-9),
  };
}

describe('BudgetSessionPlanner.greedyFill (pure)', () => {
  test('empty candidates → empty plan', () => {
    const out = greedyFill([], { timeBudgetMin: 15, dollarBudget: 1 });
    expect(out.items).toEqual([]);
    expect(out.totals).toEqual({ timeMin: 0, cost: 0, deltaMastery: 0 });
  });

  test('greedy picks highest ROI first', () => {
    const items = [
      c('lo', { timeMin: 1, expectedCost: 0.01, expectedDelta: 1 }), // ROI 100
      c('hi', { timeMin: 1, expectedCost: 0.001, expectedDelta: 1 }), // ROI 1000
    ];
    const out = greedyFill(items, { timeBudgetMin: 15, dollarBudget: 1 });
    expect(out.items.map((x) => x.learningPointId)).toEqual(['hi', 'lo']);
  });

  test('time budget stops fill while cost slack remains', () => {
    const items = [
      c('a', { timeMin: 8, expectedCost: 0.01, expectedDelta: 10 }),
      c('b', { timeMin: 8, expectedCost: 0.01, expectedDelta: 9 }),
      c('c', { timeMin: 8, expectedCost: 0.01, expectedDelta: 8 }),
    ];
    const out = greedyFill(items, { timeBudgetMin: 15, dollarBudget: 1 });
    // Only one 8min fits in 15min budget
    expect(out.items).toHaveLength(1);
    expect(out.items[0].learningPointId).toBe('a');
    expect(out.totals.timeMin).toBe(8);
  });

  test('cost budget stops fill while time slack remains', () => {
    const items = [
      c('a', { timeMin: 1, expectedCost: 0.10, expectedDelta: 10 }),
      c('b', { timeMin: 1, expectedCost: 0.10, expectedDelta: 9 }),
      c('c', { timeMin: 1, expectedCost: 0.10, expectedDelta: 8 }),
    ];
    const out = greedyFill(items, { timeBudgetMin: 60, dollarBudget: 0.15 });
    expect(out.items).toHaveLength(1);
    expect(out.items[0].learningPointId).toBe('a');
  });

  test('ROI tie broken by expectedDelta', () => {
    const items = [
      c('big',   { timeMin: 1, expectedCost: 0.001, expectedDelta: 5 }),
      c('small', { timeMin: 1, expectedCost: 0.0002, expectedDelta: 1 }), // same ROI=5000
    ];
    const out = greedyFill(items, { timeBudgetMin: 60, dollarBudget: 1 });
    expect(out.items[0].learningPointId).toBe('big');
  });

  test('skips items that would overflow but continues with smaller', () => {
    const items = [
      c('huge',  { timeMin: 20, expectedCost: 0.01, expectedDelta: 100 }), // ROI 10000 but too big
      c('small', { timeMin: 5,  expectedCost: 0.01, expectedDelta: 5 }),   // ROI 500 but fits
    ];
    const out = greedyFill(items, { timeBudgetMin: 15, dollarBudget: 1 });
    expect(out.items.map((x) => x.learningPointId)).toEqual(['small']);
  });

  test('totals are accurate', () => {
    const items = [
      c('a', { timeMin: 3, expectedCost: 0.05, expectedDelta: 5 }),
      c('b', { timeMin: 5, expectedCost: 0.04, expectedDelta: 4 }),
    ];
    const out = greedyFill(items, { timeBudgetMin: 15, dollarBudget: 1 });
    expect(out.totals).toEqual({ timeMin: 8, cost: 0.09, deltaMastery: 9 });
  });
});
