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

  describe('cross-provider failover (Phase 15a-1)', () => {
    // eslint-disable-next-line global-require
    const aiProviderManager = require('../../commons/service/AIProviderManager').instanceInMain;
    // eslint-disable-next-line global-require
    const { AIProvider } = require('../../commons/model/DataTypes');

    let savedHas;
    let savedGet;
    let fallbackInstance;

    beforeEach(() => {
      // Stub the registry so the chain has a Kimi fallback to walk to,
      // without spinning up a real KimiProvider (which would try a network call).
      savedHas = aiProviderManager.hasRegisteredProvider.bind(aiProviderManager);
      savedGet = aiProviderManager.getProviderByName.bind(aiProviderManager);
      fallbackInstance = {
        name: AIProvider.Kimi,
        generateContent: jest.fn().mockResolvedValue('kimi result'),
      };
      aiProviderManager.hasRegisteredProvider = (n) => n === AIProvider.Kimi;
      aiProviderManager.getProviderByName = (n) =>
        n === AIProvider.Kimi ? fallbackInstance : null;
    });

    afterEach(() => {
      aiProviderManager.hasRegisteredProvider = savedHas;
      aiProviderManager.getProviderByName = savedGet;
    });

    test('5xx on primary → chain walks to Kimi, ledger records succeeding provider', async () => {
      const primary = {
        name: AIProvider.DeepSeek,
        generateContent: jest
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('server error'), { status: 500 })),
      };

      const { output, callId } = await meteredCall(primary, 'p', {
        legacyLabel: 'translate',
      });

      expect(output).toBe('kimi result');
      const row = testDb
        .prepare('SELECT provider, attempt_n FROM brain_call_ledger WHERE id = ?')
        .get(callId);
      expect(row.provider).toBe(AIProvider.Kimi);
      expect(fallbackInstance.generateContent).toHaveBeenCalledTimes(1);
    });

    test('per-attempt ledger row is written when primary fails over', async () => {
      const primary = {
        name: AIProvider.DeepSeek,
        generateContent: jest
          .fn()
          .mockRejectedValueOnce(Object.assign(new Error('500'), { status: 500 })),
      };

      const { callId } = await meteredCall(primary, 'p', { legacyLabel: 'tr' });

      const rows = testDb
        .prepare('SELECT provider, attempt_n, failover_reason, error FROM brain_call_ledger ORDER BY id')
        .all();
      // Two rows: the failed primary attempt + the success row.
      expect(rows.length).toBe(2);
      const failed = rows.find((r) => r.error && r.error.length > 0);
      const success = rows.find((r) => r.id === callId || r.error === null);
      expect(failed.provider).toBe(AIProvider.DeepSeek);
      expect(failed.failover_reason).toBe('failover');
      expect(success.provider).toBe(AIProvider.Kimi);
    });

    test('auth error on primary → fatal, no failover attempted', async () => {
      const primary = {
        name: AIProvider.DeepSeek,
        generateContent: jest
          .fn()
          .mockRejectedValue(Object.assign(new Error('unauthorized'), { status: 401 })),
      };

      await expect(meteredCall(primary, 'p')).rejects.toThrow(/exhausted chain/);
      expect(fallbackInstance.generateContent).not.toHaveBeenCalled();
    });
  });
});
