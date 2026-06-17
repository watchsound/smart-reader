// src/__tests__/integration/spine-end-to-end.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  default: undefined,
}));

jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProviderName: 'deepseek-v3',
    currentProvider: {
      name: 'deepseek-v3',
      generateContent: jest.fn().mockResolvedValue('OK'),
    },
  },
}));

jest.mock('../../commons/service/polyfills/structuredOutput', () => ({
  getStructured: jest.fn().mockResolvedValue({ proposed: 'duration' }),
}));

// Mock the brain index (getLearningBrain) — slices use it.
jest.mock('../../main/brain', () => ({
  getLearningBrain: () => ({
    episodeCollector: { getRecentEpisodes: jest.fn().mockResolvedValue([]) },
    getTriggerTelemetry: jest.fn().mockReturnValue({ bySource: {} }),
  }),
}));

// Mock manager-driven slices.
jest.mock('../../main/utils/QuestService', () => {
  return jest.fn().mockImplementation(() => ({ list: jest.fn().mockReturnValue([]) }));
});
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({ get: () => [], set: () => {} }));
});
jest.mock('../../main/db/LearningPointManager', () => ({
  topNByMastery: jest.fn().mockReturnValue([]),
}));

function freshDb() {
  const db = new Database(':memory:');
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  db.exec(sql);
  return db;
}

beforeEach(() => { testDb = freshDb(); });
afterEach(() => { testDb.close(); });

const { brainCall, intents } = require('../../main/brain/spine');

describe('Spine end-to-end', () => {
  test('all 12 seed intents resolve and dispatch successfully', async () => {
    const names = intents.list();
    expect(names.length).toBe(12);
    for (const intent of names) {
      const result = await brainCall(intent, `smoke for ${intent}`, {
        userId: 1,
        contextOverrides: { currentBook: { bookId: 1, chapterIndex: 0 } },
      });
      expect(result.callId).toBeGreaterThan(0);
    }
    const total = testDb.prepare('SELECT COUNT(*) AS c FROM brain_call_ledger').get().c;
    expect(total).toBe(names.length);
  });

  test('p95 spine overhead under 100ms (lenient, generous for CI variance)', async () => {
    const durations = [];
    for (let i = 0; i < 20; i++) {
      const t = Date.now();
      await brainCall('extract-learning-points', `input ${i}`, { userId: 1 });
      durations.push(Date.now() - t);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    // TODO: tighten to 50ms once CI baseline is established.
    expect(p95).toBeLessThan(100);
  });

  test('ledger captures provider name + intent + non-null cost', async () => {
    const { callId } = await brainCall('propose-microcard', 'some paragraph text', {
      userId: 1,
      contextOverrides: { currentBook: { bookId: 1, chapterIndex: 0 } },
    });
    const row = testDb.prepare('SELECT provider, intent, cost_usd FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.provider).toBe('deepseek-v3');
    expect(row.intent).toBe('propose-microcard');
    // cost may be 0 for the mocked output, but column should be a number (not NULL since provider responded)
    expect(typeof row.cost_usd).toBe('number');
  });
});
