const {
  classifyMasteryRegression,
  classifyZeroRoi,
  classifyProviderErrorSpike,
  classifyStalled,
} = require('../../main/utils/BrainAnomalyDetector');

describe('classifyMasteryRegression', () => {
  test('drop ≥10 → medium severity', () => {
    const a = classifyMasteryRegression({
      id: 'lp1', title: 'foo', recentMax: 70, recentMin: 55, latestMastery: 55, latestTs: 100,
    });
    expect(a).not.toBeNull();
    expect(a.kind).toBe('mastery-regression');
    expect(a.severity).toBe('medium');
    expect(a.evidence.drop).toBe(15);
  });

  test('drop ≥20 → high severity', () => {
    const a = classifyMasteryRegression({
      id: 'lp2', recentMax: 80, recentMin: 40, latestMastery: 40, latestTs: 100,
    });
    expect(a.severity).toBe('high');
  });

  test('drop <10 → null', () => {
    expect(classifyMasteryRegression({
      id: 'lp3', recentMax: 75, recentMin: 70, latestMastery: 70, latestTs: 100,
    })).toBeNull();
  });
});

describe('classifyZeroRoi', () => {
  test('cost above threshold + zero events → anomaly', () => {
    const a = classifyZeroRoi({
      intent: 'propose-microcard', totalCost: 0.10, attributedEventCount: 0, since: 100,
    });
    expect(a.kind).toBe('zero-roi-spend');
    expect(a.severity).toBe('medium');
  });

  test('cost ≥0.20 → high severity', () => {
    const a = classifyZeroRoi({
      intent: 'foo', totalCost: 0.25, attributedEventCount: 0, since: 100,
    });
    expect(a.severity).toBe('high');
  });

  test('any attributed events → null', () => {
    expect(classifyZeroRoi({
      intent: 'foo', totalCost: 0.10, attributedEventCount: 1, since: 100,
    })).toBeNull();
  });

  test('cost below threshold → null', () => {
    expect(classifyZeroRoi({
      intent: 'foo', totalCost: 0.01, attributedEventCount: 0, since: 100,
    })).toBeNull();
  });
});

describe('classifyProviderErrorSpike', () => {
  test('error rate above threshold → anomaly', () => {
    const a = classifyProviderErrorSpike({
      provider: 'DeepSeek', totalCalls: 10, errorCalls: 3, sinceTs: 100,
    });
    expect(a.kind).toBe('provider-error-spike');
    expect(a.evidence.errorRate).toBeCloseTo(0.3, 5);
  });

  test('error rate ≥0.5 → high severity', () => {
    const a = classifyProviderErrorSpike({
      provider: 'DeepSeek', totalCalls: 10, errorCalls: 6, sinceTs: 100,
    });
    expect(a.severity).toBe('high');
  });

  test('under min calls → null', () => {
    expect(classifyProviderErrorSpike({
      provider: 'X', totalCalls: 3, errorCalls: 3, sinceTs: 100,
    })).toBeNull();
  });

  test('error rate below 20% → null', () => {
    expect(classifyProviderErrorSpike({
      provider: 'X', totalCalls: 100, errorCalls: 10, sinceTs: 100,
    })).toBeNull();
  });
});

describe('classifyStalled', () => {
  test('stalled ≥14d + mastery <80 → anomaly', () => {
    const now = Date.now();
    const a = classifyStalled({
      id: 'lp1', title: 'foo', masteryLevel: 30,
      lastEventTs: now - 20 * 86_400_000, questId: 'q1',
    });
    expect(a.kind).toBe('stalled-quest-concept');
    expect(a.evidence.stalledDays).toBeGreaterThanOrEqual(14);
  });

  test('mastered ≥80 → null', () => {
    const now = Date.now();
    expect(classifyStalled({
      id: 'lp2', masteryLevel: 90,
      lastEventTs: now - 30 * 86_400_000, questId: 'q1',
    })).toBeNull();
  });

  test('recent activity → null', () => {
    const now = Date.now();
    expect(classifyStalled({
      id: 'lp3', masteryLevel: 40,
      lastEventTs: now - 5 * 86_400_000, questId: 'q1',
    })).toBeNull();
  });

  test('never any event → anomaly (lastEventTs null)', () => {
    const a = classifyStalled({
      id: 'lp4', masteryLevel: 20, lastEventTs: null, questId: 'q1',
    });
    expect(a).not.toBeNull();
    expect(a.evidence.stalledDays).toBeNull();
  });

  test('key uses questId:lpId composite', () => {
    const now = Date.now();
    const a = classifyStalled({
      id: 'lp1', masteryLevel: 30,
      lastEventTs: now - 30 * 86_400_000, questId: 'q42',
    });
    expect(a.key).toBe('q42:lp1');
  });
});
