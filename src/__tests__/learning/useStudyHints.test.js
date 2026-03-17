/**
 * useStudyHints.test.js
 *
 * Unit tests for the useStudyHints React hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the API
const mockGetHint = jest.fn();
const mockClearHintCache = jest.fn();

jest.mock('../../../src/renderer/api/studyEnhancementApi', () => ({
  getHint: (...args) => mockGetHint(...args),
  clearHintCache: (...args) => mockClearHintCache(...args),
  HINT_TYPES: {
    FIRST_LETTER: 'first_letter',
    CATEGORY: 'category',
    ASSOCIATION: 'association',
    PARTIAL: 'partial',
    CONTEXT: 'context',
    WORD_COUNT: 'word_count',
  },
}));

// Import hook after mocks
import useStudyHints from '../../../src/renderer/views/study/hooks/useStudyHints';

describe('useStudyHints', () => {
  const mockItem = {
    id: 'item-1',
    front: 'ephemeral',
    back: 'lasting for a short time',
    tags: ['vocabulary'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHint.mockResolvedValue({
      success: true,
      hint: 'Test hint',
      fromCache: false,
    });
    mockClearHintCache.mockResolvedValue({ success: true });
  });

  describe('initial state', () => {
    it('should initialize with no hint', () => {
      const { result } = renderHook(() => useStudyHints());

      expect(result.current.currentHint).toBeNull();
      expect(result.current.hintLevel).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should accept token option', () => {
      const { result } = renderHook(() => useStudyHints({ token: 'test-token' }));

      expect(result.current).toBeDefined();
    });

    it('should accept useAI option', () => {
      const { result } = renderHook(() => useStudyHints({ useAI: false }));

      expect(result.current).toBeDefined();
    });
  });

  describe('requestHint', () => {
    it('should request progressive hints', async () => {
      const { result } = renderHook(() => useStudyHints());

      // First hint request (level 1: first_letter)
      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      expect(mockGetHint).toHaveBeenCalledWith(
        expect.objectContaining({
          item: mockItem,
          hintType: 'first_letter',
        })
      );
      expect(result.current.hintLevel).toBe(1);
      expect(result.current.currentHint).toBe('Test hint');
    });

    it('should progress through hint levels', async () => {
      const { result } = renderHook(() => useStudyHints());

      // Request 4 hints in sequence
      const expectedTypes = ['first_letter', 'category', 'context', 'partial'];

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.requestHint(mockItem);
        });

        expect(mockGetHint).toHaveBeenLastCalledWith(
          expect.objectContaining({
            hintType: expectedTypes[i],
          })
        );
        expect(result.current.hintLevel).toBe(i + 1);
      }
    });

    it('should not exceed max hint level', async () => {
      const { result } = renderHook(() => useStudyHints());

      // Request 5 hints (should cap at 4)
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await result.current.requestHint(mockItem);
        });
      }

      expect(result.current.hintLevel).toBe(4);
    });

    it('should return null for null item', async () => {
      const { result } = renderHook(() => useStudyHints());

      let hint;
      await act(async () => {
        hint = await result.current.requestHint(null);
      });

      expect(hint).toBeNull();
      expect(result.current.hintLevel).toBe(0);
    });

    it('should use session cache', async () => {
      const { result } = renderHook(() => useStudyHints());

      // First request
      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      // Reset and request same hint type through getHintAtLevel
      mockGetHint.mockClear();

      await act(async () => {
        await result.current.getHintAtLevel(mockItem, 1);
      });

      // Should NOT call API again - session cached
      expect(mockGetHint).not.toHaveBeenCalled();
    });
  });

  describe('requestSpecificHint', () => {
    it('should request a specific hint type', async () => {
      const { result } = renderHook(() => useStudyHints());

      await act(async () => {
        await result.current.requestSpecificHint(mockItem, 'association');
      });

      expect(mockGetHint).toHaveBeenCalledWith(
        expect.objectContaining({
          item: mockItem,
          hintType: 'association',
        })
      );
      expect(result.current.currentHint).toBe('Test hint');
    });

    it('should update currentHint', async () => {
      const { result } = renderHook(() => useStudyHints());

      mockGetHint.mockResolvedValue({
        success: true,
        hint: 'Specific association hint',
        fromCache: false,
      });

      await act(async () => {
        await result.current.requestSpecificHint(mockItem, 'association');
      });

      expect(result.current.currentHint).toBe('Specific association hint');
    });
  });

  describe('resetHint', () => {
    it('should reset hint state', async () => {
      const { result } = renderHook(() => useStudyHints());

      // Request a hint first
      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      expect(result.current.hintLevel).toBe(1);
      expect(result.current.currentHint).not.toBeNull();

      // Reset
      act(() => {
        result.current.resetHint();
      });

      expect(result.current.currentHint).toBeNull();
      expect(result.current.hintLevel).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe('clearSessionCache', () => {
    it('should clear session cache', async () => {
      const { result } = renderHook(() => useStudyHints());

      // Request hint to populate cache
      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      mockGetHint.mockClear();

      // Clear session cache
      act(() => {
        result.current.clearSessionCache();
      });

      // Now should call API again
      await act(async () => {
        await result.current.getHintAtLevel(mockItem, 1);
      });

      expect(mockGetHint).toHaveBeenCalled();
    });
  });

  describe('clearPersistentCache', () => {
    it('should call clear cache API', async () => {
      const { result } = renderHook(() => useStudyHints({ token: 'test-token' }));

      await act(async () => {
        await result.current.clearPersistentCache();
      });

      expect(mockClearHintCache).toHaveBeenCalledWith('test-token');
    });

    it('should clear session cache on success', async () => {
      const { result } = renderHook(() => useStudyHints());

      // Populate session cache
      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      mockGetHint.mockClear();
      mockClearHintCache.mockResolvedValue({ success: true });

      // Clear persistent cache
      await act(async () => {
        await result.current.clearPersistentCache();
      });

      // Session cache should also be cleared
      await act(async () => {
        await result.current.getHintAtLevel(mockItem, 1);
      });

      expect(mockGetHint).toHaveBeenCalled();
    });
  });

  describe('getHintAvailability', () => {
    it('should return availability info', () => {
      const { result } = renderHook(() => useStudyHints());

      const availability = result.current.getHintAvailability(mockItem);

      expect(availability.available).toBe(true);
      expect(availability.levelsUsed).toBe(0);
      expect(availability.maxLevels).toBe(4);
      expect(availability.hasMoreHints).toBe(true);
    });

    it('should update after requesting hints', async () => {
      const { result } = renderHook(() => useStudyHints());

      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      const availability = result.current.getHintAvailability(mockItem);

      expect(availability.levelsUsed).toBe(1);
      expect(availability.available).toBe(true);
    });

    it('should show unavailable when max hints reached', async () => {
      const { result } = renderHook(() => useStudyHints());

      // Request 4 hints
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await result.current.requestHint(mockItem);
        });
      }

      const availability = result.current.getHintAvailability(mockItem);

      expect(availability.available).toBe(false);
      expect(availability.levelsUsed).toBe(4);
      expect(availability.hasMoreHints).toBe(false);
    });

    it('should handle null item', () => {
      const { result } = renderHook(() => useStudyHints());

      const availability = result.current.getHintAvailability(null);

      expect(availability.available).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should set error state on API failure', async () => {
      mockGetHint.mockResolvedValue({
        success: false,
        error: 'API error',
        hint: 'Fallback hint',
      });

      const { result } = renderHook(() => useStudyHints());

      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      expect(result.current.error).toBe('API error');
    });

    it('should handle network errors', async () => {
      mockGetHint.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useStudyHints());

      await act(async () => {
        await result.current.requestHint(mockItem);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('loading state', () => {
    it('should set loading during hint request', async () => {
      let resolveHint;
      mockGetHint.mockImplementation(() => new Promise(resolve => {
        resolveHint = resolve;
      }));

      const { result } = renderHook(() => useStudyHints());

      // Start request
      let requestPromise;
      act(() => {
        requestPromise = result.current.requestHint(mockItem);
      });

      expect(result.current.isLoading).toBe(true);

      // Resolve
      await act(async () => {
        resolveHint({ success: true, hint: 'Test' });
        await requestPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('HINT_TYPES constant', () => {
    it('should export HINT_TYPES', () => {
      const { result } = renderHook(() => useStudyHints());

      expect(result.current.HINT_TYPES).toBeDefined();
      expect(result.current.HINT_TYPES.FIRST_LETTER).toBe('first_letter');
      expect(result.current.HINT_TYPES.ASSOCIATION).toBe('association');
    });
  });
});
