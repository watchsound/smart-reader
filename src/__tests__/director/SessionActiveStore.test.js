// Mock electron-store
jest.mock('electron-store', () => {
  return class {
    constructor() { this.data = {}; }
    get(k) { return this.data[k]; }
    set(k, v) { this.data[k] = v; }
    delete(k) { delete this.data[k]; }
    clear() { this.data = {}; }
  };
});

// Mock AISessionStore so persistCompleted doesn't hit SQLite
jest.mock('../../main/db/AISessionStore', () => ({
  persistCompleted: jest.fn((s) => s.id),
}));

const SessionActiveStore = require('../../main/brain/director/SessionActiveStore');

beforeEach(() => SessionActiveStore.__reset());

test('saveActive/loadActive roundtrip', () => {
  SessionActiveStore.saveActive({ id: 's1', goal: 'g' });
  expect(SessionActiveStore.loadActive()).toEqual({ id: 's1', goal: 'g' });
});

test('clearActive removes', () => {
  SessionActiveStore.saveActive({ id: 's1', goal: 'g' });
  SessionActiveStore.clearActive();
  expect(SessionActiveStore.loadActive()).toBeUndefined();
});

test('persistCompleted delegates to AISessionStore', () => {
  const AISessionStore = require('../../main/db/AISessionStore');
  jest.spyOn(AISessionStore, 'persistCompleted').mockImplementation((s) => s.id);
  SessionActiveStore.persistCompleted({ id: 'sX', trace: [] });
  expect(AISessionStore.persistCompleted).toHaveBeenCalled();
});
