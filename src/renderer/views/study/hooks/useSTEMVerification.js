/**
 * useSTEMVerification.js
 *
 * React hook for STEM answer verification using LLM.
 * Manages verification state, caching, and UI feedback.
 */

import { useState, useCallback, useMemo } from 'react';
import skillApi from '../../../api/skillApi';

/**
 * Default verification result structure
 */
const DEFAULT_RESULT = {
  correct: null,
  confidence: 0,
  partialCredit: 0,
  explanation: '',
  feedback: '',
  errors: [],
  suggestedHint: null,
  conceptsApplied: [],
  conceptsMissing: [],
};

/**
 * Map verification result to Leitner rating
 * @param {Object} result - Verification result
 * @returns {number} Rating 1-4 (AGAIN, HARD, GOOD, EASY)
 */
export const mapResultToRating = (result) => {
  if (!result || result.correct === null) return null;

  // Easy (4): Correct with high confidence
  if (result.correct && result.confidence >= 0.8) {
    return 4;
  }

  // Good (3): Correct with moderate confidence or high partial credit
  if (result.correct || result.partialCredit >= 80) {
    return 3;
  }

  // Hard (2): Partial credit (50-79%)
  if (result.partialCredit >= 50) {
    return 2;
  }

  // Again (1): Incorrect or low partial credit
  return 1;
};

/**
 * Get rating label from rating number
 */
export const getRatingLabel = (rating) => {
  const labels = {
    1: 'Again',
    2: 'Hard',
    3: 'Good',
    4: 'Easy',
  };
  return labels[rating] || 'Unknown';
};

/**
 * Get rating color from rating number
 */
export const getRatingColor = (rating) => {
  const colors = {
    1: '#F44336', // Red
    2: '#FF9800', // Orange
    3: '#4CAF50', // Green
    4: '#2196F3', // Blue
  };
  return colors[rating] || '#9E9E9E';
};

/**
 * Custom hook for STEM answer verification
 *
 * @param {Object} options
 * @param {string} options.token - User authentication token
 * @param {boolean} options.autoSuggestRating - Automatically suggest rating after verification
 * @returns {Object} Hook state and methods
 */
export default function useSTEMVerification({
  token = null,
  autoSuggestRating = true,
} = {}) {
  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(DEFAULT_RESULT);
  const [error, setError] = useState(null);

  // Answer state
  const [answer, setAnswer] = useState('');
  const [showSolution, setShowSolution] = useState(false);
  const [currentSolutionStep, setCurrentSolutionStep] = useState(0);

  // Suggested rating based on verification
  const suggestedRating = useMemo(() => {
    if (!autoSuggestRating) return null;
    return mapResultToRating(verificationResult);
  }, [verificationResult, autoSuggestRating]);

  /**
   * Verify an answer using the LLM skill
   *
   * @param {Object} item - The learning item being studied
   * @param {string} studentAnswer - The student's answer (optional, uses state if not provided)
   * @returns {Promise<Object>} Verification result
   */
  const verifyAnswer = useCallback(
    async (item, studentAnswer = null) => {
      const answerToVerify = studentAnswer || answer;

      if (!answerToVerify?.trim()) {
        setError('Please enter an answer');
        return { success: false, error: 'No answer provided' };
      }

      setIsVerifying(true);
      setError(null);

      try {
        // Extract item details
        const problem = typeof item.front === 'string' ? item.front : item.front?.text || '';
        const correctAnswer = typeof item.back === 'string' ? item.back : item.back?.text || '';

        // Call the skill API
        const result = await skillApi.executeSkill('verify_answer', {
          problem,
          studentAnswer: answerToVerify,
          correctAnswer,
          domain: item.domainType || 'general',
          itemType: item.itemType || 'problem',
          variables: item.extras?.variables || null,
          solution: item.extras?.solution || null,
          token,
        });

        if (result.success) {
          setVerificationResult({
            correct: result.correct,
            confidence: result.confidence || 0,
            partialCredit: result.partialCredit || 0,
            explanation: result.explanation || '',
            feedback: result.feedback || '',
            errors: result.errors || [],
            suggestedHint: result.suggestedHint || null,
            conceptsApplied: result.conceptsApplied || [],
            conceptsMissing: result.conceptsMissing || [],
          });
          return result;
        }
        setError(result.error || 'Verification failed');
        return result;
      } catch (err) {
        console.error('STEM verification error:', err);
        setError(err.message || 'Verification failed');
        return { success: false, error: err.message };
      } finally {
        setIsVerifying(false);
      }
    },
    [answer, token],
  );

  /**
   * Clear verification result and reset state
   */
  const clearVerification = useCallback(() => {
    setVerificationResult(DEFAULT_RESULT);
    setError(null);
  }, []);

  /**
   * Reset all state for a new item
   */
  const resetForNewItem = useCallback(() => {
    setAnswer('');
    setVerificationResult(DEFAULT_RESULT);
    setError(null);
    setShowSolution(false);
    setCurrentSolutionStep(0);
  }, []);

  /**
   * Handle answer input change
   */
  const handleAnswerChange = useCallback((value) => {
    setAnswer(value);
    // Clear previous verification when answer changes
    setVerificationResult(DEFAULT_RESULT);
    setError(null);
  }, []);

  /**
   * Reveal next solution step
   */
  const revealNextStep = useCallback(() => {
    setCurrentSolutionStep((prev) => prev + 1);
  }, []);

  /**
   * Reveal all solution steps
   */
  const revealAllSteps = useCallback(() => {
    setShowSolution(true);
  }, []);

  /**
   * Get feedback severity for UI display
   */
  const feedbackSeverity = useMemo(() => {
    if (verificationResult.correct === null) return null;
    if (verificationResult.correct) return 'success';
    if (verificationResult.partialCredit >= 50) return 'warning';
    return 'error';
  }, [verificationResult.correct, verificationResult.partialCredit]);

  return {
    // Verification state
    isVerifying,
    verificationResult,
    error,
    suggestedRating,
    feedbackSeverity,

    // Answer state
    answer,
    showSolution,
    currentSolutionStep,

    // Actions
    verifyAnswer,
    clearVerification,
    resetForNewItem,
    handleAnswerChange,
    revealNextStep,
    revealAllSteps,
    setShowSolution,

    // Utilities
    mapResultToRating,
    getRatingLabel,
    getRatingColor,
  };
}
