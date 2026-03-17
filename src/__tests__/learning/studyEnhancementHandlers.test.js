/**
 * studyEnhancementHandlers.test.js
 *
 * Unit tests for study session enhancement IPC handlers
 */

import { ipcMain } from 'electron';

// Mock dependencies
const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
};

const mockAiProvider = {
  currentProvider: {
    generateContent: jest.fn(),
  },
  generateContent: jest.fn(),
};

const mockServices = {
  aiProvider: mockAiProvider,
};

// Mock AICacheManager
const mockInitCacheTable = jest.fn().mockReturnValue(true);
const mockGetCachedContent = jest.fn();
const mockSetCachedContent = jest.fn().mockReturnValue({ success: true });
const mockClearCacheByType = jest.fn().mockReturnValue({ success: true, deleted: 5 });
const mockGetCacheStats = jest.fn().mockReturnValue({
  byType: { hint: { count: 10, size: 1024 } },
  totalEntries: 10,
  totalSize: 1024,
});
const mockGenerateCacheKey = jest.fn().mockReturnValue('test-cache-key');

jest.mock('../../main/db/AICacheManager', () => ({
  initCacheTable: () => mockInitCacheTable(),
  getCachedContent: (...args) => mockGetCachedContent(...args),
  setCachedContent: (...args) => mockSetCachedContent(...args),
  clearCacheByType: (...args) => mockClearCacheByType(...args),
  getCacheStats: (...args) => mockGetCacheStats(...args),
  generateCacheKey: (...args) => mockGenerateCacheKey(...args),
  CACHE_TYPES: {
    HINT: 'hint',
    PRONUNCIATION: 'pronunciation',
  },
}));

// Mock ipcMain
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
}));

// Import handlers after mocks
const { registerStudyEnhancementHandlers, getDefaultSoundConfig } = require('../../main/ipc/studyEnhancementHandlers');

describe('studyEnhancementHandlers', () => {
  let handlers = {};
  let syncHandlers = {};

  beforeEach(() => {
    jest.clearAllMocks();
    handlers = {};
    syncHandlers = {};

    // Capture registered handlers
    ipcMain.handle.mockImplementation((channel, handler) => {
      handlers[channel] = handler;
    });

    ipcMain.on.mockImplementation((channel, handler) => {
      syncHandlers[channel] = handler;
    });

    // Register handlers
    registerStudyEnhancementHandlers(mockStore, mockServices);
  });

  describe('registerStudyEnhancementHandlers', () => {
    it('should initialize cache table', () => {
      expect(mockInitCacheTable).toHaveBeenCalled();
    });

    it('should register all expected handlers', () => {
      expect(handlers['study-get-hint']).toBeDefined();
      expect(handlers['study-get-pronunciation']).toBeDefined();
      expect(handlers['study-clear-hint-cache']).toBeDefined();
      expect(handlers['study-clear-pronunciation-cache']).toBeDefined();
      expect(handlers['study-get-cache-stats']).toBeDefined();
      expect(syncHandlers['study-get-sound-config']).toBeDefined();
      expect(syncHandlers['study-set-sound-config']).toBeDefined();
    });
  });

  describe('study-get-hint', () => {
    const mockItem = {
      front: 'ephemeral',
      back: 'lasting for a short time',
      tags: ['vocabulary'],
    };

    it('should return cached hint if available', async () => {
      mockGetCachedContent.mockReturnValue({
        content: 'This word suggests something fleeting',
      });

      const result = await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'association',
        useAI: true,
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.hint).toBe('This word suggests something fleeting');
      expect(result.fromCache).toBe(true);
    });

    it('should generate simple hint when AI is disabled', async () => {
      mockGetCachedContent.mockReturnValue(null);

      const result = await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'first_letter',
        useAI: false,
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.hint).toContain('Starts with');
      expect(result.fromCache).toBe(false);
    });

    it('should generate AI hint when not cached', async () => {
      mockGetCachedContent.mockReturnValue(null);
      mockAiProvider.generateContent.mockResolvedValue('Think of morning dew - beautiful but brief');

      const result = await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'association',
        useAI: true,
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(false);
      expect(mockSetCachedContent).toHaveBeenCalled();
    });

    it('should cache generated hints', async () => {
      mockGetCachedContent.mockReturnValue(null);
      mockAiProvider.generateContent.mockResolvedValue('AI generated hint');

      await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'association',
        useAI: true,
        token: 'test-token',
      });

      expect(mockSetCachedContent).toHaveBeenCalledWith(
        'hint',
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          expiryDays: 90, // AI hints have longer expiry
        })
      );
    });

    it('should generate partial hint type correctly', async () => {
      mockGetCachedContent.mockReturnValue(null);

      const result = await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'partial',
        useAI: false,
        token: 'test-token',
      });

      expect(result.hint).toMatch(/las_+/);
    });

    it('should generate category hint from tags', async () => {
      mockGetCachedContent.mockReturnValue(null);

      const result = await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'category',
        useAI: false,
        token: 'test-token',
      });

      expect(result.hint).toContain('vocabulary');
    });

    it('should handle AI provider errors gracefully', async () => {
      mockGetCachedContent.mockReturnValue(null);
      mockAiProvider.generateContent.mockRejectedValue(new Error('API error'));

      const result = await handlers['study-get-hint']({}, {
        item: mockItem,
        hintType: 'association',
        useAI: true,
        token: 'test-token',
      });

      // Should fallback to simple hint
      expect(result.success).toBe(true);
      expect(result.hint).toBeDefined();
    });
  });

  describe('study-get-pronunciation', () => {
    it('should return cached pronunciation if available', async () => {
      mockGetCachedContent.mockReturnValue({
        content: { text: 'hello', language: 'en-US', type: 'system_tts' },
      });

      const result = await handlers['study-get-pronunciation']({}, {
        text: 'hello',
        language: 'en-US',
        voice: 'default',
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.audio.text).toBe('hello');
      expect(result.fromCache).toBe(true);
    });

    it('should generate pronunciation data when not cached', async () => {
      mockGetCachedContent.mockReturnValue(null);

      const result = await handlers['study-get-pronunciation']({}, {
        text: 'hello',
        language: 'en-US',
        voice: 'default',
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.audio.type).toBe('system_tts');
      expect(result.audio.text).toBe('hello');
      expect(result.fromCache).toBe(false);
    });

    it('should cache pronunciation with long expiry', async () => {
      mockGetCachedContent.mockReturnValue(null);

      await handlers['study-get-pronunciation']({}, {
        text: 'hello',
        language: 'en-US',
        voice: 'default',
        token: 'test-token',
      });

      expect(mockSetCachedContent).toHaveBeenCalledWith(
        'pronunciation',
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          expiryDays: 180, // Long expiry for pronunciation
        })
      );
    });
  });

  describe('study-get-sound-config', () => {
    it('should return stored config', () => {
      const mockConfig = { enabled: true, volume: 0.8 };
      mockStore.get.mockReturnValue(mockConfig);

      const mockEvent = { returnValue: null };
      syncHandlers['study-get-sound-config'](mockEvent);

      expect(mockEvent.returnValue).toEqual(mockConfig);
    });

    it('should return default config if none stored', () => {
      mockStore.get.mockReturnValue(undefined);

      const mockEvent = { returnValue: null };
      syncHandlers['study-get-sound-config'](mockEvent);

      expect(mockEvent.returnValue).toEqual(getDefaultSoundConfig());
    });
  });

  describe('study-set-sound-config', () => {
    it('should save sound config', () => {
      const newConfig = { enabled: false, volume: 0.5 };

      const mockEvent = { returnValue: null };
      syncHandlers['study-set-sound-config'](mockEvent, newConfig);

      expect(mockStore.set).toHaveBeenCalledWith(
        'studySoundEffects',
        expect.objectContaining(newConfig)
      );
      expect(mockEvent.returnValue.success).toBe(true);
    });

    it('should merge with default config', () => {
      const partialConfig = { volume: 0.3 };

      const mockEvent = { returnValue: null };
      syncHandlers['study-set-sound-config'](mockEvent, partialConfig);

      const savedConfig = mockStore.set.mock.calls[0][1];
      expect(savedConfig.volume).toBe(0.3);
      expect(savedConfig.enabled).toBeDefined(); // From defaults
      expect(savedConfig.sounds).toBeDefined(); // From defaults
    });
  });

  describe('study-clear-hint-cache', () => {
    it('should clear hint cache', async () => {
      const result = await handlers['study-clear-hint-cache']({}, {
        token: 'test-token',
      });

      expect(mockClearCacheByType).toHaveBeenCalledWith('hint', 'test-token');
      expect(result.success).toBe(true);
    });
  });

  describe('study-clear-pronunciation-cache', () => {
    it('should clear pronunciation cache', async () => {
      const result = await handlers['study-clear-pronunciation-cache']({}, {
        token: 'test-token',
      });

      expect(mockClearCacheByType).toHaveBeenCalledWith('pronunciation', 'test-token');
      expect(result.success).toBe(true);
    });
  });

  describe('study-get-cache-stats', () => {
    it('should return cache statistics', async () => {
      const result = await handlers['study-get-cache-stats']({}, {
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.stats.totalEntries).toBe(10);
    });
  });

  describe('getDefaultSoundConfig', () => {
    it('should return complete default config', () => {
      const config = getDefaultSoundConfig();

      expect(config.enabled).toBe(true);
      expect(config.volume).toBe(0.5);
      expect(config.sounds).toBeDefined();
      expect(config.sounds.flip).toBeDefined();
      expect(config.sounds.correct).toBeDefined();
      expect(config.sounds.incorrect).toBeDefined();
      expect(config.sounds.streak).toBeDefined();
      expect(config.sounds.complete).toBeDefined();
      expect(config.sounds.levelUp).toBeDefined();
      expect(config.streakMilestones).toEqual([5, 10, 25, 50, 100]);
    });
  });
});
