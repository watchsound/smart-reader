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
});

describe('Tool registry handlers (Phase 10)', () => {
  beforeEach(() => {
    // Clear any prior handler registrations between tests.
    tools._clearHandlers();
  });

  test('invoke throws on unknown tool', () => {
    expect(() => tools.invoke('doesNotExist', {})).toThrow(/unknown tool/);
  });

  test('invoke throws when tool has no handler', () => {
    expect(() => tools.invoke('navigate', { view: 'reading' })).toThrow(/no handler/);
  });

  test('registerHandler + invoke runs the handler', async () => {
    tools.registerHandler('navigate', async ({ view }) => `navigated to ${view}`);
    const result = await tools.invoke('navigate', { view: 'reading' });
    expect(result).toBe('navigated to reading');
  });
});
