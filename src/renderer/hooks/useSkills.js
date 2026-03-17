/**
 * useSkills.js
 *
 * React hook for skill-based AI operations.
 * Provides state management and convenient methods for using skills in components.
 *
 * Usage:
 * const { skills, executeSkill, isLoading, error } = useSkills();
 *
 * // Execute a skill with loading state
 * const result = await executeSkill('summarize', { text: '...' });
 *
 * // Use convenience methods
 * const summary = await summarize(selectedText);
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import skillApi from '../api/skillApi';

/**
 * Hook for managing skill operations with React state
 * @param {Object} options - Configuration options
 * @param {boolean} options.loadOnMount - Load available skills on mount (default: true)
 * @returns {Object} Skill operations and state
 */
export function useSkills(options = {}) {
  const { loadOnMount = true } = options;

  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [status, setStatus] = useState(null);

  // Load available skills
  const loadSkills = useCallback(() => {
    try {
      const available = skillApi.getAvailableSkills();
      setSkills(available);
      setError(null);
    } catch (e) {
      console.error('Failed to load skills:', e);
      setError(e.message);
    }
  }, []);

  // Load status
  const loadStatus = useCallback(() => {
    try {
      const s = skillApi.getStatus();
      setStatus(s);
    } catch (e) {
      console.error('Failed to load skill status:', e);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    if (loadOnMount) {
      loadSkills();
      loadStatus();
    }
  }, [loadOnMount, loadSkills, loadStatus]);

  // Execute a skill
  const executeSkill = useCallback(async (skillName, params) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await skillApi.executeSkill(skillName, params);
      if (result.success) {
        setLastResult(result.result);
        return result.result;
      } else {
        setError(result.error);
        throw new Error(result.error);
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Chat with skills
  const chatWithSkills = useCallback(async (messages, chatOptions = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await skillApi.chatWithSkills(messages, chatOptions);
      if (result.success) {
        setLastResult({ text: result.text, toolsUsed: result.toolsUsed });
        return result;
      } else {
        setError(result.error);
        throw new Error(result.error);
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Convenience methods
  const summarize = useCallback(async (text, summaryOptions = {}) => {
    return executeSkill('summarize', { text, ...summaryOptions });
  }, [executeSkill]);

  const checkGrammar = useCallback(async (text, explanationLanguage = 'english') => {
    return executeSkill('grammar_check', { text, explanationLanguage });
  }, [executeSkill]);

  const lookupVocabulary = useCallback(async (word, context = '') => {
    return executeSkill('vocabulary_lookup', { word, context });
  }, [executeSkill]);

  const explain = useCallback(async (concept, context = '') => {
    return executeSkill('explain', { concept, context });
  }, [executeSkill]);

  const extractConcepts = useCallback(async (text) => {
    return executeSkill('extract_concepts', { text });
  }, [executeSkill]);

  const searchNotes = useCallback(async (query, searchOptions = {}) => {
    return executeSkill('search_notes', { query, ...searchOptions });
  }, [executeSkill]);

  const createNote = useCallback(async (content, noteOptions = {}) => {
    return executeSkill('create_note', { content, ...noteOptions });
  }, [executeSkill]);

  // Update context when view changes
  const updateViewContext = useCallback((viewData) => {
    skillApi.updateView(viewData);
  }, []);

  // Update selection context
  const updateSelection = useCallback((selectedText) => {
    skillApi.updateSelection(selectedText);
  }, []);

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped = {};
    skills.forEach((skill) => {
      const category = skill.category || 'general';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(skill);
    });
    return grouped;
  }, [skills]);

  // Check if tool use is supported
  const supportsToolUse = useMemo(() => {
    return status?.supportsToolUse || false;
  }, [status]);

  return {
    // State
    skills,
    skillsByCategory,
    isLoading,
    error,
    lastResult,
    status,
    supportsToolUse,

    // Core operations
    executeSkill,
    chatWithSkills,
    loadSkills,

    // Convenience methods
    summarize,
    checkGrammar,
    lookupVocabulary,
    explain,
    extractConcepts,
    searchNotes,
    createNote,

    // Context updates
    updateViewContext,
    updateSelection,
  };
}

/**
 * Hook for using skills in a chat context
 * Manages conversation history and skill-enabled chat
 *
 * @param {Object} options
 * @param {string} options.systemPrompt - Optional system prompt
 * @returns {Object} Chat operations and state
 */
export function useSkillChat(options = {}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [toolsUsed, setToolsUsed] = useState([]);

  // Send a message and get AI response with potential skill use
  const sendMessage = useCallback(async (content) => {
    const userMessage = { role: 'user', content };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);
    setError(null);

    try {
      const result = await skillApi.chatWithSkills(updatedMessages, options);

      if (result.success) {
        const assistantMessage = { role: 'assistant', content: result.text };
        setMessages([...updatedMessages, assistantMessage]);
        setToolsUsed(result.toolsUsed || []);
        return result;
      } else {
        setError(result.error);
        // Remove the user message on error
        setMessages(messages);
        throw new Error(result.error);
      }
    } catch (e) {
      setError(e.message);
      // Remove the user message on error
      setMessages(messages);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [messages, options]);

  // Clear conversation
  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolsUsed([]);
    setError(null);
  }, []);

  // Add a message without sending (for displaying system messages, etc.)
  const addMessage = useCallback((role, content) => {
    setMessages((prev) => [...prev, { role, content }]);
  }, []);

  return {
    messages,
    isLoading,
    error,
    toolsUsed,
    sendMessage,
    clearMessages,
    addMessage,
  };
}

export default useSkills;
