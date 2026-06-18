const { bottleneckReason } = require('../../main/utils/QuestPacingService');

describe('bottleneckReason (pure)', () => {
  test('stalled wins over other signals', () => {
    expect(bottleneckReason({
      etaDays: 30, masteryLevel: 20, stalledDays: 10, shrinkageLevel: 'cell',
    })).toBe('stalled 10d');
  });

  test('low mastery when not stalled', () => {
    expect(bottleneckReason({
      etaDays: 20, masteryLevel: 30, stalledDays: 2, shrinkageLevel: 'cell',
    })).toBe('low mastery');
  });

  test('sparse coverage when shrinkage falls to global', () => {
    expect(bottleneckReason({
      etaDays: 20, masteryLevel: 60, stalledDays: 2, shrinkageLevel: 'global',
    })).toBe('sparse coverage');
  });

  test('slow projection when none of the above and eta >= 25', () => {
    expect(bottleneckReason({
      etaDays: 27, masteryLevel: 60, stalledDays: 2, shrinkageLevel: 'cell',
    })).toBe('slow projection');
  });

  test('in progress otherwise', () => {
    expect(bottleneckReason({
      etaDays: 10, masteryLevel: 70, stalledDays: 1, shrinkageLevel: 'cell',
    })).toBe('in progress');
  });

  test('null stalledDays treated as not stalled', () => {
    expect(bottleneckReason({
      etaDays: 10, masteryLevel: 70, stalledDays: null, shrinkageLevel: 'cell',
    })).toBe('in progress');
  });
});
