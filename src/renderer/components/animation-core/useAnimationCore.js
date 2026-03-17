/**
 * useAnimationCore - React hook for AnimationCore
 *
 * Provides a React-friendly interface to the animation system.
 *
 * Usage:
 *   const { highlight, glow, flyToSummary, removeAllEffects } = useAnimationCore();
 *
 *   // In a click handler
 *   await highlight(['important', 'words'], { color: '#ffd700' });
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import AnimationCore from './AnimationCore';

export function useAnimationCore(options = {}) {
  const coreRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);

  // Initialize on mount
  useEffect(() => {
    coreRef.current = new AnimationCore(options);
    setIsReady(true);

    return () => {
      if (coreRef.current) {
        coreRef.current.destroy();
        coreRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Update the container (e.g., when ref changes)
   */
  const setContainer = useCallback((container) => {
    if (coreRef.current && container) {
      coreRef.current.options.container = container;
      coreRef.current.cloneManager.container = container;
    }
  }, []);

  /**
   * Wrap words in an element
   */
  const wrapElement = useCallback((element, wrapOptions = {}) => {
    if (!coreRef.current) return { wordCount: 0, wordIds: [] };
    return coreRef.current.wrapElement(element, wrapOptions);
  }, []);

  /**
   * Restore all wrapped elements
   */
  const restoreAll = useCallback(() => {
    if (coreRef.current) {
      coreRef.current.restoreAll();
    }
  }, []);

  /**
   * Highlight words by text
   */
  const highlight = useCallback(async (words, highlightOptions = {}) => {
    if (!coreRef.current) return { wordCount: 0 };

    const result = await coreRef.current.highlightWords(words, highlightOptions);

    if (result.effectId) {
      setActiveEffects((prev) => [
        ...prev,
        { id: result.effectId, type: 'highlight' },
      ]);
    }

    return result;
  }, []);

  /**
   * Apply glow effect to words
   */
  const glow = useCallback(async (words, glowOptions = {}) => {
    if (!coreRef.current) return { wordCount: 0 };

    const result = await coreRef.current.glowWords(words, glowOptions);

    if (result.effectId) {
      setActiveEffects((prev) => [
        ...prev,
        { id: result.effectId, type: 'glow' },
      ]);
    }

    return result;
  }, []);

  /**
   * Fly words to form a summary
   */
  const flyToSummary = useCallback(
    async (sourceElement, summaryText, flyOptions = {}) => {
      if (!coreRef.current) return { matchCount: 0 };

      const result = await coreRef.current.flyWordsToSummary(
        sourceElement,
        summaryText,
        flyOptions
      );

      if (result.effectId) {
        setActiveEffects((prev) => [
          ...prev,
          { id: result.effectId, type: 'flyingWord' },
        ]);
      }

      return result;
    },
    []
  );

  /**
   * Apply any registered effect
   */
  const applyEffect = useCallback(
    async (effectName, target, effectOptions = {}) => {
      if (!coreRef.current) return {};

      const result = await coreRef.current.applyEffect(
        effectName,
        target,
        effectOptions
      );

      if (result.effectId) {
        setActiveEffects((prev) => [
          ...prev,
          { id: result.effectId, type: effectName },
        ]);
      }

      return result;
    },
    []
  );

  /**
   * Remove a specific effect
   */
  const removeEffect = useCallback(async (effectId) => {
    if (!coreRef.current) return;

    await coreRef.current.removeEffect(effectId);
    setActiveEffects((prev) => prev.filter((e) => e.id !== effectId));
  }, []);

  /**
   * Remove all effects
   */
  const removeAllEffects = useCallback(async () => {
    if (!coreRef.current) return;

    await coreRef.current.removeAllEffects();
    setActiveEffects([]);
  }, []);

  /**
   * Register a custom effect
   */
  const registerEffect = useCallback((name, EffectClass, metadata = {}) => {
    if (coreRef.current) {
      coreRef.current.registerEffect(name, EffectClass, metadata);
    }
  }, []);

  /**
   * Get current state
   */
  const getState = useCallback(() => {
    if (!coreRef.current) {
      return {
        isInitialized: false,
        wrappedElementCount: 0,
        wordCount: 0,
        activeEffectCount: 0,
        cloneCount: 0,
        activeAnimationCount: 0,
      };
    }
    return coreRef.current.getState();
  }, []);

  /**
   * Find words by text
   */
  const findWords = useCallback((text) => {
    if (!coreRef.current) return [];
    return coreRef.current.findWordsByText(text);
  }, []);

  return {
    // State
    isReady,
    activeEffects,

    // Setup
    setContainer,

    // Wrapping
    wrapElement,
    restoreAll,

    // Effects
    highlight,
    glow,
    flyToSummary,
    applyEffect,

    // Effect management
    removeEffect,
    removeAllEffects,
    registerEffect,

    // Utilities
    getState,
    findWords,

    // Direct access (for advanced use)
    core: coreRef.current,
  };
}

export default useAnimationCore;
