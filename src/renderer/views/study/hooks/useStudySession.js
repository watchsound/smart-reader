/**
 * useStudySession.js
 *
 * Custom hook for managing study session state and logic.
 * Handles session flow, timing, progress tracking, and spaced repetition.
 *
 * Supports both legacy (learningPlanApi) and unified (unifiedLearningApi) modes.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import learningPlanApi from '../../../api/learningPlanApi';
import unifiedLearningApi, { ITEM_TYPES, RATINGS as UNIFIED_RATINGS } from '../../../api/unifiedLearningApi';

// Rating constants
export const RATINGS = {
  AGAIN: 1,  // Forgot - reset to box 1
  HARD: 2,   // Hard - stay in box, shorter interval
  GOOD: 3,   // Good - advance to next box
  EASY: 4,   // Easy - skip a box
};

// Session modes
export const SESSION_MODES = {
  STANDARD: 'standard',   // All due items
  QUICK: 'quick',         // 5-10 min burst
  FOCUSED: 'focused',     // Single topic/tag
  CRAM: 'cram',           // All items regardless of schedule
  CUSTOM: 'custom',       // User-defined
};

// Initial session state
const createInitialState = (planId) => ({
  planId,
  sessionId: null,
  startedAt: null,

  // Items
  items: [],
  currentIndex: 0,

  // Answers
  answers: [],

  // Session stats
  elapsedTime: 0,
  isPaused: false,
  streak: 0,
  bestStreak: 0,

  // Loading/error states
  isLoading: true,
  error: null,
});

/**
 * Custom hook for study session management
 *
 * @param {Object} options
 * @param {string} options.planId - Plan ID or 'all' for all items
 * @param {string} options.mode - Session mode (STANDARD, QUICK, etc.)
 * @param {string} options.date - Date for due items check
 * @param {string[]} options.tags - Filter by tags
 * @param {number|null} options.maxItems - Max items to load
 * @param {number|null} options.maxMinutes - Max session duration
 * @param {string} options.token - User authentication token
 * @param {boolean} options.useUnifiedApi - Use unified learning API (default: false)
 * @param {string[]} options.itemTypes - Item types filter for unified API (default: ['all'])
 */
export default function useStudySession({
  planId,
  mode = SESSION_MODES.STANDARD,
  date = new Date().toISOString().split('T')[0],
  tags = [],
  maxItems = null,
  maxMinutes = null,
  token = null,
  useUnifiedApi = false,
  itemTypes = [ITEM_TYPES.ALL],
}) {
  // Session state
  const [session, setSession] = useState(() => createInitialState(planId));

  // Timer ref
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Current item
  const currentItem = useMemo(() => {
    return session.items[session.currentIndex] || null;
  }, [session.items, session.currentIndex]);

  // Progress calculations
  const progress = useMemo(() => {
    if (session.items.length === 0) return 0;
    return Math.round((session.answers.length / session.items.length) * 100);
  }, [session.answers.length, session.items.length]);

  const accuracy = useMemo(() => {
    if (session.answers.length === 0) return 0;
    const correct = session.answers.filter(a => a.rating >= RATINGS.GOOD).length;
    return Math.round((correct / session.answers.length) * 100);
  }, [session.answers]);

  const timeRemaining = useMemo(() => {
    if (!maxMinutes) return null;
    const maxSeconds = maxMinutes * 60;
    return Math.max(0, maxSeconds - session.elapsedTime);
  }, [maxMinutes, session.elapsedTime]);

  // Is session complete?
  const isComplete = useMemo(() => {
    if (session.items.length === 0 && !session.isLoading) return false;
    if (timeRemaining !== null && timeRemaining <= 0) return true;
    return session.currentIndex >= session.items.length && session.items.length > 0;
  }, [session.currentIndex, session.items.length, session.isLoading, timeRemaining]);

  // Start timer
  const startTimer = useCallback(() => {
    if (timerRef.current) return;

    startTimeRef.current = Date.now() - (session.elapsedTime * 1000);

    timerRef.current = setInterval(() => {
      setSession(prev => ({
        ...prev,
        elapsedTime: Math.floor((Date.now() - startTimeRef.current) / 1000),
      }));
    }, 1000);
  }, [session.elapsedTime]);

  // Stop timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Load session items
  const startSession = useCallback(async () => {
    setSession(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Determine limit based on mode
      let limit = maxItems;
      if (!limit) {
        switch (mode) {
          case SESSION_MODES.QUICK:
            limit = 15; // ~5-10 min
            break;
          case SESSION_MODES.STANDARD:
          case SESSION_MODES.CRAM:
          default:
            limit = 50; // Default batch
        }
      }

      let items = [];

      // Check if unified API should be used
      if (useUnifiedApi) {
        try {
          const isAvailable = unifiedLearningApi.isAvailable();
          if (isAvailable) {
            // Use unified API for all content types
            const result = await unifiedLearningApi.getDueItems({
              token,
              date,
              limit,
              itemTypes,
              tags: tags.length > 0 ? tags : null,
              planId: planId !== 'all' ? planId : null,
            });

            items = result.data || [];

            // Transform unified items to session format
            items = items.map(item => ({
              ...item,
              // Ensure required fields are present
              id: item.id,
              front: typeof item.front === 'string' ? item.front : item.front?.text || '',
              back: typeof item.back === 'string' ? item.back : item.back?.text || '',
              box: item.box || 1,
              tags: item.tags || [],
              // Keep unified metadata
              sourceType: item.sourceType,
              sourceId: item.sourceId,
              itemType: item.itemType,
              domainType: item.domainType,
              extras: item.extras,
              isUnified: true,
            }));
          } else {
            console.warn('Unified API not available, falling back to legacy');
          }
        } catch (unifiedErr) {
          console.warn('Unified API failed, falling back to legacy:', unifiedErr);
        }
      }

      // Fallback to legacy API if unified didn't work or wasn't used
      if (items.length === 0) {
        const result = await learningPlanApi.getDueItems({
          planId,
          date,
          mode,
          limit,
          tags: tags.length > 0 ? tags : undefined,
          token,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to load items');
        }

        items = result.items || [];
      }

      // Start session tracking
      const sessionResult = await learningPlanApi.startSession({
        planId,
        mode,
        itemCount: items.length,
        token,
      });

      setSession(prev => ({
        ...prev,
        sessionId: sessionResult.sessionId || `session_${Date.now()}`,
        startedAt: new Date(),
        items,
        currentIndex: 0,
        answers: [],
        elapsedTime: 0,
        isPaused: false,
        streak: 0,
        bestStreak: 0,
        isLoading: false,
        error: null,
        useUnifiedApi, // Track which mode we're using
      }));

      // Start timer
      startTimer();

    } catch (err) {
      console.error('Error starting session:', err);
      setSession(prev => ({
        ...prev,
        isLoading: false,
        error: err.message,
      }));
    }
  }, [planId, mode, date, tags, maxItems, startTimer, token, useUnifiedApi, itemTypes]);

  // Rate current answer
  const rateAnswer = useCallback(async (rating) => {
    if (!currentItem || session.isPaused) return;

    const responseTime = Date.now() - (session.startedAt?.getTime() || Date.now());

    // Create answer record
    const answer = {
      pointId: currentItem.id,
      rating,
      responseTime,
      timestamp: new Date(),
    };

    // Update streak
    const isCorrect = rating >= RATINGS.GOOD;
    const newStreak = isCorrect ? session.streak + 1 : 0;
    const newBestStreak = Math.max(session.bestStreak, newStreak);

    // Use unified API if item was loaded via unified API
    if (currentItem.isUnified && currentItem.id) {
      unifiedLearningApi.processReview({
        itemId: currentItem.id,
        rating,
        responseTime,
        token,
      }).catch(err => console.error('Error recording unified review:', err));
    } else {
      // Record review via legacy API (fire and forget for responsiveness)
      learningPlanApi.recordReview({
        planId,
        sessionId: session.sessionId,
        pointId: currentItem.id,
        rating,
        responseTime,
        correct: rating >= RATINGS.GOOD,
        token,
      }).catch(err => console.error('Error recording review:', err));
    }

    // Update state
    setSession(prev => ({
      ...prev,
      answers: [...prev.answers, answer],
      currentIndex: prev.currentIndex + 1,
      streak: newStreak,
      bestStreak: newBestStreak,
    }));
  }, [currentItem, session.isPaused, session.startedAt, session.sessionId, session.streak, session.bestStreak, planId, token]);

  // Skip current item
  const skipItem = useCallback(() => {
    if (!currentItem || session.isPaused) return;

    // Move to next without recording
    setSession(prev => ({
      ...prev,
      currentIndex: prev.currentIndex + 1,
    }));
  }, [currentItem, session.isPaused]);

  // Pause session
  const pauseSession = useCallback(() => {
    stopTimer();
    setSession(prev => ({ ...prev, isPaused: true }));
  }, [stopTimer]);

  // Resume session
  const resumeSession = useCallback(() => {
    setSession(prev => ({ ...prev, isPaused: false }));
    startTimer();
  }, [startTimer]);

  // End session
  const endSession = useCallback(async () => {
    stopTimer();

    // Calculate final stats
    const stats = {
      itemsReviewed: session.answers.length,
      correctCount: session.answers.filter(a => a.rating >= RATINGS.GOOD).length,
      duration: session.elapsedTime,
      avgRating: session.answers.length > 0
        ? session.answers.reduce((sum, a) => sum + a.rating, 0) / session.answers.length
        : 0,
    };

    // Record session completion
    try {
      await learningPlanApi.completeSession({
        planId,
        sessionId: session.sessionId,
        stats,
        token,
      });
    } catch (err) {
      console.error('Error completing session:', err);
    }

    return stats;
  }, [session.answers, session.elapsedTime, session.sessionId, planId, stopTimer, token]);

  // Reset session
  const resetSession = useCallback(() => {
    stopTimer();
    setSession(createInitialState(planId));
  }, [planId, stopTimer]);

  // Get hint for current item (placeholder - can integrate with AI)
  const getHint = useCallback(() => {
    if (!currentItem) return null;
    // Return first few characters of back or tags
    const back = currentItem.back || '';
    if (back.length > 20) {
      return back.substring(0, 3) + '...';
    }
    return currentItem.tags?.[0] || 'Think about it...';
  }, [currentItem]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  // Session summary stats
  const summary = useMemo(() => {
    if (session.answers.length === 0) return null;

    const ratingCounts = {
      again: session.answers.filter(a => a.rating === RATINGS.AGAIN).length,
      hard: session.answers.filter(a => a.rating === RATINGS.HARD).length,
      good: session.answers.filter(a => a.rating === RATINGS.GOOD).length,
      easy: session.answers.filter(a => a.rating === RATINGS.EASY).length,
    };

    const avgResponseTime = session.answers.reduce((sum, a) => sum + a.responseTime, 0) / session.answers.length;

    return {
      itemsReviewed: session.answers.length,
      totalItems: session.items.length,
      accuracy,
      duration: session.elapsedTime,
      bestStreak: session.bestStreak,
      avgResponseTime,
      ratingCounts,
    };
  }, [session.answers, session.items.length, session.elapsedTime, session.bestStreak, accuracy]);

  return {
    // State
    session,
    currentItem,
    isLoading: session.isLoading,
    error: session.error,
    isComplete,

    // Actions
    startSession,
    rateAnswer,
    skipItem,
    pauseSession,
    resumeSession,
    endSession,
    resetSession,

    // Utils
    getHint,

    // Computed
    progress,
    accuracy,
    timeRemaining,
    summary,
  };
}
