const { projectMastery } = require('../../main/brain/predictive/conceptProjection');

describe('projectMastery (pure math)', () => {
  test('flat projection when insufficient data', () => {
    const p = projectMastery({
      currentMastery: 30,
      expectedDeltaPerEvent: 5,
      ratePerDay: 1,
      n: 0,
      shrinkageLevel: 'global',
    });
    expect(p.insufficientData).toBe(true);
    expect(p.etaDays).toBeNull();
    expect(p.series).toHaveLength(30);
    expect(p.series.every((s) => s.mastery === 30)).toBe(true);
  });

  test('flat projection when ratePerDay is 0', () => {
    const p = projectMastery({
      currentMastery: 50,
      expectedDeltaPerEvent: 5,
      ratePerDay: 0,
      n: 100,
      shrinkageLevel: 'cell',
    });
    expect(p.insufficientData).toBe(true);
    expect(p.etaDays).toBeNull();
  });

  test('linear projection reaches target → etaDays correct', () => {
    // Δ per day = 1 * 2 = 2. From 30 → 80 needs 25 days.
    const p = projectMastery({
      currentMastery: 30,
      expectedDeltaPerEvent: 2,
      ratePerDay: 1,
      n: 30,
      shrinkageLevel: 'cell',
    });
    expect(p.insufficientData).toBe(false);
    expect(p.etaDays).toBe(25);
    expect(p.series[24].mastery).toBeGreaterThanOrEqual(80);
    expect(p.series[23].mastery).toBeLessThan(80);
  });

  test('near-target concept reaches in 1 day', () => {
    const p = projectMastery({
      currentMastery: 78,
      expectedDeltaPerEvent: 10,
      ratePerDay: 0.5,
      n: 50,
      shrinkageLevel: 'cell',
    });
    // 0.5 * 10 = 5 per day, 78 → 83 in 1 day
    expect(p.etaDays).toBe(1);
  });

  test('non-reaching projection → etaDays null but series shows growth', () => {
    const p = projectMastery({
      currentMastery: 30,
      expectedDeltaPerEvent: 0.5,
      ratePerDay: 0.5,
      n: 20,
      shrinkageLevel: 'cell',
    });
    expect(p.etaDays).toBeNull();
    // Growth of 0.25/day over 30 days = 7.5; final mastery = 37.5
    expect(p.series[29].mastery).toBeGreaterThan(p.series[0].mastery);
    expect(p.series[29].mastery).toBeLessThan(80);
  });

  test('mastery clamps at 100', () => {
    const p = projectMastery({
      currentMastery: 95,
      expectedDeltaPerEvent: 50,
      ratePerDay: 5,
      n: 100,
      shrinkageLevel: 'cell',
    });
    expect(p.series[0].mastery).toBe(100);
    expect(p.series[29].mastery).toBe(100);
  });
});
