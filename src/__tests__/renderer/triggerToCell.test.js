const { triggerToCell } = require('../../renderer/brain/triggerToCell');

describe('triggerToCell', () => {
  test('production-prompt with lp returns production-prompt cell', () => {
    const cell = triggerToCell({
      source: 'production-prompt-schedule',
      payload: { learningPoint: { box: 4, domain_type: 'vocabulary' } },
    });
    expect(cell).toEqual({
      featureSurface: 'production-prompt',
      currentBox: 4,
      domain: 'vocabulary',
    });
  });

  test('production-prompt without lp returns null', () => {
    expect(triggerToCell({ source: 'production-prompt-schedule', payload: {} })).toBeNull();
  });

  test('reread-queue with lp returns pre-reading-diagnostic cell', () => {
    const cell = triggerToCell({
      source: 'reread-queue-schedule',
      payload: { learningPoint: { box: 2, domainType: 'code' } },
    });
    expect(cell).toEqual({
      featureSurface: 'pre-reading-diagnostic',
      currentBox: 2,
      domain: 'code',
    });
  });

  test('organize cluster returns null', () => {
    expect(triggerToCell({
      source: 'organize-cluster',
      payload: { bookId: 5 },
    })).toBeNull();
  });

  test('learning-path-plan returns null (no per-event lp)', () => {
    expect(triggerToCell({
      source: 'learning-path-plan',
      payload: { bookIds: [1, 2] },
    })).toBeNull();
  });

  test('director-session-step with lp returns director-session cell', () => {
    const cell = triggerToCell({
      source: 'director-session-step',
      payload: { learningPoint: { box: 3, domain_type: 'math' } },
    });
    expect(cell).toEqual({
      featureSurface: 'director-session',
      currentBox: 3,
      domain: 'math',
    });
  });

  test('unknown source returns null', () => {
    expect(triggerToCell({ source: 'something-new', payload: {} })).toBeNull();
  });

  test('null trigger returns null', () => {
    expect(triggerToCell(null)).toBeNull();
  });
});
