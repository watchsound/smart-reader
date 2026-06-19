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
    hasRegisteredProvider: jest.fn(() => false),
    getProviderByName: jest.fn(() => null),
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

  describe('cross-provider failover (Phase 15a-1, JSON path)', () => {
    // eslint-disable-next-line global-require
    const { instanceInMain } = require('../../commons/service/AIProviderManager');

    beforeEach(() => {
      instanceInMain.hasRegisteredProvider.mockReset();
      instanceInMain.getProviderByName.mockReset();
    });

    test('5xx on primary → chain walks to Kimi, ledger records succeeding provider', async () => {
      const kimiProvider = { name: 'kimi', generateContent: jest.fn() };
      instanceInMain.hasRegisteredProvider.mockImplementation((n) => n === 'kimi');
      instanceInMain.getProviderByName.mockImplementation((n) =>
        n === 'kimi' ? kimiProvider : null,
      );

      // First call (primary) throws 500; second call (fallback) succeeds.
      mockGenerateJson
        .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
        .mockResolvedValueOnce({ ok: true });

      const { output, callId } = await meteredCallJson('p', null, {
        legacyLabel: 'concept-extraction',
      });

      expect(output).toEqual({ ok: true });
      const row = testDb
        .prepare('SELECT provider FROM brain_call_ledger WHERE id = ?')
        .get(callId);
      expect(row.provider).toBe('kimi');

      // Second invocation should have passed the kimi provider as override.
      const secondCall = mockGenerateJson.mock.calls[1];
      expect(secondCall[3]).toBe(kimiProvider);
    });

    test('per-attempt ledger row records failed primary with failover_reason', async () => {
      instanceInMain.hasRegisteredProvider.mockImplementation((n) => n === 'kimi');
      instanceInMain.getProviderByName.mockImplementation((n) =>
        n === 'kimi'
          ? { name: 'kimi', generateContent: jest.fn() }
          : null,
      );
      mockGenerateJson
        .mockRejectedValueOnce(Object.assign(new Error('500'), { status: 500 }))
        .mockResolvedValueOnce({ ok: true });

      await meteredCallJson('p', null, { legacyLabel: 'x' });

      const rows = testDb
        .prepare(
          'SELECT provider, failover_reason, error FROM brain_call_ledger ORDER BY id',
        )
        .all();
      expect(rows.length).toBe(2);
      const failed = rows.find((r) => r.error && r.error.length > 0);
      const success = rows.find((r) => r.error === null);
      expect(failed.provider).toBe('deepseek-v3');
      expect(failed.failover_reason).toBe('failover');
      expect(success.provider).toBe('kimi');
    });

    test('schema/parse error stays fatal — no failover', async () => {
      const kimiProvider = { name: 'kimi', generateContent: jest.fn() };
      instanceInMain.hasRegisteredProvider.mockImplementation((n) => n === 'kimi');
      instanceInMain.getProviderByName.mockImplementation((n) =>
        n === 'kimi' ? kimiProvider : null,
      );

      // 401 = fatal per classifyError → no chain walk
      mockGenerateJson.mockRejectedValue(
        Object.assign(new Error('unauthorized'), { status: 401 }),
      );

      await expect(meteredCallJson('p', null, { legacyLabel: 'x' })).rejects.toThrow(
        /exhausted chain/,
      );
      expect(kimiProvider.generateContent).not.toHaveBeenCalled();
    });

    test('no registered fallbacks → degenerate single-provider chain (unchanged behavior)', async () => {
      instanceInMain.hasRegisteredProvider.mockReturnValue(false);
      mockGenerateJson.mockRejectedValue(
        Object.assign(new Error('500'), { status: 500 }),
      );

      await expect(meteredCallJson('p', null, { legacyLabel: 'x' })).rejects.toThrow(
        /exhausted chain/,
      );
      // Same provider should have been retried once (Phase 15a-1 policy),
      // but no other provider should have been instantiated.
      expect(instanceInMain.getProviderByName).not.toHaveBeenCalled();
    });
  });
});
