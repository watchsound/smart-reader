/**
 * useStudyEnhancer - React hook for StudyEnhancer integration
 *
 * Usage:
 *   const { inject, applyEffect, flyingAbstract, ... } = useStudyEnhancer(webviewRef);
 *
 *   // After webview is ready
 *   useEffect(() => {
 *     if (webviewRef.current) inject();
 *   }, []);
 *
 *   // Apply effects
 *   await flyingAbstract('p.content', abstractFromAI);
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import StudyEnhancerController from './StudyEnhancerController';

export function useStudyEnhancer(webviewRef) {
  const controllerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [activeEffects, setActiveEffects] = useState([]);
  const [paragraphIconsActive, setParagraphIconsActive] = useState(false);

  // Initialize controller
  useEffect(() => {
    if (webviewRef?.current && !controllerRef.current) {
      controllerRef.current = new StudyEnhancerController(webviewRef);
    }

    return () => {
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
    };
  }, [webviewRef]);

  /**
   * Inject StudyEnhancer into webview
   */
  const inject = useCallback(async () => {
    if (!controllerRef.current) {
      if (webviewRef?.current) {
        controllerRef.current = new StudyEnhancerController(webviewRef);
      } else {
        console.warn('useStudyEnhancer: No webview available');
        return false;
      }
    }

    const success = await controllerRef.current.inject();
    setIsReady(success);
    return success;
  }, [webviewRef]);

  /**
   * Wrap words in an element
   */
  const wrapElement = useCallback(async (selector) => {
    if (!controllerRef.current) return null;
    return controllerRef.current.wrapElement(selector);
  }, []);

  /**
   * Wrap all paragraphs in the page
   */
  const wrapAllParagraphs = useCallback(async () => {
    if (!controllerRef.current) return null;
    return controllerRef.current.wrapAllParagraphs();
  }, []);

  /**
   * Apply an effect
   */
  const applyEffect = useCallback(async (effectName, target, options = {}) => {
    if (!controllerRef.current) {
      await inject();
    }

    const result = await controllerRef.current.applyEffect(effectName, target, options);

    if (result?.instanceId) {
      setActiveEffects(prev => [...prev, { id: result.instanceId, name: effectName }]);
    }

    return result;
  }, [inject]);

  /**
   * Remove an effect
   */
  const removeEffect = useCallback(async (instanceId) => {
    if (!controllerRef.current) return;

    await controllerRef.current.removeEffect(instanceId);
    setActiveEffects(prev => prev.filter(e => e.id !== instanceId));
  }, []);

  /**
   * Remove all active effects
   */
  const removeAllEffects = useCallback(async () => {
    if (!controllerRef.current) return;

    await controllerRef.current.removeAllEffects();
    setActiveEffects([]);
  }, []);

  /**
   * Restore all wrapped elements
   */
  const restoreAll = useCallback(async () => {
    if (!controllerRef.current) return;

    await controllerRef.current.restoreAll();
    setActiveEffects([]);
  }, []);

  /**
   * Highlight specific words by text
   */
  const highlightWords = useCallback(async (words, options = {}) => {
    if (!controllerRef.current) {
      await inject();
    }

    return controllerRef.current.highlightWords(words, options);
  }, [inject]);

  /**
   * Apply flying abstract effect
   * @param {string} selector - Source element selector
   * @param {string} abstract - Abstract text (from AI)
   * @param {Object} options - Effect options
   */
  const flyingAbstract = useCallback(async (selector, abstract, options = {}) => {
    if (!controllerRef.current) {
      await inject();
    }

    const result = await controllerRef.current.flyingAbstract(selector, abstract, options);

    if (result?.instanceId) {
      setActiveEffects(prev => [...prev, { id: result.instanceId, name: 'flyingAbstract' }]);
    }

    return result;
  }, [inject]);

  /**
   * Apply smart summary effect with vocabulary highlighting
   * @param {string} selector - Source element selector
   * @param {string} summary - Summary text (from AI)
   * @param {string[]} vocabularyWords - User's learning vocabulary
   * @param {Object} options - Effect options
   */
  const smartSummary = useCallback(async (selector, summary, vocabularyWords = [], options = {}) => {
    if (!controllerRef.current) {
      await inject();
    }

    const result = await controllerRef.current.smartSummary(selector, summary, vocabularyWords, options);

    if (result?.instanceId) {
      setActiveEffects(prev => [...prev, { id: result.instanceId, name: 'smartSummary' }]);
    }

    return result;
  }, [inject]);

  /**
   * Apply constellation mindmap effect
   * @param {string} selector - Source element selector
   * @param {Object} mindmapData - Mindmap data from AI extraction
   * @param {Object} options - Effect options
   */
  const constellationMindmap = useCallback(async (selector, mindmapData, options = {}) => {
    if (!controllerRef.current) {
      await inject();
    }

    const result = await controllerRef.current.constellationMindmap(selector, mindmapData, options);

    if (result?.instanceId) {
      setActiveEffects(prev => [...prev, { id: result.instanceId, name: 'constellationMindmap' }]);
    }

    return result;
  }, [inject]);

  /**
   * Apply entity resolution effect (coreference linking)
   * @param {string} selector - Source element selector
   * @param {Object} entityData - Entity resolution data from AI
   * @param {Object} options - Effect options
   */
  const entityResolution = useCallback(async (selector, entityData, options = {}) => {
    if (!controllerRef.current) {
      await inject();
    }

    const result = await controllerRef.current.entityResolution(selector, entityData, options);

    if (result?.instanceId) {
      setActiveEffects(prev => [...prev, { id: result.instanceId, name: 'entityResolution' }]);
    }

    return result;
  }, [inject]);

  /**
   * Inject paragraph action icons on meaningful paragraphs
   * @param {Object} options - Options for paragraph detection
   */
  const injectParagraphIcons = useCallback(async (options = {}) => {
    console.log('useStudyEnhancer: injectParagraphIcons called');

    // Make sure controller exists and is injected
    if (!controllerRef.current) {
      console.log('useStudyEnhancer: Creating new controller');
      if (webviewRef?.current) {
        controllerRef.current = new StudyEnhancerController(webviewRef);
      } else {
        console.warn('useStudyEnhancer: No webview available for paragraph icons');
        return null;
      }
    }

    // Make sure the StudyEnhancer script is injected into the webview
    console.log('useStudyEnhancer: Calling inject()');
    const injected = await controllerRef.current.inject();
    console.log('useStudyEnhancer: inject() returned:', injected);
    if (!injected) {
      console.warn('useStudyEnhancer: Failed to inject StudyEnhancer');
      return null;
    }

    console.log('useStudyEnhancer: Calling controller.injectParagraphIcons()');
    const result = await controllerRef.current.injectParagraphIcons(options);
    console.log('useStudyEnhancer: injectParagraphIcons result:', result);
    setParagraphIconsActive(true);
    return result;
  }, [webviewRef]);

  /**
   * Remove paragraph action icons
   */
  const removeParagraphIcons = useCallback(async () => {
    if (!controllerRef.current) return;

    await controllerRef.current.removeParagraphIcons();
    setParagraphIconsActive(false);
  }, []);

  /**
   * Toggle paragraph action icons
   */
  const toggleParagraphIcons = useCallback(async (options = {}) => {
    if (paragraphIconsActive) {
      await removeParagraphIcons();
    } else {
      await injectParagraphIcons(options);
    }
  }, [paragraphIconsActive, injectParagraphIcons, removeParagraphIcons]);

  /**
   * Add event listener
   */
  const on = useCallback((eventType, callback) => {
    if (controllerRef.current) {
      controllerRef.current.on(eventType, callback);
    }
  }, []);

  /**
   * Remove event listener
   */
  const off = useCallback((eventType, callback) => {
    if (controllerRef.current) {
      controllerRef.current.off(eventType, callback);
    }
  }, []);

  return {
    // State
    isReady,
    activeEffects,
    paragraphIconsActive,

    // Core methods
    inject,
    wrapElement,
    wrapAllParagraphs,

    // Effect methods
    applyEffect,
    removeEffect,
    removeAllEffects,
    restoreAll,

    // Convenience methods
    highlightWords,
    flyingAbstract,
    smartSummary,
    constellationMindmap,
    entityResolution,

    // Paragraph action icons
    injectParagraphIcons,
    removeParagraphIcons,
    toggleParagraphIcons,

    // Events
    on,
    off,

    // Direct controller access (for advanced use)
    controller: controllerRef.current
  };
}

export default useStudyEnhancer;
