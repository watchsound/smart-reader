const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  default: undefined,
}));

beforeEach(() => {
  testDb = new Database(':memory:');
  const sql = fs
    .readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8')
    .split('\n')
    .filter((l) => !l.includes('"sqlite_sequence"'))
    .join('\n');
  testDb.exec(sql);
});
afterEach(() => { testDb.close(); });

const meteredCall = require('../../main/brain/spine/meteredCall');

describe('meteredCall', () => {
  test('records a ledger row tagged with intent=legacy:<label>', async () => {
    const provider = {
      name: 'qwen-plus',
      generateContent: jest.fn().mockResolvedValue('hello world'),
    };
    const { output, callId } = await meteredCall(provider, 'translate this', {
      legacyLabel: 'translate',
    });
    expect(output).toBe('hello world');
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('legacy:translate');
    expect(row.provider).toBe('qwen-plus');
    expect(row.cache_hit).toBe(0);
    expect(row.prompt_tokens).toBeGreaterThan(0);
  });

  test('uses legacyLabel "unknown" when omitted', async () => {
    const provider = { name: 'kimi', generateContent: jest.fn().mockResolvedValue('x') };
    const { callId } = await meteredCall(provider, 'y');
    const row = testDb.prepare('SELECT intent FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('legacy:unknown');
  });

  test('falls back to aiProviderManager.currentProviderName when provider.name is missing', async () => {
    // eslint-disable-next-line global-require
    const aiProviderManager = require('../../commons/service/AIProviderManager').instanceInMain;
    const saved = aiProviderManager.currentProviderName;
    aiProviderManager.currentProviderName = 'deepseek';
    try {
      const provider = { generateContent: jest.fn().mockResolvedValue('ok') };
      const { callId } = await meteredCall(provider, 'p', { legacyLabel: 'translate' });
      const row = testDb.prepare('SELECT provider FROM brain_call_ledger WHERE id = ?').get(callId);
      expect(row.provider).toBe('deepseek');
    } finally {
      aiProviderManager.currentProviderName = saved;
    }
  });

  test('last-resort fallback records "unknown" provider', async () => {
    // eslint-disable-next-line global-require
    const aiProviderManager = require('../../commons/service/AIProviderManager').instanceInMain;
    const saved = aiProviderManager.currentProviderName;
    aiProviderManager.currentProviderName = '';
    try {
      const provider = { generateContent: jest.fn().mockResolvedValue('ok') };
      const { callId } = await meteredCall(provider, 'p');
      const row = testDb.prepare('SELECT provider FROM brain_call_ledger WHERE id = ?').get(callId);
      expect(row.provider).toBe('unknown');
    } finally {
      aiProviderManager.currentProviderName = saved;
    }
  });
});
