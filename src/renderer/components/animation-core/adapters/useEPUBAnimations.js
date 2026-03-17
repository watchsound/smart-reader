/**
 * useEPUBAnimations - React hook for EPUB animations
 *
 * Provides a React-friendly interface to the EPUB animation adapter.
 *
 * Usage:
 *   function EPubView({ rendition }) {
 *     const {
 *       isReady,
 *       highlightVocabulary,
 *       smartSummary,
 *       removeSummary,
 *       removeAllEffects
 *     } = useEPUBAnimations(rendition);
 *
 *     const handleHighlight = async () => {
 *       await highlightVocabulary(['word1', 'word2']);
 *     };
 *
 *     return <button onClick={handleHighlight}>Highlight</button>;
 *   }
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import EPUBAdapter from './EPUBAdapter';

export function useEPUBAnimations(rendition) {
  const adapterRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);

  // Initialize adapter when rendition changes
  useEffect(() => {
    if (!rendition) {
      setIsReady(false);
      return;
    }

    const initAdapter = async () => {
      // Clean up previous adapter if exists
      if (adapterRef.current) {
        await adapterRef.current.destroy();
      }

      // Create new adapter
      adapterRef.current = new EPUBAdapter(rendition);

      // Wait a bit for rendition to be fully ready
      setTimeout(async () => {
        const success = await adapterRef.current.initialize();
        setIsReady(success);
      }, 500);
    };

    initAdapter();

    return () => {
      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
  }, [rendition]);

  /**
   * Highlight vocabulary words
   */
  const highlightVocabulary = useCallback(async (words, options = {}) => {
    if (!adapterRef.current) return { wordCount: 0 };

    const result = await adapterRef.current.highlightVocabulary(words, options);

    if (result.effectId) {
      setActiveEffects(prev => [...prev, { id: result.effectId, type: 'vocabulary' }]);
    }

    return result;
  }, []);

  /**
   * Apply glow effect to words
   */
  const glowWords = useCallback(async (words, options = {}) => {
    if (!adapterRef.current) return { wordCount: 0 };

    const result = await adapterRef.current.glowWords(words, options);

    if (result.effectId) {
      setActiveEffects(prev => [...prev, { id: result.effectId, type: 'glow' }]);
    }

    return result;
  }, []);

  /**
   * Create smart summary animation with flying words
   * @param {string} sourceText - Selected or source text
   * @param {string} summaryText - AI-generated summary
   * @param {string[]} vocabularyWords - Optional vocabulary words to highlight with gold glow
   * @param {Object} options - Additional options
   */
  const smartSummary = useCallback(async (sourceText, summaryText, vocabularyWords = [], options = {}) => {
    if (!adapterRef.current) return { matchCount: 0 };

    const result = await adapterRef.current.smartSummary(sourceText, summaryText, vocabularyWords, options);

    if (result.effectId) {
      setActiveEffects(prev => [...prev, { id: result.effectId, type: 'summary' }]);
    }

    return result;
  }, []);

  /**
   * Remove smart summary
   */
  const removeSummary = useCallback(async () => {
    if (!adapterRef.current) return;

    await adapterRef.current.removeSummary();
    setActiveEffects(prev => prev.filter(e => e.type !== 'summary'));
  }, []);

  /**
   * Remove vocabulary highlights
   */
  const removeHighlights = useCallback(async () => {
    if (!adapterRef.current) return;

    await adapterRef.current.removeHighlights();
    setActiveEffects(prev => prev.filter(e => e.type !== 'vocabulary'));
  }, []);

  /**
   * Remove all effects
   */
  const removeAllEffects = useCallback(async () => {
    if (!adapterRef.current) return;

    await adapterRef.current.removeAllEffects();
    setActiveEffects([]);
  }, []);

  /**
   * Force re-initialization (useful after page changes)
   */
  const reinitialize = useCallback(async () => {
    if (!adapterRef.current || !rendition) return false;

    await adapterRef.current.destroy();
    adapterRef.current = new EPUBAdapter(rendition);
    const success = await adapterRef.current.initialize();
    setIsReady(success);
    return success;
  }, [rendition]);

  return {
    // State
    isReady,
    activeEffects,

    // Animation methods
    highlightVocabulary,
    glowWords,
    smartSummary,

    // Cleanup methods
    removeSummary,
    removeHighlights,
    removeAllEffects,

    // Utility
    reinitialize,

    // Direct adapter access
    adapter: adapterRef.current,
  };
}

export default useEPUBAnimations;
