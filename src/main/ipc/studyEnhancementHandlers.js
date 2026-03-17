/**
 * studyEnhancementHandlers.js
 *
 * IPC handlers for study session enhancements:
 * - AI-powered hints with caching
 * - Audio pronunciation with caching
 * - Sound effects configuration
 */

import { ipcMain } from 'electron';
import {
  initCacheTable,
  getCachedContent,
  setCachedContent,
  clearCacheByType,
  getCacheStats,
  generateCacheKey,
  CACHE_TYPES,
} from '../db/AICacheManager';

/**
 * Generate a hint for a learning point using AI
 * @param {Object} aiProvider - AI provider instance
 * @param {Object} item - Learning point item
 * @param {string} hintType - Type of hint (first_letter, category, association, partial)
 * @returns {Promise<string>} Generated hint
 */
const generateAIHint = async (aiProvider, item, hintType = 'association') => {
  if (!aiProvider || !aiProvider.currentProvider) {
    // Fallback to simple hint
    return generateSimpleHint(item, hintType);
  }

  const prompts = {
    first_letter: `Give a very brief hint for remembering "${item.front}".
Start with: "Starts with '${(item.back || '').charAt(0).toUpperCase()}'..."
Keep it under 20 words.`,

    category: `What category or topic does "${item.front}" belong to?
Give a brief categorical hint in under 15 words.
Example: "This is a type of..." or "This belongs to the field of..."`,

    association: `Create a memorable association or mnemonic for remembering that "${item.front}" means "${item.back}".
Keep it under 25 words and make it vivid or humorous if possible.`,

    partial: `Give a partial answer hint for "${item.front}".
Reveal part of the answer with blanks: "${(item.back || '').substring(0, 3)}___"
Add a brief context clue. Keep under 20 words.`,

    context: `Give a brief contextual hint about "${item.front}".
Mention where or how this would be used, without revealing the answer.
Keep under 20 words.`,
  };

  const prompt = prompts[hintType] || prompts.association;

  try {
    const response = await aiProvider.generateContent(prompt);
    if (typeof response === 'string' && response.length > 0) {
      return response.trim();
    }
    return generateSimpleHint(item, hintType);
  } catch (err) {
    console.error('Error generating AI hint:', err);
    return generateSimpleHint(item, hintType);
  }
};

/**
 * Generate a simple non-AI hint
 */
const generateSimpleHint = (item, hintType = 'first_letter') => {
  const back = item.back || '';

  switch (hintType) {
    case 'first_letter':
      return `Starts with "${back.charAt(0).toUpperCase()}"...`;

    case 'partial':
      if (back.length > 5) {
        return `${back.substring(0, 3)}${'_'.repeat(Math.min(back.length - 3, 5))}`;
      }
      return `${back.charAt(0)}${'_'.repeat(back.length - 1)}`;

    case 'category':
      if (item.tags && item.tags.length > 0) {
        return `Category: ${item.tags[0]}`;
      }
      return 'Think about the context...';

    case 'word_count':
      const words = back.split(/\s+/).length;
      return `The answer has ${words} word${words > 1 ? 's' : ''}`;

    default:
      return item.tags?.[0] || 'Think about it...';
  }
};

/**
 * Generate audio pronunciation using TTS or AI
 * @param {Object} options - Pronunciation options
 * @returns {Promise<Object>} Audio data or instructions
 */
const generatePronunciation = async (text, options = {}) => {
  const { language = 'en-US', voice = 'default' } = options;

  // For now, return TTS instructions that renderer can use
  // In the future, this could integrate with cloud TTS APIs
  return {
    text,
    language,
    voice,
    type: 'system_tts', // Use system TTS (speechSynthesis API)
    // If we had cloud TTS, we could return base64 audio here
  };
};

/**
 * Register study enhancement IPC handlers
 * @param {Object} store - Electron store
 * @param {Object} services - Services object containing aiProvider
 */
export const registerStudyEnhancementHandlers = (store, services) => {
  // Initialize cache table on registration
  initCacheTable();

  /**
   * Get hint for a learning point (with caching)
   */
  ipcMain.handle('study-get-hint', async (event, { item, hintType, useAI, token }) => {
    try {
      // Generate cache key based on item and hint type
      const cacheKey = generateCacheKey(CACHE_TYPES.HINT, {
        front: item.front,
        back: item.back,
        hintType,
        useAI,
      });

      // Check cache first
      const cached = getCachedContent(CACHE_TYPES.HINT, cacheKey, token);
      if (cached) {
        return {
          success: true,
          hint: cached.content,
          fromCache: true,
        };
      }

      // Generate new hint
      let hint;
      if (useAI && services.aiProvider) {
        hint = await generateAIHint(services.aiProvider, item, hintType);
      } else {
        hint = generateSimpleHint(item, hintType);
      }

      // Cache the result (longer expiry for AI hints since they're expensive)
      setCachedContent(CACHE_TYPES.HINT, cacheKey, hint, {
        expiryDays: useAI ? 90 : 30, // AI hints cached for 90 days
        metadata: { hintType, useAI, itemFront: item.front },
        token,
      });

      return {
        success: true,
        hint,
        fromCache: false,
      };
    } catch (err) {
      console.error('Error getting hint:', err);
      return {
        success: false,
        error: err.message,
        hint: generateSimpleHint(item, hintType),
      };
    }
  });

  /**
   * Get pronunciation data for text (with caching)
   */
  ipcMain.handle('study-get-pronunciation', async (event, { text, language, voice, token }) => {
    try {
      const cacheKey = generateCacheKey(CACHE_TYPES.PRONUNCIATION, {
        text,
        language,
        voice,
      });

      // Check cache first
      const cached = getCachedContent(CACHE_TYPES.PRONUNCIATION, cacheKey, token);
      if (cached) {
        return {
          success: true,
          audio: cached.content,
          fromCache: true,
        };
      }

      // Generate pronunciation data
      const audio = await generatePronunciation(text, { language, voice });

      // Cache the result
      setCachedContent(CACHE_TYPES.PRONUNCIATION, cacheKey, audio, {
        expiryDays: 180, // Pronunciation doesn't change, cache for 6 months
        metadata: { text, language, voice },
        token,
      });

      return {
        success: true,
        audio,
        fromCache: false,
      };
    } catch (err) {
      console.error('Error getting pronunciation:', err);
      return {
        success: false,
        error: err.message,
      };
    }
  });

  /**
   * Get sound effects configuration
   */
  ipcMain.on('study-get-sound-config', (event) => {
    try {
      const config = store.get('studySoundEffects') || getDefaultSoundConfig();
      event.returnValue = config;
    } catch (err) {
      console.error('Error getting sound config:', err);
      event.returnValue = getDefaultSoundConfig();
    }
  });

  /**
   * Save sound effects configuration
   */
  ipcMain.on('study-set-sound-config', (event, config) => {
    try {
      const mergedConfig = {
        ...getDefaultSoundConfig(),
        ...config,
      };
      store.set('studySoundEffects', mergedConfig);
      event.returnValue = { success: true };
    } catch (err) {
      console.error('Error saving sound config:', err);
      event.returnValue = { success: false, error: err.message };
    }
  });

  /**
   * Clear hint cache
   */
  ipcMain.handle('study-clear-hint-cache', async (event, { token }) => {
    try {
      const result = clearCacheByType(CACHE_TYPES.HINT, token);
      return result;
    } catch (err) {
      console.error('Error clearing hint cache:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Clear pronunciation cache
   */
  ipcMain.handle('study-clear-pronunciation-cache', async (event, { token }) => {
    try {
      const result = clearCacheByType(CACHE_TYPES.PRONUNCIATION, token);
      return result;
    } catch (err) {
      console.error('Error clearing pronunciation cache:', err);
      return { success: false, error: err.message };
    }
  });

  /**
   * Get cache statistics
   */
  ipcMain.handle('study-get-cache-stats', async (event, { token }) => {
    try {
      const stats = getCacheStats(token);
      return { success: true, stats };
    } catch (err) {
      console.error('Error getting cache stats:', err);
      return { success: false, error: err.message };
    }
  });

  console.log('Study enhancement handlers registered');
};

/**
 * Get default sound effects configuration
 */
export const getDefaultSoundConfig = () => ({
  enabled: true,
  volume: 0.5, // 0.0 to 1.0

  // Individual sound toggles
  sounds: {
    flip: {
      enabled: true,
      volume: 0.4,
      file: 'default', // Use Web Audio API generated sound
    },
    correct: {
      enabled: true,
      volume: 0.6,
      file: 'default', // Use Web Audio API generated sound
    },
    incorrect: {
      enabled: true,
      volume: 0.5,
      file: 'default', // Use Web Audio API generated sound
    },
    streak: {
      enabled: true,
      volume: 0.7,
      file: 'default', // Plays on streak milestones
    },
    complete: {
      enabled: true,
      volume: 0.8,
      file: 'default', // Session complete
    },
    levelUp: {
      enabled: true,
      volume: 0.8,
      file: 'default', // Card promoted to next box
    },
  },

  // Haptic feedback (for supported devices)
  haptics: {
    enabled: false,
    intensity: 'medium', // light, medium, strong
  },

  // Streak milestone sounds
  streakMilestones: [5, 10, 25, 50, 100],
});

export default {
  registerStudyEnhancementHandlers,
  getDefaultSoundConfig,
};
