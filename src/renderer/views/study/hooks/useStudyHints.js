/**
 * useStudyHints.js
 *
 * Custom hook for managing AI-powered hints with caching.
 * Provides progressive hint revelation and caching to avoid repeated AI calls.
 */

import { useState, useCallback, useRef } from 'react';
import studyEnhancementApi, { HINT_TYPES } from '../../../api/studyEnhancementApi';

// Hint progression order (constant, defined outside component to prevent re-creation)
const HINT_PROGRESSION = [
  HINT_TYPES.FIRST_LETTER,  // Level 1: First letter
  HINT_TYPES.CATEGORY,       // Level 2: Category/topic
  HINT_TYPES.CONTEXT,        // Level 3: Context hint
  HINT_TYPES.PARTIAL,        // Level 4: Partial answer
];

/**
 * Hook for managing hints for learning items
 *
 * @param {Object} options - Hook options
 * @param {boolean} options.useAI - Whether to use AI for hint generation (default: true)
 * @param {string} options.token - User token for API calls
 * @returns {Object} Hint management functions and state
 */
export default function useStudyHints({ useAI = true, token = null } = {}) {
  // Current hint state
  const [currentHint, setCurrentHint] = useState(null);
  const [hintLevel, setHintLevel] = useState(0); // 0 = no hint, 1-4 = progressive hints
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cache hints locally during session to avoid any IPC overhead
  const sessionCacheRef = useRef(new Map());

  /**
   * Get a hint for an item at a specific level
   * @param {Object} item - Learning item
   * @param {number} level - Hint level (1-4)
   * @returns {Promise<string>} Hint text
   */
  const getHintAtLevel = useCallback(async (item, level) => {
    if (!item || level < 1 || level > 4) return null;

    const hintType = HINT_PROGRESSION[level - 1];
    const cacheKey = `${item.id || item.front}_${hintType}`;

    // Check session cache first (instant, no IPC)
    if (sessionCacheRef.current.has(cacheKey)) {
      return sessionCacheRef.current.get(cacheKey);
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await studyEnhancementApi.getHint({
        item,
        hintType,
        useAI,
        token,
      });

      if (result.success && result.hint) {
        // Store in session cache
        sessionCacheRef.current.set(cacheKey, result.hint);
        return result.hint;
      } else {
        throw new Error(result.error || 'Failed to get hint');
      }
    } catch (err) {
      console.error('Error getting hint:', err);
      setError(err.message);
      // Return a basic fallback
      return `Hint: Think about ${item.tags?.[0] || 'the meaning'}...`;
    } finally {
      setIsLoading(false);
    }
  }, [useAI, token]);

  /**
   * Request the next hint level for an item
   * @param {Object} item - Learning item
   * @returns {Promise<string>} Hint text
   */
  const requestHint = useCallback(async (item) => {
    if (!item) return null;

    const nextLevel = Math.min(hintLevel + 1, 4);
    const hint = await getHintAtLevel(item, nextLevel);

    setHintLevel(nextLevel);
    setCurrentHint(hint);

    return hint;
  }, [hintLevel, getHintAtLevel]);

  /**
   * Request a specific type of hint
   * @param {Object} item - Learning item
   * @param {string} hintType - Hint type from HINT_TYPES
   * @returns {Promise<string>} Hint text
   */
  const requestSpecificHint = useCallback(async (item, hintType) => {
    if (!item) return null;

    const cacheKey = `${item.id || item.front}_${hintType}`;

    // Check session cache first
    if (sessionCacheRef.current.has(cacheKey)) {
      const hint = sessionCacheRef.current.get(cacheKey);
      setCurrentHint(hint);
      return hint;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await studyEnhancementApi.getHint({
        item,
        hintType,
        useAI,
        token,
      });

      if (result.success && result.hint) {
        sessionCacheRef.current.set(cacheKey, result.hint);
        setCurrentHint(result.hint);
        return result.hint;
      } else {
        throw new Error(result.error || 'Failed to get hint');
      }
    } catch (err) {
      console.error('Error getting specific hint:', err);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [useAI, token]);

  /**
   * Reset hint state for a new item
   */
  const resetHint = useCallback(() => {
    setCurrentHint(null);
    setHintLevel(0);
    setError(null);
  }, []);

  /**
   * Clear session cache (useful for fresh start)
   */
  const clearSessionCache = useCallback(() => {
    sessionCacheRef.current.clear();
  }, []);

  /**
   * Clear persistent cache (IPC call)
   */
  const clearPersistentCache = useCallback(async () => {
    try {
      const result = await studyEnhancementApi.clearHintCache(token);
      if (result.success) {
        sessionCacheRef.current.clear();
      }
      return result;
    } catch (err) {
      console.error('Error clearing cache:', err);
      return { success: false, error: err.message };
    }
  }, [token]);

  /**
   * Get hint availability info
   * @param {Object} item - Learning item
   * @returns {Object} Availability info
   */
  const getHintAvailability = useCallback((item) => {
    if (!item) return { available: false, levelsUsed: 0, maxLevels: 4 };

    return {
      available: hintLevel < 4,
      levelsUsed: hintLevel,
      maxLevels: 4,
      nextHintType: hintLevel < 4 ? HINT_PROGRESSION[hintLevel] : null,
      hasMoreHints: hintLevel < 4,
    };
  }, [hintLevel]);

  return {
    // State
    currentHint,
    hintLevel,
    isLoading,
    error,

    // Actions
    requestHint,
    requestSpecificHint,
    getHintAtLevel,
    resetHint,
    clearSessionCache,
    clearPersistentCache,

    // Info
    getHintAvailability,
    HINT_TYPES,
  };
}
