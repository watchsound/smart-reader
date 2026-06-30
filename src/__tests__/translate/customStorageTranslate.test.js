// Minimal ipcRenderer mock — store value in-memory.
const _store = {};
global.window = global.window || {};
window.electron = {
  ipcRenderer: {
    getStoreValue: (k) => (k in _store ? _store[k] : null),
    setStoreValue: (k, v) => {
      _store[k] = v;
    },
  },
};

// Require AFTER the mock so the customStorage module captures it.
// eslint-disable-next-line global-require
const customStorage = require('../../renderer/store/customStorage').default;

describe('customStorage translate helpers', () => {
  beforeEach(() => {
    Object.keys(_store).forEach((k) => delete _store[k]);
  });

  test('translateLevel default is "A"', () => {
    expect(customStorage.getTranslateLevel()).toBe('A');
  });
  test('translateLevel persists', () => {
    customStorage.setTranslateLevel('B');
    expect(customStorage.getTranslateLevel()).toBe('B');
  });
  test('translateHistory empty default', () => {
    expect(customStorage.getTranslateHistory()).toEqual([]);
  });
  test('appendTranslateHistory pushes newest-first, caps at 30', () => {
    for (let i = 0; i < 35; i += 1) {
      customStorage.appendTranslateHistory({
        id: `id-${i}`,
        sourceText: `text ${i}`,
        level: 'A',
        sourceLanguage: 'Chinese',
        timestamp: i,
      });
    }
    const h = customStorage.getTranslateHistory();
    expect(h).toHaveLength(30);
    expect(h[0].id).toBe('id-34'); // newest first
    expect(h[29].id).toBe('id-5'); // oldest kept
  });
});
