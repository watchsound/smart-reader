/**
 * useNoteAnimations - React hook for Note/Leitner animations
 *
 * Usage:
 *   function FlipCard({ card }) {
 *     const cardRef = useRef(null);
 *     const {
 *       highlightKeywords,
 *       animateCorrect,
 *       animateIncorrect,
 *       animateBoxTransition
 *     } = useNoteAnimations(cardRef);
 *
 *     const handleCorrect = async () => {
 *       await animateCorrect(cardRef.current);
 *       // ... update leitner state
 *     };
 *
 *     return <div ref={cardRef}>...</div>;
 *   }
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import NoteAdapter from './NoteAdapter';

export function useNoteAnimations(containerRef) {
  const adapterRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize adapter
  useEffect(() => {
    const container = containerRef?.current || containerRef;
    if (!container) {
      setIsReady(false);
      return;
    }

    const initAdapter = async () => {
      if (adapterRef.current) {
        await adapterRef.current.destroy();
      }

      adapterRef.current = new NoteAdapter(containerRef);
      const success = await adapterRef.current.initialize();
      setIsReady(success);
    };

    initAdapter();

    return () => {
      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
  }, [containerRef]);

  /**
   * Highlight keywords in note content
   */
  const highlightKeywords = useCallback(async (keywords, options = {}) => {
    if (!adapterRef.current) return { wordCount: 0 };
    return adapterRef.current.highlightKeywords(keywords, options);
  }, []);

  /**
   * Apply glow to concept terms
   */
  const glowConcepts = useCallback(async (concepts, options = {}) => {
    if (!adapterRef.current) return { wordCount: 0 };
    return adapterRef.current.glowConcepts(concepts, options);
  }, []);

  /**
   * Show/hide answer with blur effect
   */
  const setAnswerVisibility = useCallback(async (element, reveal, options = {}) => {
    if (!adapterRef.current) return;
    return adapterRef.current.setAnswerVisibility(element, reveal, options);
  }, []);

  /**
   * Animate correct answer feedback
   */
  const animateCorrect = useCallback(async (element, options = {}) => {
    if (!adapterRef.current) return;
    return adapterRef.current.animateCorrect(element, options);
  }, []);

  /**
   * Animate incorrect answer feedback
   */
  const animateIncorrect = useCallback(async (element, options = {}) => {
    if (!adapterRef.current) return;
    return adapterRef.current.animateIncorrect(element, options);
  }, []);

  /**
   * Animate Leitner box transition
   */
  const animateBoxTransition = useCallback(async (element, fromBox, toBox, options = {}) => {
    if (!adapterRef.current) return;
    return adapterRef.current.animateBoxTransition(element, fromBox, toBox, options);
  }, []);

  /**
   * Remove keyword highlights
   */
  const removeHighlights = useCallback(() => {
    if (adapterRef.current) {
      adapterRef.current.removeHighlights();
    }
  }, []);

  /**
   * Remove all effects
   */
  const removeAllEffects = useCallback(async () => {
    if (adapterRef.current) {
      await adapterRef.current.removeAllEffects();
    }
  }, []);

  return {
    // State
    isReady,

    // Animation methods
    highlightKeywords,
    glowConcepts,
    setAnswerVisibility,
    animateCorrect,
    animateIncorrect,
    animateBoxTransition,

    // Cleanup
    removeHighlights,
    removeAllEffects,

    // Direct adapter access
    adapter: adapterRef.current,
  };
}

export default useNoteAnimations;
