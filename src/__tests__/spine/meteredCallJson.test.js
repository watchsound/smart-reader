// src/__tests__/spine/meteredCallJson.test.js
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  default: undefined,
}));

const mockGenerateJson = jest.fn();
jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProviderName: 'deepseek-v3',
    currentProvider: {
      name: 'deepseek-v3',
      generateContent: jest.fn(),
    },
    generateContentWithJson: (...args) => mockGenerateJson(...args),
  },
}));

beforeEach(() => {
  testDb = new Database(':memory:');
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  testDb.exec(sql);
  mockGenerateJson.mockReset();
});
afterEach(() => { testDb.close(); });

const meteredCallJson = require('../../main/brain/spine/meteredCallJson');

describe('meteredCallJson', () => {
  test('records a ledger row tagged with legacy:<label> for JSON sites', async () => {
    mockGenerateJson.mockResolvedValue({ concepts: ['duration', 'convexity'] });
    const { output, callId } = await meteredCallJson(
      'extract concepts',
      { type: 'object', properties: { concepts: { type: 'array' } } },
      { legacyLabel: 'concept-extraction' },
    );
    expect(output).toEqual({ concepts: ['duration', 'convexity'] });
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('legacy:concept-extraction');
    expect(row.provider).toBe('deepseek-v3');
    expect(JSON.parse(row.output_json)).toEqual({ concepts: ['duration', 'convexity'] });
  });

  test('throws when provider is null', async () => {
    const { instanceInMain } = require('../../commons/service/AIProviderManager');
    const saved = instanceInMain.currentProvider;
    instanceInMain.currentProvider = null;
    await expect(meteredCallJson('p', null, { legacyLabel: 'x' })).rejects.toThrow(/no AI provider/);
    instanceInMain.currentProvider = saved;
  });

  test('null schema is allowed', async () => {
    mockGenerateJson.mockResolvedValue({ x: 1 });
    const { callId } = await meteredCallJson('any prompt', null, { legacyLabel: 'free-form' });
    expect(callId).toBeGreaterThan(0);
  });
});
