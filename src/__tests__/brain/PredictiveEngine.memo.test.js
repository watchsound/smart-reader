/**
 * Module-level memo for the parsed predictive cache file.
 *
 * What we're pinning down: a Quest pacing pass over N concepts must NOT pay
 * N file reads + N Map rebuilds. statSync gates the re-parse on mtime; if
 * the file hasn't changed, predict() reuses the existing maps.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'predictive-memo-'));
jest.mock('electron', () => ({ app: { getPath: () => tmp } }));

jest.mock('../../main/db/dbManager', () => ({
  getDb: () => ({
    prepare: () => ({ all: () => [], get: () => null, run: () => undefined }),
  }),
}));

const PredictiveEngine = require('../../main/brain/predictive/PredictiveEngine');
const { _resetCacheMemoForTests } = PredictiveEngine;

const CACHE_FILE = path.join(tmp, 'predictive_model.json');

function writeFixture({ computedAt = Date.now(), cells = [] } = {}) {
  const payload = {
    cells,
    surfaceBox: [],
    surface: [],
    global: { n: 10, sumDelta: 5, sumDeltaSq: 5 },
    cost: [{ featureSurface: 'director-session', meanCost: 0.001, p95Cost: 0.002 }],
    windowDays: 30,
    computedAt,
  };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(payload));
}

beforeEach(() => {
  _resetCacheMemoForTests();
  if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
});

describe('PredictiveEngine cache memoization', () => {
  test('two predict() calls against the same file → single readFileSync', async () => {
    writeFixture({ computedAt: Date.now() });
    const readSpy = jest.spyOn(fs, 'readFileSync');
    const engine = new PredictiveEngine();

    await engine.predict({ featureSurface: 'director-session', currentBox: 1, domain: 'knowledge' });
    await engine.predict({ featureSurface: 'director-session', currentBox: 2, domain: 'knowledge' });

    const cacheReads = readSpy.mock.calls.filter(
      (args) => String(args[0]).endsWith('predictive_model.json'),
    );
    expect(cacheReads).toHaveLength(1);
    readSpy.mockRestore();
  });

  test('two separate engine instances share the module-level memo', async () => {
    writeFixture({ computedAt: Date.now() });
    const readSpy = jest.spyOn(fs, 'readFileSync');

    await new PredictiveEngine().predict({
      featureSurface: 'director-session', currentBox: 1, domain: 'knowledge',
    });
    await new PredictiveEngine().predict({
      featureSurface: 'director-session', currentBox: 1, domain: 'knowledge',
    });

    const cacheReads = readSpy.mock.calls.filter(
      (args) => String(args[0]).endsWith('predictive_model.json'),
    );
    expect(cacheReads).toHaveLength(1);
    readSpy.mockRestore();
  });

  test('memo invalidates when mtime changes (e.g., refreshModel rewrote the file)', async () => {
    writeFixture({ computedAt: Date.now() });
    const engine = new PredictiveEngine();
    await engine.predict({ featureSurface: 'director-session', currentBox: 1, domain: 'knowledge' });

    // Simulate a refresh: write a new file, bump mtime explicitly so the
    // change is detectable even within the same tick on coarse-mtime FSes.
    writeFixture({ computedAt: Date.now() + 1 });
    const futureMs = Date.now() + 5000;
    fs.utimesSync(CACHE_FILE, futureMs / 1000, futureMs / 1000);

    const readSpy = jest.spyOn(fs, 'readFileSync');
    await engine.predict({ featureSurface: 'director-session', currentBox: 1, domain: 'knowledge' });
    const cacheReads = readSpy.mock.calls.filter(
      (args) => String(args[0]).endsWith('predictive_model.json'),
    );
    expect(cacheReads.length).toBeGreaterThanOrEqual(1);
    readSpy.mockRestore();
  });

  test('cell lookup goes through the indexed Map (composite key match)', async () => {
    writeFixture({
      computedAt: Date.now(),
      cells: [
        { featureSurface: 'director-session', currentBox: 3, domain: 'vocabulary', n: 8, sumDelta: 4, sumDeltaSq: 4, boxUpCount: 5, s: 5 },
      ],
    });

    const engine = new PredictiveEngine();
    const out = await engine.predict({
      featureSurface: 'director-session', currentBox: 3, domain: 'vocabulary',
    });

    expect(out.shrinkageLevel).toBe('cell');
    expect(out.n).toBe(8);
  });
});
