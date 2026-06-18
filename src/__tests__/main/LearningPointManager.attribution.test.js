/**
 * LearningPointManager.attribution.test.js
 *
 * Phase 13 Task 10: verifies that both mastery-write sites in
 * LearningPointManager route through masteryEventRecorder and stamp the
 * correct feature_surface values.
 *
 *   applyProductionGrade  → surface: 'production-prompt'
 *   processReview         → surface: 'manual-review', traceId: null
 *
 * Also asserts (statically) that the source file no longer calls
 * MasteryEventStore.record directly.
 */

const fs = require('fs');
const path = require('path');

// ── dbManager mock ─────────────────────────────────────────────────────────────
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(),
    exec: jest.fn(),
    transaction: jest.fn((fn) => fn),
  },
  getUserIdFromToken: jest.fn((token) => (token === 'valid-token' ? 1 : -1)),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-attr'),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => {
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return String(date);
  }),
}));

// ── masteryEventRecorder mock ──────────────────────────────────────────────────
const mockRecordWithProximateCall = jest.fn();
jest.mock('../../main/db/masteryEventRecorder', () => ({
  recordWithProximateCall: (...args) => mockRecordWithProximateCall(...args),
}));

// ── imports after mocks ────────────────────────────────────────────────────────
const mockDb = require('../../main/db/dbManager').default;
const { applyProductionGrade, processReview } = require('../../main/db/LearningPointManager');

// ── helpers ───────────────────────────────────────────────────────────────────

function setupApplyGrade({ masteryLevel = 60, box = 3 } = {}) {
  const selectStmt = { get: jest.fn(() => ({ id: 'lp-attr', masteryLevel, box })) };
  const updateStmt = { run: jest.fn() };
  mockDb.prepare
    .mockReturnValueOnce(selectStmt)
    .mockReturnValueOnce(updateStmt);
}

function setupProcessReview({ box = 2, mastery_level = 40 } = {}) {
  const point = {
    id: 'lp-attr',
    user_id: 1,
    box,
    mastery_level,
    correct_streak: 0,
    total_correct: 0,
    total_incorrect: 0,
    ease_factor: 2.5,
    avg_response_time_ms: null,
    review_count: 0,
    fully_learned: 0,
  };
  const stmt = {
    get: jest.fn(() => point),
    run: jest.fn(() => ({ changes: 1 })),
    all: jest.fn(() => [point]),
  };
  mockDb.prepare.mockReturnValue(stmt);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LearningPointManager — Phase 13 attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordWithProximateCall.mockClear();
  });

  // ── static verification ─────────────────────────────────────────────────────

  it('LearningPointManager.js no longer calls MasteryEventStore.record directly', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../main/db/LearningPointManager.js'),
      'utf8',
    );
    expect(src).toMatch(/masteryEventRecorder/);
    expect(src).not.toMatch(/MasteryEventStore\.record\s*\(/);
  });

  // ── applyProductionGrade → 'production-prompt' ──────────────────────────────

  it('applyProductionGrade writes mastery_event with featureSurface=production-prompt', () => {
    setupApplyGrade({ masteryLevel: 55, box: 2 });

    const result = applyProductionGrade('lp-attr', 80, 'valid-token');

    expect(result.error).toBeUndefined();
    expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.surface).toBe('production-prompt');
    expect(ev.source).toBe('production-grade');
    expect(ev.eventType).toBe('mastery_change');
    expect(ev.learningPointId).toBe('lp-attr');
    expect(ev.userId).toBe(1);
  });

  it('applyProductionGrade passes proximateTraceId from opts.proximateTraceId', () => {
    setupApplyGrade({ masteryLevel: 55, box: 2 });

    applyProductionGrade('lp-attr', 80, 'valid-token', { proximateTraceId: 'tr-abc' });

    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.traceId).toBe('tr-abc');
  });

  it('applyProductionGrade uses traceId: null when no opts provided', () => {
    setupApplyGrade({ masteryLevel: 55, box: 2 });

    applyProductionGrade('lp-attr', 80, 'valid-token');

    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.traceId).toBeNull();
  });

  // ── processReview (updateLeitnerBoxAfterReview) → 'manual-review' ──────────

  it('processReview writes mastery_event with featureSurface=manual-review', () => {
    setupProcessReview({ box: 2, mastery_level: 35 });

    const result = processReview('lp-attr', 3, 400, 'valid-token');

    expect(result.success).toBe(true);
    expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.surface).toBe('manual-review');
    expect(ev.source).toBe('user-review');
    expect(ev.eventType).toBe('box_change');
    expect(ev.traceId).toBeNull();
    expect(ev.learningPointId).toBe('lp-attr');
    expect(ev.userId).toBe(1);
  });

  it('processReview passes traceId: null (no LLM involved in manual review)', () => {
    setupProcessReview({ box: 3, mastery_level: 55 });

    processReview('lp-attr', 1, 300, 'valid-token');

    const ev = mockRecordWithProximateCall.mock.calls[0][0];
    expect(ev.traceId).toBeNull();
  });
});
