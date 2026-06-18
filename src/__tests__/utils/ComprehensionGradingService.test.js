/**
 * ComprehensionGradingService — Phase 13 attribution unit tests.
 *
 * Verifies that gradeAnswer writes a mastery_event row with
 * featureSurface='comprehension' and the proximate_call_id from the
 * brainCall('grade-comprehension', …) return value.
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '/tmp/test') } }));

jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  instanceInMain: { currentProvider: { name: 'mock-provider' } },
}));

const mockBrainCall = jest.fn();
jest.mock('../../main/brain/spine', () => ({
  brainCall: (...args) => mockBrainCall(...args),
}));

// Real SQLite + masteryEventRecorder — we want the actual write path exercised.
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

jest.mock('../../main/db/dbManager', () => {
  let db;
  return { getDb: () => db, __setDb: (next) => { db = next; } };
});
const dbManager = require('../../main/db/dbManager');

function freshDb() {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '../../../db.sql'), 'utf8'));
  db.prepare(`INSERT OR IGNORE INTO user (id, username) VALUES (1, 'test')`).run();
  // Insert a learning_point so the FK on mastery_event is satisfied.
  db.prepare(
    `INSERT INTO learning_point
       (id, user_id, title, front, back, domain_type, created_at)
     VALUES ('lp-1', 1, 'test-lp', '{}', '{}', 'vocabulary', datetime('now'))`
  ).run();
  dbManager.__setDb(db);
  return db;
}

// Require service AFTER mocks are set up.
const comprehensionGradingService =
  require('../../main/utils/ComprehensionGradingService').default;

describe('ComprehensionGradingService — Phase 13 mastery_event emission', () => {
  beforeEach(() => {
    mockBrainCall.mockReset();
  });

  it('after gradeAnswer succeeds, writes mastery_event with featureSurface=comprehension and proximateCallId from the LLM call', async () => {
    const db = freshDb();

    // Insert a brain_call_ledger row that the recorder can look up. We use
    // explicitCallId so the recorder doesn't do a trace lookup — but the row
    // must exist for the FK constraint on mastery_event.proximate_call_id.
    const callId = db
      .prepare(
        `INSERT INTO brain_call_ledger
           (intent, ts, provider, cost_usd, cache_hit)
         VALUES ('grade-comprehension', 1000, 'deepseek', 0.002, 0)`
      )
      .run().lastInsertRowid;

    mockBrainCall.mockResolvedValueOnce({
      output: {
        score: 80,
        strengths: ['Good coverage'],
        gaps: [],
        feedback: 'Well done.',
      },
      callId,
      cacheHit: false,
    });

    const result = await comprehensionGradingService.gradeAnswer({
      chapterTitle: 'Ch 1',
      question: 'What is X?',
      answer: 'X is a thing.',
      learningPointId: 'lp-1',
      questionId: 'q-42',
      userId: 1,
    });

    // gradeAnswer should still return the normal grade shape.
    expect(result.error).toBeUndefined();
    expect(result.score).toBe(80);
    expect(result.callId).toBe(callId);

    // The mastery_event row must have been written.
    const row = db
      .prepare(
        `SELECT feature_surface, proximate_call_id, new_mastery, source, source_ref
         FROM mastery_event
         WHERE learning_point_id = 'lp-1'`
      )
      .get();

    expect(row).toBeTruthy();
    expect(row.feature_surface).toBe('comprehension');
    expect(row.proximate_call_id).toBe(callId);
    expect(row.new_mastery).toBe(80);
    expect(row.source).toBe('comprehension-grade');
    expect(row.source_ref).toBe('q-42');
  });

  it('does NOT write mastery_event when no learningPointId is provided', async () => {
    const db = freshDb();

    mockBrainCall.mockResolvedValueOnce({
      output: { score: 70, strengths: [], gaps: [], feedback: '' },
      callId: 999,
      cacheHit: false,
    });

    const result = await comprehensionGradingService.gradeAnswer({
      chapterTitle: 'Ch 2',
      question: 'Q',
      answer: 'A',
      // no learningPointId
    });

    expect(result.score).toBe(70);

    const count = db
      .prepare(`SELECT COUNT(*) as c FROM mastery_event`)
      .get().c;
    expect(count).toBe(0);
  });

  it('still returns grade when recorder throws (telemetry must not break grading)', async () => {
    freshDb();

    mockBrainCall.mockResolvedValueOnce({
      output: { score: 55, strengths: [], gaps: ['gap'], feedback: 'Partial.' },
      callId: 777,
      cacheHit: false,
    });

    // Pass a learningPointId that doesn't exist in the DB — the FK violation
    // will cause the recorder to throw, but gradeAnswer must still return.
    const result = await comprehensionGradingService.gradeAnswer({
      question: 'Q',
      answer: 'A',
      learningPointId: 'lp-nonexistent',
    });

    expect(result.error).toBeUndefined();
    expect(result.score).toBe(55);
  });
});
