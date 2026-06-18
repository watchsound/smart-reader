const { buildHierarchy } = require('../../main/brain/predictive/hierarchy');

describe('buildHierarchy', () => {
  test('rolls up (surface,box,domain) cells to (surface,box), (surface), and global', () => {
    const cellAggregates = [
      { featureSurface: 'director-session', currentBox: 1, domain: 'vocabulary',
        n: 10, sumDelta: 100, sumDeltaSq: 1100, boxUpCount: 6 },
      { featureSurface: 'director-session', currentBox: 1, domain: 'code',
        n: 4, sumDelta: 24, sumDeltaSq: 160, boxUpCount: 1 },
      { featureSurface: 'director-session', currentBox: 2, domain: 'vocabulary',
        n: 6, sumDelta: 30, sumDeltaSq: 180, boxUpCount: 4 },
      { featureSurface: 'comprehension', currentBox: 1, domain: 'knowledge',
        n: 2, sumDelta: 14, sumDeltaSq: 100, boxUpCount: 1 },
    ];
    const h = buildHierarchy(cellAggregates);
    const sb = h.surfaceBox.get('director-session|1');
    expect(sb).toMatchObject({ n: 14, sumDelta: 124, boxUpCount: 7 });
    expect(h.surface.get('director-session')).toMatchObject({ n: 20, sumDelta: 154, boxUpCount: 11 });
    expect(h.global).toMatchObject({ n: 22, sumDelta: 168, boxUpCount: 12 });
  });

  test('empty input yields zero aggregates', () => {
    const h = buildHierarchy([]);
    expect(h.global.n).toBe(0);
    expect(h.surface.size).toBe(0);
  });
});
