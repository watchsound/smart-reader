const { posteriorDelta, posteriorPBoxUp } = require('../../main/brain/predictive/ebMath');

describe('ebMath.posteriorDelta (NIG conjugate)', () => {
  test('empty cell falls back to parent', () => {
    const out = posteriorDelta({ n: 0, sumDelta: 0, sumDeltaSq: 0 }, { mean: 5, var: 4 });
    expect(out.mean).toBe(5);
    expect(out.std).toBeCloseTo(2, 5);
  });

  test('dense cell barely shrinks toward parent', () => {
    const out = posteriorDelta(
      { n: 100, sumDelta: 1000, sumDeltaSq: 12000 },
      { mean: 5, var: 4 },
    );
    expect(out.mean).toBeCloseTo((4 * 5 + 100 * 10) / 104, 3);
    expect(out.std).toBeGreaterThan(0);
  });

  test('low-n cell shrinks heavily toward parent', () => {
    const out = posteriorDelta(
      { n: 2, sumDelta: 20, sumDeltaSq: 250 },
      { mean: 5, var: 4 },
    );
    expect(out.mean).toBeCloseTo((4 * 5 + 2 * 10) / 6, 3);
  });
});

describe('ebMath.posteriorPBoxUp (Beta-Binomial)', () => {
  test('empty cell ≈ parent', () => {
    const out = posteriorPBoxUp({ n: 0, s: 0 }, { alpha: 6, beta: 4 });
    expect(out.mean).toBeCloseTo(6 / 10, 5);
  });

  test('all-up cell trends to ~1', () => {
    const out = posteriorPBoxUp({ n: 100, s: 100 }, { alpha: 2, beta: 2 });
    expect(out.mean).toBeGreaterThan(0.95);
  });

  test('all-fail cell trends to ~0', () => {
    const out = posteriorPBoxUp({ n: 100, s: 0 }, { alpha: 2, beta: 2 });
    expect(out.mean).toBeLessThan(0.05);
  });
});
