/**
 * usePDFAnimations - React hook for PDF animations
 *
 * Provides a React-friendly interface to the PDF animation adapter.
 *
 * Usage:
 *   function PDFView() {
 *     const containerRef = useRef(null);
 *     const {
 *       isReady,
 *       highlightVocabulary,
 *       smartSummary,
 *       removeSummary,
 *       removeAllEffects
 *     } = usePDFAnimations(containerRef);
 *
 *     return (
 *       <div ref={containerRef}>
 *         <PdfHighlighter ... />
 *       </div>
 *     );
 *   }
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import PDFAdapter from './PDFAdapter';

export function usePDFAnimations(containerRef) {
  const adapterRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);

  // Initialize adapter when containerRef changes
  useEffect(() => {
    const container = containerRef?.current || containerRef;
    console.log('[usePDFAnimations] Container check:', !!container, container?.className);

    if (!container) {
      setIsReady(false);
      return;
    }

    const initAdapter = async () => {
      console.log('[usePDFAnimations] Initializing adapter...');

      // Clean up previous adapter
      if (adapterRef.current) {
        await adapterRef.current.destroy();
      }

      // Create new adapter
      adapterRef.current = new PDFAdapter(containerRef);
      const success = await adapterRef.current.initialize();
      console.log('[usePDFAnimations] Adapter initialized:', success);
      setIsReady(success);
    };

    // Wait for PDF to render
    const timeoutId = setTimeout(initAdapter, 500);

    return () => {
      clearTimeout(timeoutId);
      if (adapterRef.current) {
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
  }, [containerRef]);

  /**
   * Highlight vocabulary words
   */
  const highlightVocabulary = useCallback(async (words, options = {}) => {
    if (!adapterRef.current) return { wordCount: 0 };

    const result = await adapterRef.current.highlightVocabulary(words, options);

    if (result.wordCount > 0) {
      setActiveEffects(prev => [...prev, { type: 'vocabulary', count: result.wordCount }]);
    }

    return result;
  }, []);

  /**
   * Apply glow effect
   */
  const glowWords = useCallback(async (words, options = {}) => {
    if (!adapterRef.current) return { wordCount: 0 };

    const result = await adapterRef.current.glowWords(words, options);

    if (result.wordCount > 0) {
      setActiveEffects(prev => [...prev, { type: 'glow', count: result.wordCount }]);
    }

    return result;
  }, []);

  /**
   * Create smart summary with flying word animation
   * @param {string} sourceText - Selected or source text
   * @param {string} summaryText - AI-generated summary
   * @param {string[]} vocabularyWords - Optional vocabulary words to highlight with gold glow
   * @param {Object} options - Additional options
   */
  const smartSummary = useCallback(async (sourceText, summaryText, vocabularyWords = [], options = {}) => {
    if (!adapterRef.current) return { matchCount: 0 };

    const result = await adapterRef.current.smartSummary(sourceText, summaryText, vocabularyWords, options);

    setActiveEffects(prev => [...prev, { type: 'summary' }]);

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
   * Force re-initialization
   */
  const reinitialize = useCallback(async () => {
    if (!adapterRef.current) return false;

    await adapterRef.current.destroy();
    adapterRef.current = new PDFAdapter(containerRef);
    const success = await adapterRef.current.initialize();
    setIsReady(success);
    return success;
  }, [containerRef]);

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

export default usePDFAnimations;
