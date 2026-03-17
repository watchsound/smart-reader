/**
 * studyEnhancementApi.js
 *
 * Renderer-side API for study session enhancements:
 * - AI-powered hints with caching
 * - Audio pronunciation with caching
 * - Sound effects configuration
 */

/**
 * Get hint for a learning point
 * @param {Object} item - Learning point item with front/back
 * @param {Object} options - Options
 * @param {string} options.hintType - Type of hint (first_letter, category, association, partial, context)
 * @param {boolean} options.useAI - Whether to use AI for hint generation
 * @param {string} options.token - User token
 * @returns {Promise<Object>} Hint result
 */
export const getHint = async ({ item, hintType = 'association', useAI = true, token = null }) => {
  try {
    return await window.electron.ipcRenderer.invoke('study-get-hint', {
      item,
      hintType,
      useAI,
      token,
    });
  } catch (err) {
    console.error('Error getting hint:', err);
    return {
      success: false,
      error: err.message,
      hint: generateFallbackHint(item, hintType),
    };
  }
};

/**
 * Get pronunciation data for text
 * @param {Object} options - Options
 * @param {string} options.text - Text to pronounce
 * @param {string} options.language - Language code (e.g., 'en-US')
 * @param {string} options.voice - Voice identifier
 * @param {string} options.token - User token
 * @returns {Promise<Object>} Pronunciation data
 */
export const getPronunciation = async ({ text, language = 'en-US', voice = 'default', token = null }) => {
  try {
    return await window.electron.ipcRenderer.invoke('study-get-pronunciation', {
      text,
      language,
      voice,
      token,
    });
  } catch (err) {
    console.error('Error getting pronunciation:', err);
    return {
      success: false,
      error: err.message,
    };
  }
};

/**
 * Get sound effects configuration
 * @returns {Object} Sound configuration
 */
export const getSoundConfig = () => {
  try {
    return window.electron.ipcRenderer.sendSync('study-get-sound-config');
  } catch (err) {
    console.error('Error getting sound config:', err);
    return getDefaultSoundConfig();
  }
};

/**
 * Save sound effects configuration
 * @param {Object} config - Sound configuration
 * @returns {Object} Result
 */
export const setSoundConfig = (config) => {
  try {
    return window.electron.ipcRenderer.sendSync('study-set-sound-config', config);
  } catch (err) {
    console.error('Error saving sound config:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Clear hint cache
 * @param {string} token - User token
 * @returns {Promise<Object>} Result
 */
export const clearHintCache = async (token = null) => {
  try {
    return await window.electron.ipcRenderer.invoke('study-clear-hint-cache', { token });
  } catch (err) {
    console.error('Error clearing hint cache:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Clear pronunciation cache
 * @param {string} token - User token
 * @returns {Promise<Object>} Result
 */
export const clearPronunciationCache = async (token = null) => {
  try {
    return await window.electron.ipcRenderer.invoke('study-clear-pronunciation-cache', { token });
  } catch (err) {
    console.error('Error clearing pronunciation cache:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Get cache statistics
 * @param {string} token - User token
 * @returns {Promise<Object>} Cache stats
 */
export const getCacheStats = async (token = null) => {
  try {
    return await window.electron.ipcRenderer.invoke('study-get-cache-stats', { token });
  } catch (err) {
    console.error('Error getting cache stats:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Generate a fallback hint when API fails
 */
const generateFallbackHint = (item, hintType) => {
  const back = item.back || '';

  switch (hintType) {
    case 'first_letter':
      return `Starts with "${back.charAt(0).toUpperCase()}"...`;
    case 'partial':
      if (back.length > 5) {
        return `${back.substring(0, 3)}${'_'.repeat(Math.min(back.length - 3, 5))}`;
      }
      return `${back.charAt(0)}${'_'.repeat(back.length - 1)}`;
    case 'word_count':
      const words = back.split(/\s+/).length;
      return `The answer has ${words} word${words > 1 ? 's' : ''}`;
    default:
      return item.tags?.[0] || 'Think about it...';
  }
};

/**
 * Get default sound configuration
 */
const getDefaultSoundConfig = () => ({
  enabled: true,
  volume: 0.5,
  sounds: {
    flip: { enabled: true, volume: 0.4 },
    correct: { enabled: true, volume: 0.6 },
    incorrect: { enabled: true, volume: 0.5 },
    streak: { enabled: true, volume: 0.7 },
    complete: { enabled: true, volume: 0.8 },
    levelUp: { enabled: true, volume: 0.8 },
  },
  haptics: { enabled: false, intensity: 'medium' },
  streakMilestones: [5, 10, 25, 50, 100],
});

// Hint types available
export const HINT_TYPES = {
  FIRST_LETTER: 'first_letter',
  CATEGORY: 'category',
  ASSOCIATION: 'association',
  PARTIAL: 'partial',
  CONTEXT: 'context',
  WORD_COUNT: 'word_count',
};

// Sound effect types
export const SOUND_TYPES = {
  FLIP: 'flip',
  CORRECT: 'correct',
  INCORRECT: 'incorrect',
  STREAK: 'streak',
  COMPLETE: 'complete',
  LEVEL_UP: 'levelUp',
};

export default {
  getHint,
  getPronunciation,
  getSoundConfig,
  setSoundConfig,
  clearHintCache,
  clearPronunciationCache,
  getCacheStats,
  HINT_TYPES,
  SOUND_TYPES,
};
