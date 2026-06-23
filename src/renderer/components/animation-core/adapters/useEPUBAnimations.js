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

  // Initialize adapter when rendition changes.
  //
  // adapter.initialize() can return false when the iframe views aren't
  // attached yet (slow load, large EPUB, cold cache). The hook used to
  // give up after a single 500ms attempt — leaving `isReady` false
  // forever and silently blocking features like Argument X-ray. Now
  // we retry every 500ms up to ~5s before giving up.
  useEffect(() => {
    if (!rendition) {
      setIsReady(false);
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;
    const MAX_ATTEMPTS = 10; // 10 × 500ms = 5s total
    let attempts = 0;

    const tryInit = async () => {
      if (cancelled || !adapterRef.current) return;
      attempts += 1;
      const success = await adapterRef.current.initialize();
      if (cancelled) return;
      if (success) {
        setIsReady(true);
        return;
      }
      if (attempts < MAX_ATTEMPTS) {
        timeoutId = setTimeout(tryInit, 500);
      } else {
        console.warn(
          `useEPUBAnimations: adapter still not ready after ${attempts} attempts`,
        );
      }
    };

    const initAdapter = async () => {
      // Clean up previous adapter if exists
      if (adapterRef.current) {
        await adapterRef.current.destroy();
      }
      if (cancelled) return;

      adapterRef.current = new EPUBAdapter(rendition);
      timeoutId = setTimeout(tryInit, 500);
    };

    initAdapter();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
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
   * Apply the SRS-aware halo for the current chapter. Each item is a
   * classifier output { word, state, intensity } — see srsHaloClassifier.
   */
  const applySrsHalo = useCallback(async (items, options = {}) => {
    if (!adapterRef.current) return { haloCount: 0 };
    return adapterRef.current.applySrsHalo(items, options);
  }, []);

  /**
   * v1 backwards-compat: takes plain word strings, all rendered as 'learning'.
   */
  const applyLexicalHalo = useCallback(async (words, options = {}) => {
    if (!adapterRef.current) return { haloCount: 0 };
    return adapterRef.current.applyLexicalHalo(words, options);
  }, []);

  /**
   * Remove all lexical halos and reset the per-chapter dedup set.
   */
  const removeLexicalHalo = useCallback(async () => {
    if (!adapterRef.current) return;
    await adapterRef.current.removeLexicalHalo();
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
    applyLexicalHalo,
    applySrsHalo,

    // Cleanup methods
    removeSummary,
    removeHighlights,
    removeLexicalHalo,
    removeAllEffects,

    // Utility
    reinitialize,

    // Direct adapter access
    adapter: adapterRef.current,
  };
}

export default useEPUBAnimations;
