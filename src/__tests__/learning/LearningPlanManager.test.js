/**
 * LearningPlanManager.test.js
 *
 * Unit tests for LearningPlanManager.js database operations.
 * Tests CRUD operations for AI-generated learning plans.
 */

// Mock the database and utilities
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(),
  },
  getUserIdFromToken: jest.fn(),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => date?.toISOString?.() || date),
}));

const db = require('../../main/db/dbManager').default;
const { getUserIdFromToken } = require('../../main/db/dbManager');

const {
  getLearningPlanById,
  getLearningPlanByTopic,
  getLearningPlans,
  createLearningPlan,
  updateLearningPlan,
  deleteLearningPlan,
  advancePlanDay,
  startPlan,
  pausePlan,
  resumePlan,
  getTodaysItems,
  updatePlanItem,
} = require('../../main/db/LearningPlanManager');

describe('LearningPlanManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserIdFromToken.mockReturnValue(1);
  });

  // =============================================================================
  // Helper to create mock plan data
  // =============================================================================

  const createMockPlanRow = (overrides = {}) => ({
    id: 'plan_123',
    topic_id: 'topic_123',
    user_id: 1,
    plan_data: JSON.stringify({
      overview: 'Test plan',
      estimatedDuration: 30,
      totalPhases: 2,
      phases: [
        { phaseNumber: 1, name: 'Phase 1', durationDays: 15 },
        { phaseNumber: 2, name: 'Phase 2', durationDays: 15 },
      ],
      items: [
        {
          id: 'item_1',
          name: 'Item 1',
          status: 'pending',
          scheduledDay: 1,
          masteryLevel: 0,
          correctStreak: 0,
          reviewCount: 0,
        },
        {
          id: 'item_2',
          name: 'Item 2',
          status: 'reviewing',
          nextReviewAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
          masteryLevel: 30,
          correctStreak: 2,
          reviewCount: 5,
        },
      ],
      dailySchedule: {
        recommendedSessions: 2,
        sessionDurationMinutes: 15,
        newItemsPercent: 30,
        reviewPercent: 50,
        practicePercent: 20,
      },
      milestones: [],
      recommendations: [],
    }),
    current_phase: 1,
    current_day: 1,
    status: 'active',
    started_at: '2024-01-01T00:00:00.000Z',
    completed_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: null,
    ...overrides,
  });

  // =============================================================================
  // getLearningPlanById
  // =============================================================================

  describe('getLearningPlanById', () => {
    it('should return plan when found', () => {
      const mockRow = createMockPlanRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlanById('plan_123', 'valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        'SELECT * FROM learning_plan WHERE id = ? AND user_id = ?'
      );
      expect(mockStmt.get).toHaveBeenCalledWith('plan_123', 1);
      expect(result.id).toBe('plan_123');
      expect(result.topicId).toBe('topic_123');
      expect(result.planData).toBeDefined();
      expect(result.planData.overview).toBe('Test plan');
    });

    it('should return null when plan not found', () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlanById('nonexistent', 'valid_token');

      expect(result).toBeNull();
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getLearningPlanById('plan_123', 'invalid_token');

      expect(result).toBeNull();
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('should handle invalid JSON in plan_data gracefully', () => {
      const mockRow = {
        ...createMockPlanRow(),
        plan_data: 'invalid json {{{',
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlanById('plan_123', 'valid_token');

      expect(result.planData).toBeNull();
    });

    it('should handle null plan_data', () => {
      const mockRow = {
        ...createMockPlanRow(),
        plan_data: null,
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlanById('plan_123', 'valid_token');

      expect(result.planData).toBeNull();
    });

    it('should convert date strings to Date objects', () => {
      const mockRow = createMockPlanRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlanById('plan_123', 'valid_token');

      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  // =============================================================================
  // getLearningPlanByTopic
  // =============================================================================

  describe('getLearningPlanByTopic', () => {
    it('should return plan for topic', () => {
      const mockRow = createMockPlanRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlanByTopic('topic_123', 'valid_token');

      expect(mockStmt.get).toHaveBeenCalledWith('topic_123', 1);
      expect(result.topicId).toBe('topic_123');
    });

    it('should prioritize active plans', () => {
      const mockStmt = { get: jest.fn() };
      db.prepare.mockReturnValue(mockStmt);

      getLearningPlanByTopic('topic_123', 'valid_token');

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain("WHEN 'active' THEN 0");
      expect(query).toContain("WHEN 'paused' THEN 1");
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getLearningPlanByTopic('topic_123', 'invalid_token');

      expect(result).toBeNull();
    });
  });

  // =============================================================================
  // getLearningPlans
  // =============================================================================

  describe('getLearningPlans', () => {
    it('should return all plans for user', () => {
      const mockRows = [createMockPlanRow(), createMockPlanRow({ id: 'plan_456' })];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getLearningPlans('valid_token');

      expect(result).toHaveLength(2);
    });

    it('should filter by status', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getLearningPlans('valid_token', { status: 'active' });

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('AND status = ?')
      );
      expect(mockStmt.all).toHaveBeenCalledWith(1, 'active', 50, 0);
    });

    it('should apply limit and offset', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getLearningPlans('valid_token', { limit: 10, offset: 20 });

      expect(mockStmt.all).toHaveBeenCalledWith(1, 10, 20);
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getLearningPlans('invalid_token');

      expect(result).toEqual([]);
    });
  });

  // =============================================================================
  // createLearningPlan
  // =============================================================================

  describe('createLearningPlan', () => {
    it('should create plan with required fields', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare.mockReturnValueOnce(mockRunStmt).mockReturnValueOnce(mockGetStmt);

      const result = createLearningPlan(
        {
          topicId: 'topic_123',
          planData: { overview: 'New plan', items: [] },
        },
        'valid_token'
      );

      expect(mockRunStmt.run).toHaveBeenCalled();
      expect(result.topicId).toBe('topic_123');
    });

    it('should serialize planData to JSON', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare.mockReturnValueOnce(mockRunStmt).mockReturnValueOnce(mockGetStmt);

      createLearningPlan(
        {
          topicId: 'topic_123',
          planData: { overview: 'Test', nested: { data: true } },
        },
        'valid_token'
      );

      const runCall = mockRunStmt.run.mock.calls[0];
      const planDataArg = runCall[3];
      expect(JSON.parse(planDataArg)).toEqual({
        overview: 'Test',
        nested: { data: true },
      });
    });

    it('should use default values for missing optional fields', () => {
      const mockRunStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare.mockReturnValueOnce(mockRunStmt).mockReturnValueOnce(mockGetStmt);

      createLearningPlan({ topicId: 'topic_123' }, 'valid_token');

      const runCall = mockRunStmt.run.mock.calls[0];
      expect(runCall[4]).toBe(1); // currentPhase default
      expect(runCall[5]).toBe(0); // currentDay default
      expect(runCall[6]).toBe('active'); // status default
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = createLearningPlan(
        { topicId: 'topic_123' },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });
  });

  // =============================================================================
  // updateLearningPlan
  // =============================================================================

  describe('updateLearningPlan', () => {
    it('should update single field', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = updateLearningPlan(
        'plan_123',
        { currentDay: 5 },
        'valid_token'
      );

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('current_day = ?')
      );
      expect(result.id).toBe('plan_123');
    });

    it('should update planData by serializing to JSON', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateLearningPlan(
        'plan_123',
        { planData: { updated: true, items: [] } },
        'valid_token'
      );

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(JSON.parse(runCall[0])).toEqual({ updated: true, items: [] });
    });

    it('should update multiple fields', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateLearningPlan(
        'plan_123',
        {
          currentPhase: 2,
          currentDay: 20,
          status: 'completed',
        },
        'valid_token'
      );

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('current_phase = ?');
      expect(query).toContain('current_day = ?');
      expect(query).toContain('status = ?');
    });

    it('should return unchanged plan when no updates provided', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };
      db.prepare.mockReturnValue(mockGetStmt);

      updateLearningPlan('plan_123', {}, 'valid_token');

      // Should only call prepare once (for SELECT, not UPDATE)
      expect(db.prepare).toHaveBeenCalledTimes(1);
    });

    it('should handle null dates', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateLearningPlan(
        'plan_123',
        { startedAt: null, completedAt: null },
        'valid_token'
      );

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall[0]).toBeNull();
      expect(runCall[1]).toBeNull();
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = updateLearningPlan('plan_123', {}, 'invalid_token');

      expect(result.error).toBe('Invalid session');
    });
  });

  // =============================================================================
  // deleteLearningPlan
  // =============================================================================

  describe('deleteLearningPlan', () => {
    it('should delete existing plan', () => {
      const mockStmt = { run: jest.fn().mockReturnValue({ changes: 1 }) };
      db.prepare.mockReturnValue(mockStmt);

      const result = deleteLearningPlan('plan_123', 'valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        'DELETE FROM learning_plan WHERE id = ? AND user_id = ?'
      );
      expect(result.success).toBe(true);
    });

    it('should return success false when plan not found', () => {
      const mockStmt = { run: jest.fn().mockReturnValue({ changes: 0 }) };
      db.prepare.mockReturnValue(mockStmt);

      const result = deleteLearningPlan('nonexistent', 'valid_token');

      expect(result.success).toBe(false);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = deleteLearningPlan('plan_123', 'invalid_token');

      expect(result.error).toBe('Invalid session');
    });
  });

  // =============================================================================
  // advancePlanDay
  // =============================================================================

  describe('advancePlanDay', () => {
    it('should increment current day', () => {
      const mockRow = createMockPlanRow({ current_day: 5 });
      const mockGetStmt = { get: jest.fn().mockReturnValue(mockRow) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt) // Initial get
        .mockReturnValueOnce(mockUpdateStmt) // Update
        .mockReturnValueOnce(mockGetStmt); // Final get

      advancePlanDay('plan_123', 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(6); // Day incremented from 5 to 6
    });

    it('should advance phase when days exceed phase duration', () => {
      const mockRow = createMockPlanRow({
        current_day: 15,
        current_phase: 1,
      });
      const mockGetStmt = { get: jest.fn().mockReturnValue(mockRow) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      advancePlanDay('plan_123', 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain(2); // Phase advanced to 2
    });

    it('should set status to completed when reaching estimated duration', () => {
      const mockRow = createMockPlanRow({
        current_day: 29,
      });
      const mockGetStmt = { get: jest.fn().mockReturnValue(mockRow) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      advancePlanDay('plan_123', 'valid_token');

      const query = db.prepare.mock.calls[1][0];
      expect(query).toContain('status = ?');
      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain('completed');
    });

    it('should return error when plan not found', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockGetStmt);

      const result = advancePlanDay('nonexistent', 'valid_token');

      expect(result.error).toBe('Plan not found');
    });
  });

  // =============================================================================
  // startPlan
  // =============================================================================

  describe('startPlan', () => {
    it('should set status to active and startedAt', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(
          createMockPlanRow({
            status: 'active',
            current_day: 1,
          })
        ),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = startPlan('plan_123', 'valid_token');

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('status = ?');
      expect(query).toContain('started_at = ?');
      expect(query).toContain('current_day = ?');
      expect(result.status).toBe('active');
    });
  });

  // =============================================================================
  // pausePlan
  // =============================================================================

  describe('pausePlan', () => {
    it('should set status to paused', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockPlanRow({ status: 'paused' })),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = pausePlan('plan_123', 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain('paused');
      expect(result.status).toBe('paused');
    });
  });

  // =============================================================================
  // resumePlan
  // =============================================================================

  describe('resumePlan', () => {
    it('should set status to active', () => {
      const mockUpdateStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockPlanRow({ status: 'active' })),
      };

      db.prepare
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      const result = resumePlan('plan_123', 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain('active');
      expect(result.status).toBe('active');
    });
  });

  // =============================================================================
  // getTodaysItems
  // =============================================================================

  describe('getTodaysItems', () => {
    it("should return items scheduled for today's day", () => {
      const mockRow = createMockPlanRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getTodaysItems('plan_123', 'valid_token');

      expect(result.day).toBe(1);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.newItems).toBeGreaterThanOrEqual(0);
      expect(result.reviewItems).toBeGreaterThanOrEqual(0);
    });

    it('should include items due for review', () => {
      const mockRow = createMockPlanRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getTodaysItems('plan_123', 'valid_token');

      // item_2 has a past nextReviewAt, so it should be included
      const reviewItem = result.items.find((i) => i.id === 'item_2');
      expect(reviewItem).toBeDefined();
    });

    it('should return schedule information', () => {
      const mockRow = createMockPlanRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getTodaysItems('plan_123', 'valid_token');

      expect(result.schedule).toBeDefined();
      expect(result.schedule.recommendedSessions).toBe(2);
      expect(result.schedule.sessionDurationMinutes).toBe(15);
    });

    it('should return error when plan not found', () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getTodaysItems('nonexistent', 'valid_token');

      expect(result.error).toBe('Plan not found');
    });

    it('should handle plan with no items', () => {
      const mockRow = {
        ...createMockPlanRow(),
        plan_data: JSON.stringify({ overview: 'Empty plan' }),
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getTodaysItems('plan_123', 'valid_token');

      expect(result.items).toEqual([]);
    });
  });

  // =============================================================================
  // updatePlanItem
  // =============================================================================

  describe('updatePlanItem', () => {
    it('should update item in plan', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updatePlanItem('plan_123', 'item_1', { name: 'Updated Item' }, 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const planDataJson = runCall[0];
      const planData = JSON.parse(planDataJson);
      const updatedItem = planData.items.find((i) => i.id === 'item_1');
      expect(updatedItem.name).toBe('Updated Item');
    });

    it('should increase masteryLevel and correctStreak on correct answer', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updatePlanItem('plan_123', 'item_1', { wasCorrect: true }, 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const planData = JSON.parse(runCall[0]);
      const item = planData.items.find((i) => i.id === 'item_1');

      expect(item.correctStreak).toBe(1);
      expect(item.masteryLevel).toBeGreaterThan(0);
      expect(item.reviewCount).toBe(1);
    });

    it('should reset correctStreak and decrease masteryLevel on incorrect answer', () => {
      const mockRow = createMockPlanRow();
      // Modify item_2 to have higher mastery
      const planData = JSON.parse(mockRow.plan_data);
      planData.items[1].masteryLevel = 50;
      planData.items[1].correctStreak = 3;
      mockRow.plan_data = JSON.stringify(planData);

      const mockGetStmt = { get: jest.fn().mockReturnValue(mockRow) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updatePlanItem('plan_123', 'item_2', { wasCorrect: false }, 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const updatedPlanData = JSON.parse(runCall[0]);
      const item = updatedPlanData.items.find((i) => i.id === 'item_2');

      expect(item.correctStreak).toBe(0);
      expect(item.masteryLevel).toBe(45); // 50 - 5
    });

    it('should set item to mastered when masteryLevel >= 90 and correctStreak >= 3', () => {
      const mockRow = createMockPlanRow();
      const planData = JSON.parse(mockRow.plan_data);
      planData.items[0].masteryLevel = 88;
      planData.items[0].correctStreak = 2;
      mockRow.plan_data = JSON.stringify(planData);

      const mockGetStmt = { get: jest.fn().mockReturnValue(mockRow) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updatePlanItem('plan_123', 'item_1', { wasCorrect: true }, 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const updatedPlanData = JSON.parse(runCall[0]);
      const item = updatedPlanData.items.find((i) => i.id === 'item_1');

      // 88 + 10 + (3 * 2) = 104, capped at 100
      expect(item.masteryLevel).toBe(100);
      expect(item.correctStreak).toBe(3);
      expect(item.status).toBe('mastered');
    });

    it('should update status to learning from pending', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updatePlanItem('plan_123', 'item_1', { wasCorrect: true }, 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const updatedPlanData = JSON.parse(runCall[0]);
      const item = updatedPlanData.items.find((i) => i.id === 'item_1');

      expect(item.status).toBe('learning');
    });

    it('should calculate nextReviewAt based on correctStreak', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updatePlanItem('plan_123', 'item_1', { wasCorrect: true }, 'valid_token');

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const updatedPlanData = JSON.parse(runCall[0]);
      const item = updatedPlanData.items.find((i) => i.id === 'item_1');

      expect(item.nextReviewAt).toBeDefined();
      const nextReviewDate = new Date(item.nextReviewAt);
      expect(nextReviewDate > new Date()).toBe(true);
    });

    it('should return error when plan not found', () => {
      const mockStmt = { get: jest.fn().mockReturnValue(undefined) };
      db.prepare.mockReturnValue(mockStmt);

      const result = updatePlanItem(
        'nonexistent',
        'item_1',
        { name: 'Test' },
        'valid_token'
      );

      expect(result.error).toBe('Plan not found');
    });

    it('should return error when item not found in plan', () => {
      const mockStmt = { get: jest.fn().mockReturnValue(createMockPlanRow()) };
      db.prepare.mockReturnValue(mockStmt);

      const result = updatePlanItem(
        'plan_123',
        'nonexistent_item',
        { name: 'Test' },
        'valid_token'
      );

      expect(result.error).toBe('Item not found in plan');
    });

    it('should return error when plan has no items', () => {
      const mockRow = {
        ...createMockPlanRow(),
        plan_data: JSON.stringify({ overview: 'No items' }),
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = updatePlanItem(
        'plan_123',
        'item_1',
        { name: 'Test' },
        'valid_token'
      );

      expect(result.error).toBe('Plan has no items');
    });
  });
});
