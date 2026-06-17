// src/__tests__/spine/intents.test.js
const intents = require('../../main/brain/spine/intents');

describe('seed intents', () => {
  test('all 11 spec intents are registered', () => {
    const names = intents.list();
    const expected = [
      'argument-xray',
      'diagnose-book',
      'extract-learning-points',
      'grade-comprehension',
      'plan-cross-book-path',
      'propose-microcard',
      'schedule-production-prompt',
      'schedule-reread',
      'suggest-organize',
      'synthesize-pull-suggestion',
      'tutor-context',
    ];
    expect(names.sort()).toEqual(expected.sort());
  });

  test('each profile validates', () => {
    for (const name of intents.list()) {
      const p = intents.resolve(name);
      expect(Array.isArray(p.contextSlices)).toBe(true);
      expect(p.contextSlices.length).toBeGreaterThan(0);
      expect(typeof p.costCeilingTokens).toBe('number');
      expect(['content-hash', 'session', 'none']).toContain(p.cachePolicy);
    }
  });

  test('unknown intent throws', () => {
    expect(() => intents.resolve('does-not-exist')).toThrow(/unknown intent/);
  });
});
