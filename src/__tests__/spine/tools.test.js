// src/__tests__/spine/tools.test.js
const tools = require('../../main/brain/spine/tools');

describe('Tool registry (Phase 9 dormant)', () => {
  test('all 5 spec tools are declared with JSON schemas', () => {
    const names = tools.list();
    expect(names.sort()).toEqual([
      'createMicroCard',
      'markConceptMastered',
      'navigate',
      'openMoodBoard',
      'scheduleReread',
    ]);
    for (const n of names) {
      const decl = tools.describe(n);
      expect(decl.name).toBe(n);
      expect(decl.schema).toBeDefined();
      expect(typeof decl.schema).toBe('object');
    }
  });

  test('invoke throws in Phase 9 (dormant)', () => {
    expect(() => tools.invoke('navigate', { view: 'reading' }))
      .toThrow(/not yet wired/);
  });
});
