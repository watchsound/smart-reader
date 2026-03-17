/**
 * useStudySession.test.js
 *
 * Unit tests for the useStudySession React hook.
 * Tests session state management, timer logic, rating calculations, and API interactions.
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the learningPlanApi
const mockGetDueItems = jest.fn();
const mockStartSession = jest.fn();
const mockRecordReview = jest.fn();
const mockCompleteSession = jest.fn();

jest.mock('../../renderer/api/learningPlanApi', () => ({
  __esModule: true,
  default: {
    getDueItems: (...args) => mockGetDueItems(...args),
    startSession: (...args) => mockStartSession(...args),
    recordReview: (...args) => mockRecordReview(...args),
    completeSession: (...args) => mockCompleteSession(...args),
  },
}));

// Import after mocking
import useStudySession, {
  RATINGS,
  SESSION_MODES,
} from '../../renderer/views/study/hooks/useStudySession';

describe('useStudySession', () => {
  // Sample test items
  const mockItems = [
    {
      id: 'item_1',
      front: 'What is React?',
      back: 'A JavaScript library for building user interfaces',
      box: 1,
      tags: ['programming', 'javascript'],
    },
    {
      id: 'item_2',
      front: 'What is useState?',
      back: 'A React hook for state management',
      box: 2,
      tags: ['react', 'hooks'],
    },
    {
      id: 'item_3',
      front: 'What is useEffect?',
      back: 'A React hook for side effects',
      box: 1,
      tags: ['react', 'hooks'],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Default mock implementations
    mockGetDueItems.mockResolvedValue({
      success: true,
      items: mockItems,
    });

    mockStartSession.mockResolvedValue({
      success: true,
      sessionId: 'session_test_123',
    });

    mockRecordReview.mockResolvedValue({
      success: true,
    });

    mockCompleteSession.mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // =============================================================================
  // Constants Tests
  // =============================================================================

  describe('Constants', () => {
    it('should export correct RATINGS values', () => {
      expect(RATINGS.AGAIN).toBe(1);
      expect(RATINGS.HARD).toBe(2);
      expect(RATINGS.GOOD).toBe(3);
      expect(RATINGS.EASY).toBe(4);
    });

    it('should export correct SESSION_MODES values', () => {
      expect(SESSION_MODES.STANDARD).toBe('standard');
      expect(SESSION_MODES.QUICK).toBe('quick');
      expect(SESSION_MODES.FOCUSED).toBe('focused');
      expect(SESSION_MODES.CRAM).toBe('cram');
      expect(SESSION_MODES.CUSTOM).toBe('custom');
    });
  });

  // =============================================================================
  // Initial State Tests
  // =============================================================================

  describe('Initial State', () => {
    it('should initialize with loading state', () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.currentItem).toBeNull();
    });

    it('should have default values for computed properties', () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      expect(result.current.progress).toBe(0);
      expect(result.current.accuracy).toBe(0);
      expect(result.current.timeRemaining).toBeNull();
    });

    it('should use provided session parameters', () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          mode: SESSION_MODES.QUICK,
          date: '2024-01-15',
          tags: ['react'],
          maxItems: 10,
          maxMinutes: 5,
          token: 'valid_token',
        })
      );

      expect(result.current.session.planId).toBe('plan_123');
    });
  });

  // =============================================================================
  // Session Start Tests
  // =============================================================================

  describe('startSession', () => {
    it('should load items and start session', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(mockGetDueItems).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      expect(mockStartSession).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'plan_123',
          itemCount: 3,
          token: 'valid_token',
        })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.session.items).toHaveLength(3);
      expect(result.current.currentItem).toEqual(mockItems[0]);
    });

    it('should apply limit based on mode - QUICK', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          mode: SESSION_MODES.QUICK,
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(mockGetDueItems).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 15, // Quick mode limit
        })
      );
    });

    it('should use custom maxItems when provided', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          maxItems: 25,
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(mockGetDueItems).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
        })
      );
    });

    it('should handle API error', async () => {
      mockGetDueItems.mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle exception during start', async () => {
      mockGetDueItems.mockRejectedValue(new Error('Connection failed'));

      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.error).toBe('Connection failed');
    });

    it('should start timer after loading items', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.session.elapsedTime).toBe(0);

      // Advance timer
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.session.elapsedTime).toBe(5);
    });
  });

  // =============================================================================
  // Rating Tests
  // =============================================================================

  describe('rateAnswer', () => {
    it('should record answer and advance to next item', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.session.currentIndex).toBe(0);

      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      expect(result.current.session.currentIndex).toBe(1);
      expect(result.current.session.answers).toHaveLength(1);
      expect(result.current.currentItem).toEqual(mockItems[1]);
    });

    it('should call recordReview API', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      expect(mockRecordReview).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'plan_123',
          pointId: 'item_1',
          rating: RATINGS.GOOD,
          correct: true,
          token: 'valid_token',
        })
      );
    });

    it('should update streak for correct answers', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Rate GOOD (correct)
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });
      expect(result.current.session.streak).toBe(1);

      // Rate EASY (correct)
      await act(async () => {
        result.current.rateAnswer(RATINGS.EASY);
      });
      expect(result.current.session.streak).toBe(2);

      // Rate AGAIN (incorrect - resets streak)
      await act(async () => {
        result.current.rateAnswer(RATINGS.AGAIN);
      });
      expect(result.current.session.streak).toBe(0);
    });

    it('should track best streak', async () => {
      // Add more items for testing - set up before rendering hook
      mockGetDueItems.mockResolvedValue({
        success: true,
        items: [...mockItems, ...mockItems], // 6 items
      });

      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Build streak of 3 - rate one at a time to ensure state updates
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      expect(result.current.session.bestStreak).toBe(3);

      // Break streak
      await act(async () => {
        result.current.rateAnswer(RATINGS.AGAIN);
      });

      expect(result.current.session.streak).toBe(0);
      expect(result.current.session.bestStreak).toBe(3); // Best streak preserved
    });

    it('should not rate when paused', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      act(() => {
        result.current.pauseSession();
      });

      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      expect(result.current.session.answers).toHaveLength(0);
      expect(result.current.session.currentIndex).toBe(0);
    });

    it('should not rate without current item', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      // Don't start session, so no items loaded
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      expect(mockRecordReview).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Progress and Accuracy Tests
  // =============================================================================

  describe('Progress and Accuracy', () => {
    it('should calculate progress correctly', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.progress).toBe(0);

      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      // 1 out of 3 = 33%
      expect(result.current.progress).toBe(33);

      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      // 2 out of 3 = 67%
      expect(result.current.progress).toBe(67);
    });

    it('should calculate accuracy correctly', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Rate GOOD (correct)
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      // 100% accuracy (1/1 correct)
      expect(result.current.accuracy).toBe(100);

      // Rate AGAIN (incorrect)
      await act(async () => {
        result.current.rateAnswer(RATINGS.AGAIN);
      });

      // 50% accuracy (1/2 correct)
      expect(result.current.accuracy).toBe(50);

      // Rate EASY (correct)
      await act(async () => {
        result.current.rateAnswer(RATINGS.EASY);
      });

      // 67% accuracy (2/3 correct)
      expect(result.current.accuracy).toBe(67);
    });

    it('should return 0 accuracy with no answers', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.accuracy).toBe(0);
    });
  });

  // =============================================================================
  // Time Remaining Tests
  // =============================================================================

  describe('Time Remaining', () => {
    it('should calculate time remaining when maxMinutes set', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          maxMinutes: 5,
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // 5 minutes = 300 seconds
      expect(result.current.timeRemaining).toBe(300);

      // Advance 60 seconds
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(result.current.timeRemaining).toBe(240);
    });

    it('should return null when no maxMinutes', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.timeRemaining).toBeNull();
    });

    it('should not go below zero', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          maxMinutes: 1,
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Advance past the time limit
      act(() => {
        jest.advanceTimersByTime(120000); // 2 minutes
      });

      expect(result.current.timeRemaining).toBe(0);
    });
  });

  // =============================================================================
  // Skip Item Tests
  // =============================================================================

  describe('skipItem', () => {
    it('should advance without recording', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      act(() => {
        result.current.skipItem();
      });

      expect(result.current.session.currentIndex).toBe(1);
      expect(result.current.session.answers).toHaveLength(0);
      expect(mockRecordReview).not.toHaveBeenCalled();
    });

    it('should not skip when paused', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      act(() => {
        result.current.pauseSession();
      });

      act(() => {
        result.current.skipItem();
      });

      expect(result.current.session.currentIndex).toBe(0);
    });
  });

  // =============================================================================
  // Pause/Resume Tests
  // =============================================================================

  describe('Pause and Resume', () => {
    it('should pause session and stop timer', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Let timer run for 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(result.current.session.elapsedTime).toBe(3);

      // Pause
      act(() => {
        result.current.pauseSession();
      });

      expect(result.current.session.isPaused).toBe(true);

      // Try to advance timer - should not increase
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(result.current.session.elapsedTime).toBe(3);
    });

    it('should resume session and restart timer', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Pause at 3 seconds
      act(() => {
        jest.advanceTimersByTime(3000);
        result.current.pauseSession();
      });

      // Resume
      act(() => {
        result.current.resumeSession();
      });

      expect(result.current.session.isPaused).toBe(false);

      // Timer should continue from where it left off
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      expect(result.current.session.elapsedTime).toBe(5);
    });
  });

  // =============================================================================
  // End Session Tests
  // =============================================================================

  describe('endSession', () => {
    it('should complete session and return stats', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Answer some items
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
        result.current.rateAnswer(RATINGS.HARD);
        result.current.rateAnswer(RATINGS.EASY);
      });

      // Run timer for 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      let stats;
      await act(async () => {
        stats = await result.current.endSession();
      });

      expect(stats.itemsReviewed).toBe(3);
      expect(stats.correctCount).toBe(2); // GOOD and EASY
      expect(stats.duration).toBe(30);
      expect(stats.avgRating).toBeCloseTo((3 + 2 + 4) / 3);

      expect(mockCompleteSession).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'plan_123',
          sessionId: 'session_test_123',
          token: 'valid_token',
        })
      );
    });

    it('should stop timer when ending session', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      await act(async () => {
        await result.current.endSession();
      });

      const timeAfterEnd = result.current.session.elapsedTime;

      // Try to advance timer
      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Time should not have changed
      expect(result.current.session.elapsedTime).toBe(timeAfterEnd);
    });

    it('should handle API errors gracefully', async () => {
      mockCompleteSession.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Should not throw
      await act(async () => {
        const stats = await result.current.endSession();
        expect(stats).toBeDefined();
      });
    });
  });

  // =============================================================================
  // Reset Session Tests
  // =============================================================================

  describe('resetSession', () => {
    it('should reset to initial state', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Make some progress
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
      });

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      // Reset
      act(() => {
        result.current.resetSession();
      });

      expect(result.current.session.items).toHaveLength(0);
      expect(result.current.session.answers).toHaveLength(0);
      expect(result.current.session.currentIndex).toBe(0);
      expect(result.current.session.elapsedTime).toBe(0);
      expect(result.current.session.streak).toBe(0);
    });
  });

  // =============================================================================
  // Hint Tests
  // =============================================================================

  describe('getHint', () => {
    it('should return hint for current item', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      const hint = result.current.getHint();

      // Should return first 3 chars + '...' for long backs
      expect(hint).toBeDefined();
    });

    it('should return null without current item', () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      const hint = result.current.getHint();

      expect(hint).toBeNull();
    });
  });

  // =============================================================================
  // Session Completion Detection Tests
  // =============================================================================

  describe('isComplete', () => {
    it('should be true when all items answered', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.isComplete).toBe(false);

      // Answer all items
      await act(async () => {
        result.current.rateAnswer(RATINGS.GOOD);
        result.current.rateAnswer(RATINGS.GOOD);
        result.current.rateAnswer(RATINGS.GOOD);
      });

      expect(result.current.isComplete).toBe(true);
    });

    it('should be true when time runs out', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          maxMinutes: 1,
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.isComplete).toBe(false);

      // Run past time limit
      act(() => {
        jest.advanceTimersByTime(65000); // 65 seconds
      });

      expect(result.current.isComplete).toBe(true);
    });

    it('should be false when no items loaded', async () => {
      mockGetDueItems.mockResolvedValue({
        success: true,
        items: [],
      });

      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Empty session is not "complete", it's empty
      expect(result.current.isComplete).toBe(false);
    });
  });

  // =============================================================================
  // Summary Tests
  // =============================================================================

  describe('summary', () => {
    it('should provide session summary', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Answer items with different ratings
      await act(async () => {
        result.current.rateAnswer(RATINGS.AGAIN); // incorrect
        result.current.rateAnswer(RATINGS.HARD); // incorrect
        result.current.rateAnswer(RATINGS.GOOD); // correct
      });

      const summary = result.current.summary;

      expect(summary).toBeDefined();
      expect(summary.itemsReviewed).toBe(3);
      expect(summary.totalItems).toBe(3);
      expect(summary.accuracy).toBe(33); // 1 out of 3 correct
      expect(summary.ratingCounts.again).toBe(1);
      expect(summary.ratingCounts.hard).toBe(1);
      expect(summary.ratingCounts.good).toBe(1);
      expect(summary.ratingCounts.easy).toBe(0);
    });

    it('should return null with no answers', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.summary).toBeNull();
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe('Edge Cases', () => {
    it('should handle empty items array', async () => {
      mockGetDueItems.mockResolvedValue({
        success: true,
        items: [],
      });

      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      expect(result.current.session.items).toHaveLength(0);
      expect(result.current.currentItem).toBeNull();
      expect(result.current.progress).toBe(0);
    });

    it('should cleanup timer on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      await act(async () => {
        await result.current.startSession();
      });

      // Unmount should not cause errors
      unmount();

      // Advancing timers after unmount should not cause errors
      act(() => {
        jest.advanceTimersByTime(10000);
      });
    });

    it('should handle rapid rating', async () => {
      const { result } = renderHook(() =>
        useStudySession({
          planId: 'plan_123',
          token: 'valid_token',
        })
      );

      mockGetDueItems.mockResolvedValue({
        success: true,
        items: Array.from({ length: 10 }, (_, i) => ({
          id: `item_${i}`,
          front: `Question ${i}`,
          back: `Answer ${i}`,
          box: 1,
        })),
      });

      await act(async () => {
        await result.current.startSession();
      });

      // Rapid fire ratings
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          result.current.rateAnswer(RATINGS.GOOD);
        }
      });

      expect(result.current.session.answers).toHaveLength(5);
      expect(result.current.session.currentIndex).toBe(5);
    });
  });
});
