// Pure-fn test of percentile math by exercising latencyByIntent through
// a mock dbManager. Same pattern as other brain/ tests — no DB needed.

jest.mock('../../main/db/dbManager', () => {
  let rows = [];
  return {
    __setRows: (r) => { rows = r; },
    getDb: () => ({
      prepare: () => ({
        all: () => rows,
      }),
    }),
  };
});

const dbMock = require('../../main/db/dbManager');
const { latencyByIntent } = require('../../main/db/CallLedgerStore');

describe('latencyByIntent (percentile math)', () => {
  test('empty rows → empty output', () => {
    dbMock.__setRows([]);
    expect(latencyByIntent(0)).toEqual([]);
  });

  test('single row → all percentiles equal the value', () => {
    dbMock.__setRows([{ intent: 'a', duration_ms: 500 }]);
    const out = latencyByIntent(0);
    expect(out).toEqual([
      expect.objectContaining({
        intent: 'a', n: 1, mean_ms: 500, p50_ms: 500, p95_ms: 500, max_ms: 500,
      }),
    ]);
  });

  test('groups by intent', () => {
    dbMock.__setRows([
      { intent: 'a', duration_ms: 100 },
      { intent: 'a', duration_ms: 200 },
      { intent: 'b', duration_ms: 1000 },
    ]);
    const out = latencyByIntent(0);
    const a = out.find((r) => r.intent === 'a');
    const b = out.find((r) => r.intent === 'b');
    expect(a.n).toBe(2);
    expect(a.mean_ms).toBe(150);
    expect(b.n).toBe(1);
    expect(b.mean_ms).toBe(1000);
  });

  test('p95 of 20 evenly-spaced values picks 19th percentile slot', () => {
    const rows = [];
    for (let i = 1; i <= 20; i++) rows.push({ intent: 'x', duration_ms: i * 10 });
    dbMock.__setRows(rows);
    const out = latencyByIntent(0);
    expect(out[0].p95_ms).toBe(200); // floor(20*0.95) = 19, index 19 = 200
    expect(out[0].max_ms).toBe(200);
    expect(out[0].p50_ms).toBe(110); // floor(20*0.5) = 10, index 10 = 110
  });

  test('sorts by p95 desc across intents', () => {
    dbMock.__setRows([
      { intent: 'fast', duration_ms: 10 },
      { intent: 'slow', duration_ms: 1000 },
      { intent: 'mid',  duration_ms: 100 },
    ]);
    const out = latencyByIntent(0);
    expect(out.map((r) => r.intent)).toEqual(['slow', 'mid', 'fast']);
  });
});
