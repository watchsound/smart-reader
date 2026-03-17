/**
 * learningHandlers.test.js
 *
 * Unit tests for learningHandlers.js IPC handlers.
 * Tests all IPC handlers for the AI Learning Companion.
 */

// Mock electron ipcMain
const mockHandlers = {};
const ipcMain = {
  handle: jest.fn((channel, handler) => {
    mockHandlers[channel] = handler;
  }),
};

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn((channel, handler) => {
      mockHandlers[channel] = handler;
    }),
  },
}));

// Mock all database managers
jest.mock('../../main/db/LearningTopicManager', () => ({
  getLearningTopicById: jest.fn(),
  getLearningTopics: jest.fn(),
  getActiveTopics: jest.fn(),
  getTopicsBySource: jest.fn(),
  createLearningTopic: jest.fn(),
  updateLearningTopic: jest.fn(),
  deleteLearningTopic: jest.fn(),
  updateTopicProgress: jest.fn(),
  getTopicStatistics: jest.fn(),
  countTopicsByStatus: jest.fn(),
}));

jest.mock('../../main/db/LearningPlanManager', () => ({
  getLearningPlanById: jest.fn(),
  getLearningPlanByTopic: jest.fn(),
  getLearningPlans: jest.fn(),
  createLearningPlan: jest.fn(),
  updateLearningPlan: jest.fn(),
  deleteLearningPlan: jest.fn(),
  advancePlanDay: jest.fn(),
  startPlan: jest.fn(),
  pausePlan: jest.fn(),
  resumePlan: jest.fn(),
  getTodaysItems: jest.fn(),
  updatePlanItem: jest.fn(),
}));

jest.mock('../../main/db/LearningSessionManager', () => ({
  getLearningSessionById: jest.fn(),
  getSessionsByTopic: jest.fn(),
  getRecentSessions: jest.fn(),
  startLearningSession: jest.fn(),
  completeLearningSession: jest.fn(),
  updateSessionProgress: jest.fn(),
  deleteLearningSession: jest.fn(),
  recordItemPerformance: jest.fn(),
  getItemPerformanceHistory: jest.fn(),
  getItemPerformanceSummary: jest.fn(),
  getWeakItems: jest.fn(),
  getMistakePatterns: jest.fn(),
  getDailyActivity: jest.fn(),
  getOverallStatistics: jest.fn(),
}));

jest.mock('../../main/db/LearnerProfileManager', () => ({
  getGlobalProfile: jest.fn(),
  updateGlobalProfile: jest.fn(),
  getDomainProfile: jest.fn(),
  getAllDomainProfiles: jest.fn(),
  updateDomainProfile: jest.fn(),
  updateProfileFromSession: jest.fn(),
  getFullProfile: jest.fn(),
  recordWeakArea: jest.fn(),
}));

// Import the module after mocking
const { registerLearningHandlers } = require('../../main/ipc/learningHandlers');

// Import mocked functions for assertions
const TopicManager = require('../../main/db/LearningTopicManager');
const PlanManager = require('../../main/db/LearningPlanManager');
const SessionManager = require('../../main/db/LearningSessionManager');
const ProfileManager = require('../../main/db/LearnerProfileManager');

describe('learningHandlers', () => {
  const mockStore = {};
  const mockServices = { aiProvider: {} };
  const mockEvent = {};
  const validToken = 'valid_token';

  beforeAll(() => {
    // Register handlers before tests
    registerLearningHandlers(mockStore, mockServices);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to call a handler
  const callHandler = async (channel, ...args) => {
    const handler = mockHandlers[channel];
    if (!handler) {
      throw new Error(`Handler not found: ${channel}`);
    }
    return handler(mockEvent, ...args);
  };

  // =============================================================================
  // TOPIC OPERATIONS
  // =============================================================================

  describe('Topic Operations', () => {
    describe('learning-get-topic', () => {
      it('should return topic on success', async () => {
        const mockTopic = { id: 'topic_123', name: 'Test Topic' };
        TopicManager.getLearningTopicById.mockReturnValue(mockTopic);

        const result = await callHandler('learning-get-topic', 'topic_123', validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockTopic);
        expect(TopicManager.getLearningTopicById).toHaveBeenCalledWith(
          'topic_123',
          validToken
        );
      });

      it('should return error on exception', async () => {
        TopicManager.getLearningTopicById.mockImplementation(() => {
          throw new Error('Database error');
        });

        const result = await callHandler('learning-get-topic', 'topic_123', validToken);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database error');
      });
    });

    describe('learning-get-topics', () => {
      it('should return topics with options', async () => {
        const mockTopics = [{ id: 'topic_1' }, { id: 'topic_2' }];
        TopicManager.getLearningTopics.mockReturnValue(mockTopics);

        const result = await callHandler('learning-get-topics', validToken, {
          status: 'active',
        });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(TopicManager.getLearningTopics).toHaveBeenCalledWith(validToken, {
          status: 'active',
        });
      });
    });

    describe('learning-get-active-topics', () => {
      it('should return active topics', async () => {
        const mockTopics = [{ id: 'topic_1', status: 'active' }];
        TopicManager.getActiveTopics.mockReturnValue(mockTopics);

        const result = await callHandler('learning-get-active-topics', validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockTopics);
      });
    });

    describe('learning-get-topics-by-source', () => {
      it('should return topics by source', async () => {
        const mockTopics = [{ id: 'topic_1', sourceType: 'book' }];
        TopicManager.getTopicsBySource.mockReturnValue(mockTopics);

        const result = await callHandler(
          'learning-get-topics-by-source',
          'book',
          'book_123',
          validToken
        );

        expect(result.success).toBe(true);
        expect(TopicManager.getTopicsBySource).toHaveBeenCalledWith(
          'book',
          'book_123',
          validToken
        );
      });
    });

    describe('learning-create-topic', () => {
      it('should create topic on success', async () => {
        const newTopic = { name: 'New Topic', domainType: 'vocabulary' };
        const createdTopic = { id: 'topic_123', ...newTopic };
        TopicManager.createLearningTopic.mockReturnValue(createdTopic);

        const result = await callHandler('learning-create-topic', newTopic, validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(createdTopic);
      });

      it('should return error when manager returns error', async () => {
        TopicManager.createLearningTopic.mockReturnValue({ error: 'Invalid data' });

        const result = await callHandler(
          'learning-create-topic',
          { name: '' },
          validToken
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid data');
      });
    });

    describe('learning-update-topic', () => {
      it('should update topic on success', async () => {
        const updates = { name: 'Updated Name' };
        const updatedTopic = { id: 'topic_123', name: 'Updated Name' };
        TopicManager.updateLearningTopic.mockReturnValue(updatedTopic);

        const result = await callHandler(
          'learning-update-topic',
          'topic_123',
          updates,
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(updatedTopic);
      });
    });

    describe('learning-delete-topic', () => {
      it('should delete topic on success', async () => {
        TopicManager.deleteLearningTopic.mockReturnValue({ success: true });

        const result = await callHandler('learning-delete-topic', 'topic_123', validToken);

        expect(result.success).toBe(true);
      });
    });

    describe('learning-update-topic-progress', () => {
      it('should update topic progress', async () => {
        const sessionResult = { newlyMastered: 5 };
        const updatedTopic = { id: 'topic_123', masteredItems: 105 };
        TopicManager.updateTopicProgress.mockReturnValue(updatedTopic);

        const result = await callHandler(
          'learning-update-topic-progress',
          'topic_123',
          sessionResult,
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(updatedTopic);
      });
    });

    describe('learning-get-topic-stats', () => {
      it('should return topic statistics', async () => {
        const mockStats = { totalItems: 100, masteredItems: 50 };
        TopicManager.getTopicStatistics.mockReturnValue(mockStats);

        const result = await callHandler(
          'learning-get-topic-stats',
          'topic_123',
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockStats);
      });
    });

    describe('learning-count-topics-by-status', () => {
      it('should return counts', async () => {
        const mockCounts = { active: 5, paused: 2, completed: 3 };
        TopicManager.countTopicsByStatus.mockReturnValue(mockCounts);

        const result = await callHandler('learning-count-topics-by-status', validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockCounts);
      });
    });
  });

  // =============================================================================
  // PLAN OPERATIONS
  // =============================================================================

  describe('Plan Operations', () => {
    describe('learning-get-plan', () => {
      it('should return plan on success', async () => {
        const mockPlan = { id: 'plan_123', topicId: 'topic_123' };
        PlanManager.getLearningPlanById.mockReturnValue(mockPlan);

        const result = await callHandler('learning-get-plan', 'plan_123', validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockPlan);
      });
    });

    describe('learning-get-plan-by-topic', () => {
      it('should return plan by topic', async () => {
        const mockPlan = { id: 'plan_123', topicId: 'topic_123' };
        PlanManager.getLearningPlanByTopic.mockReturnValue(mockPlan);

        const result = await callHandler(
          'learning-get-plan-by-topic',
          'topic_123',
          validToken
        );

        expect(result.success).toBe(true);
        expect(PlanManager.getLearningPlanByTopic).toHaveBeenCalledWith(
          'topic_123',
          validToken
        );
      });
    });

    describe('learning-get-plans', () => {
      it('should return plans with options', async () => {
        const mockPlans = [{ id: 'plan_1' }, { id: 'plan_2' }];
        PlanManager.getLearningPlans.mockReturnValue(mockPlans);

        const result = await callHandler('learning-get-plans', validToken, {
          status: 'active',
        });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });
    });

    describe('learning-create-plan', () => {
      it('should create plan on success', async () => {
        const newPlan = { topicId: 'topic_123', planData: {} };
        const createdPlan = { id: 'plan_123', ...newPlan };
        PlanManager.createLearningPlan.mockReturnValue(createdPlan);

        const result = await callHandler('learning-create-plan', newPlan, validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(createdPlan);
      });
    });

    describe('learning-update-plan', () => {
      it('should update plan on success', async () => {
        const updates = { currentDay: 5 };
        const updatedPlan = { id: 'plan_123', currentDay: 5 };
        PlanManager.updateLearningPlan.mockReturnValue(updatedPlan);

        const result = await callHandler(
          'learning-update-plan',
          'plan_123',
          updates,
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual(updatedPlan);
      });
    });

    describe('learning-delete-plan', () => {
      it('should delete plan on success', async () => {
        PlanManager.deleteLearningPlan.mockReturnValue({ success: true });

        const result = await callHandler('learning-delete-plan', 'plan_123', validToken);

        expect(result.success).toBe(true);
      });
    });

    describe('learning-start-plan', () => {
      it('should start plan', async () => {
        const startedPlan = { id: 'plan_123', status: 'active', currentDay: 1 };
        PlanManager.startPlan.mockReturnValue(startedPlan);

        const result = await callHandler('learning-start-plan', 'plan_123', validToken);

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('active');
      });
    });

    describe('learning-pause-plan', () => {
      it('should pause plan', async () => {
        const pausedPlan = { id: 'plan_123', status: 'paused' };
        PlanManager.pausePlan.mockReturnValue(pausedPlan);

        const result = await callHandler('learning-pause-plan', 'plan_123', validToken);

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('paused');
      });
    });

    describe('learning-resume-plan', () => {
      it('should resume plan', async () => {
        const resumedPlan = { id: 'plan_123', status: 'active' };
        PlanManager.resumePlan.mockReturnValue(resumedPlan);

        const result = await callHandler('learning-resume-plan', 'plan_123', validToken);

        expect(result.success).toBe(true);
        expect(result.data.status).toBe('active');
      });
    });

    describe('learning-advance-plan-day', () => {
      it('should advance plan day', async () => {
        const advancedPlan = { id: 'plan_123', currentDay: 6 };
        PlanManager.advancePlanDay.mockReturnValue(advancedPlan);

        const result = await callHandler(
          'learning-advance-plan-day',
          'plan_123',
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data.currentDay).toBe(6);
      });
    });

    describe('learning-get-todays-items', () => {
      it('should return today items', async () => {
        const mockItems = {
          day: 1,
          items: [{ id: 'item_1' }],
          newItems: 1,
          reviewItems: 0,
        };
        PlanManager.getTodaysItems.mockReturnValue(mockItems);

        const result = await callHandler(
          'learning-get-todays-items',
          'plan_123',
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data.items).toHaveLength(1);
      });
    });

    describe('learning-update-plan-item', () => {
      it('should update plan item', async () => {
        const itemUpdate = { wasCorrect: true };
        const updatedPlan = { id: 'plan_123' };
        PlanManager.updatePlanItem.mockReturnValue(updatedPlan);

        const result = await callHandler(
          'learning-update-plan-item',
          'plan_123',
          'item_1',
          itemUpdate,
          validToken
        );

        expect(result.success).toBe(true);
        expect(PlanManager.updatePlanItem).toHaveBeenCalledWith(
          'plan_123',
          'item_1',
          itemUpdate,
          validToken
        );
      });
    });
  });

  // =============================================================================
  // SESSION OPERATIONS
  // =============================================================================

  describe('Session Operations', () => {
    describe('learning-get-session', () => {
      it('should return session on success', async () => {
        const mockSession = { id: 'session_123', topicId: 'topic_123' };
        SessionManager.getLearningSessionById.mockReturnValue(mockSession);

        const result = await callHandler('learning-get-session', 'session_123', validToken);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSession);
      });
    });

    describe('learning-get-sessions-by-topic', () => {
      it('should return sessions by topic', async () => {
        const mockSessions = [{ id: 'session_1' }, { id: 'session_2' }];
        SessionManager.getSessionsByTopic.mockReturnValue(mockSessions);

        const result = await callHandler(
          'learning-get-sessions-by-topic',
          'topic_123',
          validToken,
          { limit: 10 }
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });
    });

    describe('learning-get-recent-sessions', () => {
      it('should return recent sessions', async () => {
        const mockSessions = [{ id: 'session_1' }];
        SessionManager.getRecentSessions.mockReturnValue(mockSessions);

        const result = await callHandler('learning-get-recent-sessions', validToken, 7);

        expect(result.success).toBe(true);
        expect(SessionManager.getRecentSessions).toHaveBeenCalledWith(validToken, 7);
      });
    });

    describe('learning-start-session', () => {
      it('should start session', async () => {
        const sessionInput = { topicId: 'topic_123', sessionType: 'learn' };
        const startedSession = { id: 'session_123', ...sessionInput };
        SessionManager.startLearningSession.mockReturnValue(startedSession);

        const result = await callHandler(
          'learning-start-session',
          sessionInput,
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data.id).toBe('session_123');
      });
    });

    describe('learning-complete-session', () => {
      it('should complete session', async () => {
        const results = { itemsReviewed: 20, itemsCorrect: 18, itemsNew: 5 };
        const completedSession = { id: 'session_123', ...results };
        SessionManager.completeLearningSession.mockReturnValue(completedSession);

        const result = await callHandler(
          'learning-complete-session',
          'session_123',
          results,
          validToken
        );

        expect(result.success).toBe(true);
        expect(SessionManager.completeLearningSession).toHaveBeenCalledWith(
          'session_123',
          results,
          validToken
        );
      });
    });

    describe('learning-update-session-progress', () => {
      it('should update session progress', async () => {
        const updates = { itemsReviewed: 15 };
        const updatedSession = { id: 'session_123', itemsReviewed: 15 };
        SessionManager.updateSessionProgress.mockReturnValue(updatedSession);

        const result = await callHandler(
          'learning-update-session-progress',
          'session_123',
          updates,
          validToken
        );

        expect(result.success).toBe(true);
      });
    });

    describe('learning-delete-session', () => {
      it('should delete session', async () => {
        SessionManager.deleteLearningSession.mockReturnValue({ success: true });

        const result = await callHandler(
          'learning-delete-session',
          'session_123',
          validToken
        );

        expect(result.success).toBe(true);
      });
    });
  });

  // =============================================================================
  // PERFORMANCE OPERATIONS
  // =============================================================================

  describe('Performance Operations', () => {
    describe('learning-record-performance', () => {
      it('should record performance', async () => {
        const performance = {
          topicId: 'topic_123',
          itemId: 'item_1',
          wasCorrect: true,
        };
        SessionManager.recordItemPerformance.mockReturnValue({ success: true, id: 1 });

        const result = await callHandler(
          'learning-record-performance',
          performance,
          validToken
        );

        expect(result.success).toBe(true);
      });
    });

    describe('learning-get-item-history', () => {
      it('should return item history', async () => {
        const mockHistory = [
          { wasCorrect: true, reviewedAt: new Date() },
          { wasCorrect: false, reviewedAt: new Date() },
        ];
        SessionManager.getItemPerformanceHistory.mockReturnValue(mockHistory);

        const result = await callHandler(
          'learning-get-item-history',
          'topic_123',
          'item_1',
          validToken,
          { limit: 10 }
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });
    });

    describe('learning-get-item-summary', () => {
      it('should return item summary', async () => {
        const mockSummary = { totalReviews: 10, accuracy: 0.8 };
        SessionManager.getItemPerformanceSummary.mockReturnValue(mockSummary);

        const result = await callHandler(
          'learning-get-item-summary',
          'topic_123',
          'item_1',
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data.accuracy).toBe(0.8);
      });
    });

    describe('learning-get-weak-items', () => {
      it('should return weak items', async () => {
        const mockWeakItems = [
          { itemId: 'item_1', accuracy: 0.3 },
          { itemId: 'item_2', accuracy: 0.4 },
        ];
        SessionManager.getWeakItems.mockReturnValue(mockWeakItems);

        const result = await callHandler(
          'learning-get-weak-items',
          'topic_123',
          validToken,
          5
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(SessionManager.getWeakItems).toHaveBeenCalledWith('topic_123', validToken, 5);
      });
    });

    describe('learning-get-mistake-patterns', () => {
      it('should return mistake patterns', async () => {
        const mockPatterns = [
          { mistakeType: 'spelling', count: 15 },
          { mistakeType: 'meaning', count: 10 },
        ];
        SessionManager.getMistakePatterns.mockReturnValue(mockPatterns);

        const result = await callHandler(
          'learning-get-mistake-patterns',
          'topic_123',
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });
    });
  });

  // =============================================================================
  // STATISTICS OPERATIONS
  // =============================================================================

  describe('Statistics Operations', () => {
    describe('learning-get-daily-activity', () => {
      it('should return daily activity', async () => {
        const mockActivity = [
          { date: '2024-01-15', sessionsCount: 3 },
          { date: '2024-01-14', sessionsCount: 2 },
        ];
        SessionManager.getDailyActivity.mockReturnValue(mockActivity);

        const result = await callHandler(
          'learning-get-daily-activity',
          validToken,
          30
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(SessionManager.getDailyActivity).toHaveBeenCalledWith(validToken, 30);
      });
    });

    describe('learning-get-overall-stats', () => {
      it('should return overall statistics', async () => {
        const mockStats = {
          totalSessions: 100,
          totalMinutes: 3000,
          totalItemsReviewed: 5000,
        };
        SessionManager.getOverallStatistics.mockReturnValue(mockStats);

        const result = await callHandler('learning-get-overall-stats', validToken);

        expect(result.success).toBe(true);
        expect(result.data.totalSessions).toBe(100);
      });
    });
  });

  // =============================================================================
  // PROFILE OPERATIONS
  // =============================================================================

  describe('Profile Operations', () => {
    describe('learning-get-global-profile', () => {
      it('should return global profile', async () => {
        const mockProfile = { learningStyle: 'visual', consistencyScore: 0.85 };
        ProfileManager.getGlobalProfile.mockReturnValue(mockProfile);

        const result = await callHandler('learning-get-global-profile', validToken);

        expect(result.success).toBe(true);
        expect(result.data.learningStyle).toBe('visual');
      });
    });

    describe('learning-update-global-profile', () => {
      it('should update global profile', async () => {
        const updates = { learningStyle: 'reading' };
        const updatedProfile = { ...updates };
        ProfileManager.updateGlobalProfile.mockReturnValue(updatedProfile);

        const result = await callHandler(
          'learning-update-global-profile',
          updates,
          validToken
        );

        expect(result.success).toBe(true);
      });
    });

    describe('learning-get-domain-profile', () => {
      it('should return domain profile', async () => {
        const mockProfile = { domainType: 'vocabulary', proficiencyLevel: 'intermediate' };
        ProfileManager.getDomainProfile.mockReturnValue(mockProfile);

        const result = await callHandler(
          'learning-get-domain-profile',
          'vocabulary',
          validToken
        );

        expect(result.success).toBe(true);
        expect(result.data.domainType).toBe('vocabulary');
      });
    });

    describe('learning-get-all-domain-profiles', () => {
      it('should return all domain profiles', async () => {
        const mockProfiles = [
          { domainType: 'vocabulary' },
          { domainType: 'math' },
        ];
        ProfileManager.getAllDomainProfiles.mockReturnValue(mockProfiles);

        const result = await callHandler('learning-get-all-domain-profiles', validToken);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
      });
    });

    describe('learning-update-domain-profile', () => {
      it('should update domain profile', async () => {
        const updates = { recentAccuracy: 0.9 };
        const updatedProfile = { domainType: 'vocabulary', ...updates };
        ProfileManager.updateDomainProfile.mockReturnValue(updatedProfile);

        const result = await callHandler(
          'learning-update-domain-profile',
          'vocabulary',
          updates,
          validToken
        );

        expect(result.success).toBe(true);
      });
    });

    describe('learning-get-full-profile', () => {
      it('should return full profile', async () => {
        const mockFullProfile = {
          userId: 1,
          globalProfile: { learningStyle: 'visual' },
          domainProfiles: [{ domainType: 'vocabulary' }],
        };
        ProfileManager.getFullProfile.mockReturnValue(mockFullProfile);

        const result = await callHandler('learning-get-full-profile', validToken);

        expect(result.success).toBe(true);
        expect(result.data.globalProfile).toBeDefined();
        expect(result.data.domainProfiles).toHaveLength(1);
      });
    });

    describe('learning-update-profile-from-session', () => {
      it('should update profile from session data', async () => {
        const sessionData = { itemsReviewed: 25, itemsCorrect: 20, durationMinutes: 15 };
        const updatedProfile = { domainType: 'vocabulary', recentAccuracy: 0.8 };
        ProfileManager.updateProfileFromSession.mockReturnValue(updatedProfile);

        const result = await callHandler(
          'learning-update-profile-from-session',
          'vocabulary',
          sessionData,
          validToken
        );

        expect(result.success).toBe(true);
        expect(ProfileManager.updateProfileFromSession).toHaveBeenCalledWith(
          'vocabulary',
          sessionData,
          validToken
        );
      });
    });

    describe('learning-record-weak-area', () => {
      it('should record weak area', async () => {
        const weakArea = { concept: 'synonyms', accuracy: 0.4 };
        const updatedProfile = { domainType: 'vocabulary', weakAreas: [weakArea] };
        ProfileManager.recordWeakArea.mockReturnValue(updatedProfile);

        const result = await callHandler(
          'learning-record-weak-area',
          'vocabulary',
          weakArea,
          validToken
        );

        expect(result.success).toBe(true);
        expect(ProfileManager.recordWeakArea).toHaveBeenCalledWith(
          'vocabulary',
          weakArea,
          validToken
        );
      });
    });
  });

  // =============================================================================
  // ERROR HANDLING
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle errors in all handlers consistently', async () => {
      const errorMessage = 'Unexpected error';

      // Topic handler error
      TopicManager.getLearningTopics.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      let result = await callHandler('learning-get-topics', validToken);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);

      // Plan handler error
      PlanManager.getLearningPlans.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      result = await callHandler('learning-get-plans', validToken);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);

      // Session handler error
      SessionManager.getRecentSessions.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      result = await callHandler('learning-get-recent-sessions', validToken);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);

      // Profile handler error
      ProfileManager.getGlobalProfile.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      result = await callHandler('learning-get-global-profile', validToken);
      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
    });

    it('should handle manager error responses', async () => {
      TopicManager.createLearningTopic.mockReturnValue({ error: 'Invalid session' });

      const result = await callHandler(
        'learning-create-topic',
        { name: 'Test' },
        'invalid_token'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid session');
    });
  });

  // =============================================================================
  // HANDLER REGISTRATION
  // =============================================================================

  describe('Handler Registration', () => {
    it('should register all expected handlers', () => {
      const expectedHandlers = [
        // Topic handlers
        'learning-get-topic',
        'learning-get-topics',
        'learning-get-active-topics',
        'learning-get-topics-by-source',
        'learning-create-topic',
        'learning-update-topic',
        'learning-delete-topic',
        'learning-update-topic-progress',
        'learning-get-topic-stats',
        'learning-count-topics-by-status',
        // Plan handlers
        'learning-get-plan',
        'learning-get-plan-by-topic',
        'learning-get-plans',
        'learning-create-plan',
        'learning-update-plan',
        'learning-delete-plan',
        'learning-start-plan',
        'learning-pause-plan',
        'learning-resume-plan',
        'learning-advance-plan-day',
        'learning-get-todays-items',
        'learning-update-plan-item',
        // Session handlers
        'learning-get-session',
        'learning-get-sessions-by-topic',
        'learning-get-recent-sessions',
        'learning-start-session',
        'learning-complete-session',
        'learning-update-session-progress',
        'learning-delete-session',
        // Performance handlers
        'learning-record-performance',
        'learning-get-item-history',
        'learning-get-item-summary',
        'learning-get-weak-items',
        'learning-get-mistake-patterns',
        // Statistics handlers
        'learning-get-daily-activity',
        'learning-get-overall-stats',
        // Profile handlers
        'learning-get-global-profile',
        'learning-update-global-profile',
        'learning-get-domain-profile',
        'learning-get-all-domain-profiles',
        'learning-update-domain-profile',
        'learning-get-full-profile',
        'learning-update-profile-from-session',
        'learning-record-weak-area',
      ];

      expectedHandlers.forEach((handler) => {
        expect(mockHandlers[handler]).toBeDefined();
      });
    });
  });
});
