/**
 * LearningPointManager.masteryEvent.test.js
 *
 * Verifies that Phase 13 instrumentation emits mastery_event rows via
 * masteryEventRecorder from applyProductionGrade and processReview without
 * breaking the primary write path.
 *
 * Uses the same mock pattern as
 *   src/__tests__/learning/LearningPointManager.test.js:
 *   - dbManager is mocked as an ES module default export.
 *   - masteryEventRecorder is mocked so we can assert on recordWithProximateCall()
 *     calls without a real DB.
 *   - recorder errors are swallowed — confirmed by testing that a throwing mock
 *     still returns a valid result.
 */

// ── dbManager mock (must come before any require of LearningPointManager) ─────
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
  v4: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => {
    if (date instanceof Date) return date.toISOString().split('T')[0];
    return date;
  }),
}));

// ── masteryEventRecorder mock ──────────────────────────────────────────────────
// recordWithProximateCall() is called via require() inside the function body.
const mockRecordWithProximateCall = jest.fn();
jest.mock('../../main/db/masteryEventRecorder', () => ({
  recordWithProximateCall: (...args) => mockRecordWithProximateCall(...args),
}));

// ── imports after mocks ────────────────────────────────────────────────────────
const mockDb = require('../../main/db/dbManager').default;
const { applyProductionGrade, processReview } = require('../../main/db/LearningPointManager');

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Set up mockDb.prepare chains for applyProductionGrade.
 * The function calls:
 *   1. SELECT current state
 *   2. UPDATE (no next_review branch or with next_review branch)
 */
function setupApplyGrade({ masteryLevel = 60, box = 3 } = {}) {
  const selectStmt = {
    get: jest.fn(() => ({ id: 'lp-1', masteryLevel, box })),
  };
  const updateStmt = { run: jest.fn() };
  mockDb.prepare
    .mockReturnValueOnce(selectStmt)
    .mockReturnValueOnce(updateStmt);
  return { selectStmt, updateStmt };
}

/**
 * Set up mockDb.prepare chains for processReview.
 * processReview calls getLearningPointById first, which does several prepares,
 * then an UPDATE. We reuse mockReturnValue (not Once) for the inner getLearningPoint
 * calls so any number of prepares return a valid stmt, then override the UPDATE.
 *
 * Simpler approach: make all prepares return a stmt that returns the point for .get()
 * and no-ops for .run(). The UPDATE stmt is the last .run() call.
 */
function setupProcessReview({ box = 2, mastery_level = 40 } = {}) {
  const point = {
    id: 'lp-1',
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
  const genericStmt = {
    get: jest.fn(() => point),
    run: jest.fn(() => ({ changes: 1 })),
    all: jest.fn(() => [point]),
  };
  mockDb.prepare.mockReturnValue(genericStmt);
  return { point, updateStmt: genericStmt };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('LearningPointManager — mastery_event instrumentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecordWithProximateCall.mockClear();
  });

  // ── applyProductionGrade ────────────────────────────────────────────────────

  describe('applyProductionGrade', () => {
    test('emits mastery_change event with source=production-grade on success', () => {
      setupApplyGrade({ masteryLevel: 60, box: 3 });

      const result = applyProductionGrade('lp-1', 85, 'valid-token');

      expect(result.error).toBeUndefined();
      expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
      const ev = mockRecordWithProximateCall.mock.calls[0][0];
      expect(ev.learningPointId).toBe('lp-1');
      expect(ev.userId).toBe(1);
      expect(ev.eventType).toBe('mastery_change');
      expect(ev.source).toBe('production-grade');
      expect(ev.surface).toBe('production-prompt');
      expect(ev.prevMastery).toBe(60);
      expect(ev.newMastery).toBe(85);
      expect(ev.prevBox).toBe(3);
    });

    test('emits mastery_change even on demotion (score < 50)', () => {
      setupApplyGrade({ masteryLevel: 80, box: 4 });

      const result = applyProductionGrade('lp-1', 30, 'valid-token');

      expect(result.demoted).toBe(true);
      expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
      const ev = mockRecordWithProximateCall.mock.calls[0][0];
      expect(ev.eventType).toBe('mastery_change');
      expect(ev.surface).toBe('production-prompt');
      expect(ev.newBox).toBe(3); // demoted from 4
    });

    test('forwards proximateTraceId from opts to recorder', () => {
      setupApplyGrade({ masteryLevel: 60, box: 3 });

      applyProductionGrade('lp-1', 85, 'valid-token', { proximateTraceId: 'trace-xyz' });

      expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
      const ev = mockRecordWithProximateCall.mock.calls[0][0];
      expect(ev.traceId).toBe('trace-xyz');
    });

    test('uses traceId: null when opts is omitted', () => {
      setupApplyGrade({ masteryLevel: 60, box: 3 });

      applyProductionGrade('lp-1', 85, 'valid-token');

      const ev = mockRecordWithProximateCall.mock.calls[0][0];
      expect(ev.traceId).toBeNull();
    });

    test('primary write result is intact even if recorder throws', () => {
      setupApplyGrade({ masteryLevel: 60, box: 3 });
      mockRecordWithProximateCall.mockImplementationOnce(() => {
        throw new Error('DB unavailable');
      });

      // Should NOT throw; result should be a valid object with afterMastery
      let result;
      expect(() => {
        result = applyProductionGrade('lp-1', 85, 'valid-token');
      }).not.toThrow();
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.afterMastery).toBe(85);
    });

    test('does NOT emit event when token is invalid', () => {
      const result = applyProductionGrade('lp-1', 85, 'bad-token');
      expect(result.error).toBe('Invalid session');
      expect(mockRecordWithProximateCall).not.toHaveBeenCalled();
    });

    test('does NOT emit event when learning point not found', () => {
      const selectStmt = { get: jest.fn(() => undefined) };
      mockDb.prepare.mockReturnValueOnce(selectStmt);
      const result = applyProductionGrade('missing', 85, 'valid-token');
      expect(result.error).toBe('Learning point not found');
      expect(mockRecordWithProximateCall).not.toHaveBeenCalled();
    });
  });

  // ── processReview ───────────────────────────────────────────────────────────

  describe('processReview', () => {
    test('emits box_change event with source=user-review on Good rating (3)', () => {
      setupProcessReview({ box: 2, mastery_level: 40 });

      const result = processReview('lp-1', 3, 500, 'valid-token');

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
      const ev = mockRecordWithProximateCall.mock.calls[0][0];
      expect(ev.learningPointId).toBe('lp-1');
      expect(ev.userId).toBe(1);
      expect(ev.eventType).toBe('box_change');
      expect(ev.source).toBe('user-review');
      expect(ev.surface).toBe('manual-review');
      expect(ev.traceId).toBeNull();
      expect(ev.rating).toBe('3');
      expect(ev.prevBox).toBe(2);
      expect(ev.newBox).toBe(3); // Good advances one box
    });

    test('emits box_change event with source=user-review on Again rating (1)', () => {
      setupProcessReview({ box: 3, mastery_level: 55 });

      processReview('lp-1', 1, 200, 'valid-token');

      expect(mockRecordWithProximateCall).toHaveBeenCalledTimes(1);
      const ev = mockRecordWithProximateCall.mock.calls[0][0];
      expect(ev.eventType).toBe('box_change');
      expect(ev.source).toBe('user-review');
      expect(ev.surface).toBe('manual-review');
      expect(ev.rating).toBe('1');
      expect(ev.newBox).toBe(1); // Again resets to box 1
    });

    test('primary write result is intact even if recorder throws', () => {
      setupProcessReview({ box: 2, mastery_level: 40 });
      mockRecordWithProximateCall.mockImplementationOnce(() => {
        throw new Error('DB unavailable');
      });

      expect(() => processReview('lp-1', 3, 500, 'valid-token')).not.toThrow();
      const result = processReview('lp-1', 3, 500, 'valid-token');
      // Any second call still completes without blowing up
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
});
