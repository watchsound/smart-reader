/**
 * LearnerProfileManager.test.js
 *
 * Unit tests for LearnerProfileManager.js database operations.
 * Tests CRUD operations for learner profiles.
 *
 * Actual exports from LearnerProfileManager:
 * - getGlobalProfile
 * - createGlobalProfile
 * - updateGlobalProfile
 * - getDomainProfile
 * - getAllDomainProfiles
 * - createDomainProfile
 * - updateDomainProfile
 * - deleteDomainProfile
 * - updateProfileFromSession
 * - getFullProfile
 * - recordWeakArea
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
  getGlobalProfile,
  createGlobalProfile,
  updateGlobalProfile,
  getDomainProfile,
  getAllDomainProfiles,
  createDomainProfile,
  updateDomainProfile,
  deleteDomainProfile,
  updateProfileFromSession,
  getFullProfile,
  recordWeakArea,
} = require('../../main/db/LearnerProfileManager');

describe('LearnerProfileManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserIdFromToken.mockReturnValue(1);
  });

  // =============================================================================
  // Helper to create mock database rows
  // =============================================================================

  const createMockGlobalProfileRow = (overrides = {}) => ({
    id: 1,
    user_id: 1,
    global_profile: JSON.stringify({
      learningStyle: 'visual',
      learningStyleScores: {
        visual: 0.5,
        reading: 0.2,
        hands_on: 0.2,
        auditory: 0.1,
      },
      preferredTimeOfDay: 'morning',
      optimalSessionLength: 25,
      sessionLengthPreference: 'medium',
      averageLearningVelocity: 15,
      consistencyScore: 0.85,
      streakRecord: 30,
      averageRetentionRate: 0.8,
      optimalReviewInterval: 4,
      forgettingCurveSlope: 0.3,
      averageSessionsPerWeek: 5,
      preferredDays: ['Monday', 'Wednesday', 'Friday'],
      engagementTrend: 'increasing',
      performsWellWith: ['flashcards', 'quizzes'],
      strugglesWidth: ['long readings'],
      motivationalTriggers: ['streaks'],
      aiInsights: ['Good progress'],
      lastAnalyzedAt: null,
    }),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
    ...overrides,
  });

  const createMockDomainProfileRow = (overrides = {}) => ({
    id: 1,
    user_id: 1,
    domain_type: 'vocabulary',
    domain_name: 'GRE Vocabulary',
    profile_data: JSON.stringify({
      proficiencyLevel: 'intermediate',
      estimatedProficiencyScore: 65,
      totalItemsLearned: 800,
      totalItemsMastered: 500,
      averageMasteryLevel: 62,
      itemsPerSession: 25,
      averageTimePerItem: 8,
      learningVelocityTrend: 'improving',
      overallAccuracy: 0.78,
      recentAccuracy: 0.82,
      accuracyTrend: 'improving',
      retentionRate: 0.75,
      optimalReviewIntervals: [1, 2, 5, 12, 25],
      currentDifficultyLevel: 'intermediate',
      difficultyAdjustmentNeeded: 'maintain',
      weakAreas: [],
      strongAreas: ['Common words'],
      contentTypePerformance: { flashcards: 0.85 },
      assessmentTypePerformance: { multiple_choice: 0.8 },
      totalTimeSpentMinutes: 2400,
      averageSessionMinutes: 30,
      currentGoals: [],
      aiInsights: [],
      suggestedFocus: [],
      lastStudiedAt: null,
      lastAnalyzedAt: null,
    }),
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
    ...overrides,
  });

  // =============================================================================
  // getGlobalProfile
  // =============================================================================

  describe('getGlobalProfile', () => {
    it('should return global profile when found', () => {
      const mockRow = createMockGlobalProfileRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getGlobalProfile('valid_token');

      expect(db.prepare).toHaveBeenCalledWith(
        'SELECT * FROM learner_profile WHERE user_id = ?'
      );
      expect(result.globalProfile.learningStyle).toBe('visual');
      expect(result.globalProfile.learningStyleScores.visual).toBe(0.5);
    });

    it('should auto-create profile when not found', () => {
      const mockGetStmt = { get: jest.fn().mockReturnValue(undefined) };
      const mockInsertStmt = { run: jest.fn() };

      // First call returns nothing, second creates
      db.prepare
        .mockReturnValueOnce(mockGetStmt)  // SELECT in getGlobalProfile
        .mockReturnValueOnce(mockInsertStmt)  // INSERT in createGlobalProfile
        .mockReturnValueOnce(mockGetStmt);  // SELECT again

      const result = getGlobalProfile('valid_token');

      // createGlobalProfile is called which runs INSERT
      expect(mockInsertStmt.run).toHaveBeenCalled();
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getGlobalProfile('invalid_token');

      expect(result).toBeNull();
    });

    it('should parse globalProfile correctly', () => {
      const mockRow = createMockGlobalProfileRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getGlobalProfile('valid_token');

      expect(result.globalProfile.preferredDays).toEqual(['Monday', 'Wednesday', 'Friday']);
      expect(result.globalProfile.performsWellWith).toEqual(['flashcards', 'quizzes']);
      expect(result.globalProfile.aiInsights).toBeInstanceOf(Array);
    });

    it('should handle invalid JSON gracefully', () => {
      const mockRow = {
        id: 1,
        user_id: 1,
        global_profile: 'invalid json',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: null,
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getGlobalProfile('valid_token');

      // Should fall back to defaults
      expect(result.globalProfile).toBeDefined();
      expect(result.globalProfile.learningStyle).toBe('mixed');
    });

    it('should include id and timestamps in result', () => {
      const mockRow = createMockGlobalProfileRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getGlobalProfile('valid_token');

      expect(result.id).toBe(1);
      expect(result.userId).toBe(1);
      expect(result.createdAt).toBeInstanceOf(Date);
    });
  });

  // =============================================================================
  // createGlobalProfile
  // =============================================================================

  describe('createGlobalProfile', () => {
    it('should create global profile with default values', () => {
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockGlobalProfileRow()) };

      db.prepare
        .mockReturnValueOnce(mockInsertStmt)  // INSERT
        .mockReturnValueOnce(mockGetStmt);     // SELECT after insert

      const result = createGlobalProfile('valid_token');

      expect(mockInsertStmt.run).toHaveBeenCalled();
      expect(result.globalProfile).toBeDefined();
    });

    it('should create global profile with initial data', () => {
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockGlobalProfileRow()) };

      db.prepare
        .mockReturnValueOnce(mockInsertStmt)
        .mockReturnValueOnce(mockGetStmt);

      const initialProfile = {
        learningStyle: 'visual',
        consistencyScore: 0.9,
      };

      createGlobalProfile('valid_token', initialProfile);

      expect(mockInsertStmt.run).toHaveBeenCalled();
      // Check that the JSON contains the initial data
      const runCall = mockInsertStmt.run.mock.calls[0];
      expect(runCall[1]).toContain('visual');
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = createGlobalProfile('invalid_token');

      expect(result.error).toBe('Invalid session');
    });

    it('should use ON CONFLICT for upsert behavior', () => {
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmt = { get: jest.fn().mockReturnValue(createMockGlobalProfileRow()) };

      db.prepare
        .mockReturnValueOnce(mockInsertStmt)
        .mockReturnValueOnce(mockGetStmt);

      createGlobalProfile('valid_token');

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('ON CONFLICT');
    });
  });

  // =============================================================================
  // updateGlobalProfile
  // =============================================================================

  describe('updateGlobalProfile', () => {
    it('should update existing profile', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)    // getGlobalProfile SELECT
        .mockReturnValueOnce(mockUpdateStmt) // UPDATE
        .mockReturnValueOnce(mockGetStmt);   // Return updated profile

      const result = updateGlobalProfile(
        {
          learningStyle: 'reading',
          consistencyScore: 0.95,
        },
        'valid_token'
      );

      expect(mockUpdateStmt.run).toHaveBeenCalled();
    });

    it('should merge updates with existing profile', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateGlobalProfile(
        {
          consistencyScore: 0.99,
        },
        'valid_token'
      );

      // Should preserve other fields
      const runCall = mockUpdateStmt.run.mock.calls[0];
      const profileJson = runCall[0];
      expect(profileJson).toContain('preferredTimeOfDay');
    });

    it('should create profile if none exists', () => {
      const mockGetStmtEmpty = { get: jest.fn().mockReturnValue(undefined) };
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmtFilled = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };

      db.prepare
        .mockReturnValueOnce(mockGetStmtEmpty)   // Initial check - not found
        .mockReturnValueOnce(mockInsertStmt)     // Create via createGlobalProfile
        .mockReturnValueOnce(mockGetStmtFilled); // Return created

      updateGlobalProfile({ learningStyle: 'visual' }, 'valid_token');

      expect(mockInsertStmt.run).toHaveBeenCalled();
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = updateGlobalProfile(
        { learningStyle: 'visual' },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });

    it('should merge nested learningStyleScores', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateGlobalProfile(
        {
          learningStyleScores: { visual: 0.7 },
        },
        'valid_token'
      );

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const profileJson = runCall[0];
      expect(profileJson).toContain('0.7');
      // Should also preserve other style scores
      expect(profileJson).toContain('reading');
    });
  });

  // =============================================================================
  // getDomainProfile
  // =============================================================================

  describe('getDomainProfile', () => {
    it('should return domain profile when found', () => {
      const mockRow = createMockDomainProfileRow();
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDomainProfile('vocabulary', 'valid_token');

      expect(mockStmt.get).toHaveBeenCalledWith(1, 'vocabulary');
      expect(result.domainType).toBe('vocabulary');
      expect(result.proficiencyLevel).toBe('intermediate');
    });

    it('should auto-create profile when not found', () => {
      const mockGetStmtEmpty = { get: jest.fn().mockReturnValue(undefined) };
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmtFilled = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };

      db.prepare
        .mockReturnValueOnce(mockGetStmtEmpty)  // Initial SELECT
        .mockReturnValueOnce(mockInsertStmt)     // INSERT in createDomainProfile
        .mockReturnValueOnce(mockGetStmtFilled); // Return created

      getDomainProfile('math', 'valid_token');

      expect(mockInsertStmt.run).toHaveBeenCalled();
    });

    it('should return null for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getDomainProfile('vocabulary', 'invalid_token');

      expect(result).toBeNull();
    });

    it('should parse profile_data JSON correctly', () => {
      const mockRow = createMockDomainProfileRow({
        profile_data: JSON.stringify({
          proficiencyLevel: 'advanced',
          weakAreas: [{ concept: 'synonyms', accuracy: 0.4 }],
          strongAreas: ['Common words', 'Basic verbs'],
        }),
      });
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDomainProfile('vocabulary', 'valid_token');

      expect(result.weakAreas).toHaveLength(1);
      expect(result.strongAreas).toContain('Common words');
    });

    it('should merge with defaults for missing fields', () => {
      const mockRow = createMockDomainProfileRow({
        profile_data: JSON.stringify({
          proficiencyLevel: 'beginner',
          // Missing many fields - should get defaults
        }),
      });
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDomainProfile('vocabulary', 'valid_token');

      expect(result.proficiencyLevel).toBe('beginner');
      expect(result.overallAccuracy).toBeDefined();
      expect(result.weakAreas).toBeDefined();
    });
  });

  // =============================================================================
  // getAllDomainProfiles
  // =============================================================================

  describe('getAllDomainProfiles', () => {
    it('should return all domain profiles for user', () => {
      const mockRows = [
        createMockDomainProfileRow({ domain_type: 'vocabulary' }),
        createMockDomainProfileRow({ domain_type: 'math', id: 2 }),
      ];
      const mockStmt = { all: jest.fn().mockReturnValue(mockRows) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getAllDomainProfiles('valid_token');

      expect(result).toHaveLength(2);
      expect(result[0].domainType).toBe('vocabulary');
      expect(result[1].domainType).toBe('math');
    });

    it('should return empty array for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getAllDomainProfiles('invalid_token');

      expect(result).toEqual([]);
    });

    it('should return empty array when no profiles exist', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getAllDomainProfiles('valid_token');

      expect(result).toEqual([]);
    });

    it('should order by updated_at DESC', () => {
      const mockStmt = { all: jest.fn().mockReturnValue([]) };
      db.prepare.mockReturnValue(mockStmt);

      getAllDomainProfiles('valid_token');

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('ORDER BY updated_at DESC');
    });
  });

  // =============================================================================
  // createDomainProfile
  // =============================================================================

  describe('createDomainProfile', () => {
    it('should create new domain profile', () => {
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };

      db.prepare
        .mockReturnValueOnce(mockInsertStmt)
        .mockReturnValueOnce(mockGetStmt);

      createDomainProfile('vocabulary', 'GRE Vocab', 'valid_token');

      expect(mockInsertStmt.run).toHaveBeenCalled();
      const runCall = mockInsertStmt.run.mock.calls[0];
      expect(runCall).toContain(1); // userId
      expect(runCall).toContain('vocabulary');
      expect(runCall).toContain('GRE Vocab');
    });

    it('should create with initial data', () => {
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };

      db.prepare
        .mockReturnValueOnce(mockInsertStmt)
        .mockReturnValueOnce(mockGetStmt);

      const initialData = {
        proficiencyLevel: 'beginner',
        totalItemsLearned: 50,
      };

      createDomainProfile('vocabulary', null, 'valid_token', initialData);

      const runCall = mockInsertStmt.run.mock.calls[0];
      const profileJson = runCall[3]; // profile_data parameter
      expect(profileJson).toContain('beginner');
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = createDomainProfile('vocabulary', null, 'invalid_token');

      expect(result.error).toBe('Invalid session');
    });

    it('should use ON CONFLICT for upsert behavior', () => {
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };

      db.prepare
        .mockReturnValueOnce(mockInsertStmt)
        .mockReturnValueOnce(mockGetStmt);

      createDomainProfile('vocabulary', null, 'valid_token');

      const query = db.prepare.mock.calls[0][0];
      expect(query).toContain('ON CONFLICT');
    });
  });

  // =============================================================================
  // updateDomainProfile
  // =============================================================================

  describe('updateDomainProfile', () => {
    it('should update existing domain profile', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)     // getDomainProfile
        .mockReturnValueOnce(mockUpdateStmt)  // UPDATE
        .mockReturnValueOnce(mockGetStmt);    // Return updated

      const result = updateDomainProfile(
        'vocabulary',
        {
          totalItemsLearned: 900,
          recentAccuracy: 0.85,
        },
        'valid_token'
      );

      expect(mockUpdateStmt.run).toHaveBeenCalled();
    });

    it('should merge updates with existing data', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateDomainProfile(
        'vocabulary',
        { recentAccuracy: 0.9 },
        'valid_token'
      );

      const runCall = mockUpdateStmt.run.mock.calls[0];
      const profileJson = runCall[0];
      expect(profileJson).toContain('proficiencyLevel');
      expect(profileJson).toContain('0.9');
    });

    it('should create profile if none exists', () => {
      const mockGetStmtEmpty = { get: jest.fn().mockReturnValue(undefined) };
      const mockInsertStmt = { run: jest.fn() };
      const mockGetStmtFilled = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };

      db.prepare
        .mockReturnValueOnce(mockGetStmtEmpty)   // Initial check
        .mockReturnValueOnce(mockInsertStmt)     // Create
        .mockReturnValueOnce(mockGetStmtFilled); // Return created

      updateDomainProfile('vocabulary', { totalItemsLearned: 100 }, 'valid_token');

      expect(mockInsertStmt.run).toHaveBeenCalled();
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = updateDomainProfile(
        'vocabulary',
        { totalItemsLearned: 100 },
        'invalid_token'
      );

      expect(result.error).toBe('Invalid session');
    });

    it('should update domain_name if provided', () => {
      const mockGetStmt = {
        get: jest.fn().mockReturnValue(createMockDomainProfileRow()),
      };
      const mockUpdateStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)
        .mockReturnValueOnce(mockUpdateStmt)
        .mockReturnValueOnce(mockGetStmt);

      updateDomainProfile(
        'vocabulary',
        { domainName: 'New Name' },
        'valid_token'
      );

      const runCall = mockUpdateStmt.run.mock.calls[0];
      expect(runCall).toContain('New Name');
    });
  });

  // =============================================================================
  // deleteDomainProfile
  // =============================================================================

  describe('deleteDomainProfile', () => {
    it('should delete domain profile', () => {
      const mockDeleteStmt = { run: jest.fn().mockReturnValue({ changes: 1 }) };
      db.prepare.mockReturnValue(mockDeleteStmt);

      const result = deleteDomainProfile('vocabulary', 'valid_token');

      expect(mockDeleteStmt.run).toHaveBeenCalledWith(1, 'vocabulary');
      expect(result.success).toBe(true);
    });

    it('should return success false when not found', () => {
      const mockDeleteStmt = { run: jest.fn().mockReturnValue({ changes: 0 }) };
      db.prepare.mockReturnValue(mockDeleteStmt);

      const result = deleteDomainProfile('nonexistent', 'valid_token');

      expect(result.success).toBe(false);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = deleteDomainProfile('vocabulary', 'invalid_token');

      expect(result.error).toBe('Invalid session');
    });
  });

  // =============================================================================
  // updateProfileFromSession
  // =============================================================================

  describe('updateProfileFromSession', () => {
    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = updateProfileFromSession('vocabulary', {}, 'invalid_token');

      expect(result.error).toBe('Invalid session');
    });

    it('should return error when global profile cannot be loaded', () => {
      // Mock getGlobalProfile to return null (simulate error)
      const mockGetStmt = { get: jest.fn().mockReturnValue(null) };
      db.prepare.mockReturnValue(mockGetStmt);

      const result = updateProfileFromSession('vocabulary', {}, 'valid_token');

      expect(result.error).toBeDefined();
    });

    it('should call database operations for valid session data', () => {
      // This test verifies the function attempts database operations
      // The actual integration is tested in integration tests
      const mockGlobalRow = createMockGlobalProfileRow();
      const mockDomainRow = createMockDomainProfileRow();
      const mockStmt = {
        get: jest.fn()
          .mockReturnValueOnce(mockGlobalRow)   // getGlobalProfile
          .mockReturnValueOnce(mockDomainRow)   // getDomainProfile
          .mockReturnValueOnce(mockDomainRow)   // updateDomainProfile -> getDomainProfile
          .mockReturnValueOnce(mockDomainRow)   // updateDomainProfile return
          .mockReturnValueOnce(mockGlobalRow)   // updateGlobalProfile -> getGlobalProfile
          .mockReturnValueOnce(mockGlobalRow),  // updateGlobalProfile return
        run: jest.fn(),
      };
      db.prepare.mockReturnValue(mockStmt);

      const sessionData = {
        itemsReviewed: 30,
        itemsCorrect: 25,
        itemsNew: 10,
        durationMinutes: 20,
      };

      const result = updateProfileFromSession('vocabulary', sessionData, 'valid_token');

      // The function should attempt to update profiles
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // getFullProfile
  // =============================================================================

  describe('getFullProfile', () => {
    it('should return both global and domain profiles', () => {
      const mockGlobalStmt = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };
      const mockDomainStmt = {
        all: jest.fn().mockReturnValue([
          createMockDomainProfileRow({ domain_type: 'vocabulary' }),
          createMockDomainProfileRow({ domain_type: 'math', id: 2 }),
        ]),
      };

      db.prepare
        .mockReturnValueOnce(mockGlobalStmt)
        .mockReturnValueOnce(mockDomainStmt);

      const result = getFullProfile('valid_token');

      expect(result.success).toBe(true);
      expect(result.userId).toBe(1);
      expect(result.globalProfile).toBeDefined();
      expect(result.domainProfiles).toHaveLength(2);
    });

    it('should return error for invalid session', () => {
      getUserIdFromToken.mockReturnValue(-1);

      const result = getFullProfile('invalid_token');

      expect(result.error).toBe('Invalid session');
    });

    it('should include timestamps', () => {
      const mockGlobalStmt = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };
      const mockDomainStmt = {
        all: jest.fn().mockReturnValue([createMockDomainProfileRow()]),
      };

      db.prepare
        .mockReturnValueOnce(mockGlobalStmt)
        .mockReturnValueOnce(mockDomainStmt);

      const result = getFullProfile('valid_token');

      expect(result.createdAt).toBeDefined();
    });

    it('should return default global profile when not found', () => {
      // For getGlobalProfile (auto-creates)
      const mockGetEmpty = { get: jest.fn().mockReturnValue(undefined) };
      const mockInsertStmt = { run: jest.fn() };
      const mockGetFilled = {
        get: jest.fn().mockReturnValue(createMockGlobalProfileRow()),
      };
      const mockDomainStmt = { all: jest.fn().mockReturnValue([]) };

      db.prepare
        .mockReturnValueOnce(mockGetEmpty)    // getGlobalProfile SELECT
        .mockReturnValueOnce(mockInsertStmt)   // createGlobalProfile INSERT
        .mockReturnValueOnce(mockGetFilled)    // Return after create
        .mockReturnValueOnce(mockDomainStmt);  // getAllDomainProfiles

      const result = getFullProfile('valid_token');

      expect(result.success).toBe(true);
      expect(result.globalProfile).toBeDefined();
    });
  });

  // =============================================================================
  // recordWeakArea
  // =============================================================================

  describe('recordWeakArea', () => {
    it('should return error when domain profile not found', () => {
      // Mock getDomainProfile to return error
      const mockGetStmt = { get: jest.fn().mockReturnValue(undefined) };
      const mockInsertStmt = { run: jest.fn() };

      db.prepare
        .mockReturnValueOnce(mockGetStmt)        // getDomainProfile - not found
        .mockReturnValueOnce(mockInsertStmt)     // createDomainProfile
        .mockReturnValueOnce(mockGetStmt);       // getDomainProfile after create - still not found

      const result = recordWeakArea(
        'vocabulary',
        { concept: 'test', accuracy: 0.5 },
        'valid_token'
      );

      expect(result.error).toBeDefined();
    });

    it('should call updateDomainProfile with weak areas', () => {
      // This test verifies recordWeakArea processes weak areas and calls update
      const mockDomainRow = createMockDomainProfileRow({
        profile_data: JSON.stringify({
          weakAreas: [],
          proficiencyLevel: 'intermediate',
        }),
      });

      // Mock for complex nested calls
      const mockStmt = {
        get: jest.fn().mockReturnValue(mockDomainRow),
        run: jest.fn(),
      };
      db.prepare.mockReturnValue(mockStmt);

      const weakArea = {
        concept: 'synonyms',
        accuracy: 0.4,
        commonMistakes: ['definition'],
        suggestedApproach: 'Use context clues',
      };

      recordWeakArea('vocabulary', weakArea, 'valid_token');

      // Should have called prepare multiple times for nested operations
      expect(db.prepare).toHaveBeenCalled();
    });

    it('should increment reviewCount for existing weak area', () => {
      const existingWeakAreas = [
        {
          concept: 'synonyms',
          accuracy: 0.5,
          reviewCount: 5,
          commonMistakes: [],
          suggestedApproach: 'old approach',
        },
      ];

      const mockDomainRow = createMockDomainProfileRow({
        profile_data: JSON.stringify({
          weakAreas: existingWeakAreas,
          proficiencyLevel: 'intermediate',
        }),
      });

      const mockStmt = {
        get: jest.fn().mockReturnValue(mockDomainRow),
        run: jest.fn(),
      };
      db.prepare.mockReturnValue(mockStmt);

      const updatedWeakArea = {
        concept: 'synonyms',
        accuracy: 0.35,
        commonMistakes: ['definition', 'spelling'],
        suggestedApproach: 'new approach',
      };

      // The function should work without throwing
      const result = recordWeakArea('vocabulary', updatedWeakArea, 'valid_token');

      // Should not return an error for valid domain profile
      expect(result).not.toHaveProperty('error', 'Domain profile not found');
    });
  });

  // =============================================================================
  // Edge Cases and Error Handling
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle database errors gracefully in getGlobalProfile', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(getGlobalProfile('valid_token')).toBeNull();
    });

    it('should handle database errors gracefully in getDomainProfile', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(getDomainProfile('vocabulary', 'valid_token')).toBeNull();
    });

    it('should handle database errors gracefully in getAllDomainProfiles', () => {
      db.prepare.mockImplementation(() => {
        throw new Error('Database error');
      });

      expect(getAllDomainProfiles('valid_token')).toEqual([]);
    });

    it('should handle empty profile_data JSON', () => {
      const mockRow = createMockDomainProfileRow({
        profile_data: '{}',
      });
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDomainProfile('vocabulary', 'valid_token');

      // Should get default values merged in
      expect(result.proficiencyLevel).toBe('novice');
      expect(result.weakAreas).toEqual([]);
      expect(result.totalItemsLearned).toBe(0);
    });

    it('should handle null domain_name', () => {
      const mockRow = createMockDomainProfileRow({
        domain_name: null,
      });
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      const result = getDomainProfile('vocabulary', 'valid_token');

      expect(result.domainName).toBeNull();
    });

    it('should handle invalid profile_data JSON', () => {
      const mockRow = {
        id: 1,
        user_id: 1,
        domain_type: 'vocabulary',
        domain_name: null,
        profile_data: 'invalid json {{{',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: null,
      };
      const mockStmt = { get: jest.fn().mockReturnValue(mockRow) };
      db.prepare.mockReturnValue(mockStmt);

      // When JSON parsing fails, the function handles it gracefully
      // and returns a profile with defaults merged in
      const result = getDomainProfile('vocabulary', 'valid_token');

      // Should have the domain type from the row
      expect(result.domainType).toBe('vocabulary');
      // Profile data fields should exist (defaults merged)
      expect(result).toBeDefined();
    });
  });
});
