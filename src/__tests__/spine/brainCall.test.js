jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInMain: {
    currentProviderName: 'deepseek-v3',
    currentProvider: {
      name: 'deepseek-v3',
      generateContent: jest.fn().mockResolvedValue('plain text output'),
    },
  },
}));

jest.mock('../../commons/service/polyfills/structuredOutput', () => ({
  getStructured: jest.fn().mockResolvedValue({ foo: 'bar' }),
}));

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let testDb;
jest.mock('../../main/db/dbManager', () => ({
  getDb: () => testDb,
  default: undefined,
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

const intents = require('../../main/brain/spine/intents');
const BrainContext = require('../../main/brain/spine/BrainContext');
const brainCall = require('../../main/brain/spine/brainCall');

// Register a test intent + slice (idempotent — won't conflict with seed)
try {
  intents.register('test-spine-intent', {
    label: 'Test',
    contextSlices: ['simpleSlice'],
    costCeilingTokens: 2000,
    cachePolicy: 'content-hash',
  });
} catch (_e) { /* already registered from prior test runs */ }
BrainContext.registerSlice('simpleSlice', async () => ({ k: 'v' }));

describe('brainCall', () => {
  test('builds context, dispatches via provider, records ledger row', async () => {
    const { output, callId, cacheHit } = await brainCall('test-spine-intent', 'do thing', { userId: 1 });
    expect(output).toBeDefined();
    expect(typeof callId).toBe('number');
    expect(cacheHit).toBe(false);
    const row = testDb.prepare('SELECT * FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.intent).toBe('test-spine-intent');
    expect(row.provider).toBe('deepseek-v3');
    expect(row.cache_hit).toBe(0);
    expect(JSON.parse(row.context_keys)).toEqual(['simpleSlice']);
  });

  test('second call with same input hits cache', async () => {
    await brainCall('test-spine-intent', 'same input', { userId: 1 });
    const second = await brainCall('test-spine-intent', 'same input', { userId: 1 });
    expect(second.cacheHit).toBe(true);
  });

  test('options.schema override flows through to getStructured', async () => {
    const { getStructured } = require('../../commons/service/polyfills/structuredOutput');
    const SCHEMA = { type: 'object', properties: { result: { type: 'string' } } };
    const { output } = await brainCall('test-spine-intent', 'with schema', {
      userId: 1, schema: SCHEMA,
    });
    expect(output).toEqual({ foo: 'bar' });
    expect(getStructured).toHaveBeenCalled();
  });

  test('passes triggerId through to the ledger row', async () => {
    const { callId } = await brainCall('test-spine-intent', 'with trigger', {
      userId: 1, triggerId: 'trig_test_1',
    });
    const row = testDb.prepare('SELECT trigger_id FROM brain_call_ledger WHERE id = ?').get(callId);
    expect(row.trigger_id).toBe('trig_test_1');
  });

  test('session cachePolicy intents do not hit cache (Phase 9a behavior)', async () => {
    // Register a session-policy test intent
    try {
      intents.register('test-session-intent', {
        label: 'Test session',
        contextSlices: ['simpleSlice'],
        costCeilingTokens: 2000,
        cachePolicy: 'session',
      });
    } catch (_e) { /* already registered */ }

    await brainCall('test-session-intent', 'same input', { userId: 1 });
    const second = await brainCall('test-session-intent', 'same input', { userId: 1 });
    expect(second.cacheHit).toBe(false); // session policy is uncached in Phase 9a
  });

  test('none cachePolicy intents do not hit cache', async () => {
    try {
      intents.register('test-none-intent', {
        label: 'Test none',
        contextSlices: ['simpleSlice'],
        costCeilingTokens: 2000,
        cachePolicy: 'none',
      });
    } catch (_e) { /* already registered */ }

    await brainCall('test-none-intent', 'same input', { userId: 1 });
    const second = await brainCall('test-none-intent', 'same input', { userId: 1 });
    expect(second.cacheHit).toBe(false);
  });
});
