/**
 * AICacheManager.test.js
 *
 * Unit tests for the AI cache manager (hints, pronunciations, etc.)
 */

// Mock database
const mockDb = {
  exec: jest.fn(),
  prepare: jest.fn(),
};

const mockStmt = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn(),
};

mockDb.prepare.mockReturnValue(mockStmt);

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: mockDb,
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    return -1;
  }),
}));

jest.mock('../../commons/utils/SqliteHelper', () => ({
  dateToSQLiteString: jest.fn((date) => date.toISOString()),
}));

// Import after mocks
const {
  initCacheTable,
  generateCacheKey,
  getCachedContent,
  setCachedContent,
  deleteCachedContent,
  clearExpiredCache,
  clearCacheByType,
  getCacheStats,
  CACHE_TYPES,
} = require('../../main/db/AICacheManager');

describe('AICacheManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStmt.get.mockReset();
    mockStmt.all.mockReset();
    mockStmt.run.mockReset();
  });

  describe('initCacheTable', () => {
    it('should create cache table and index', () => {
      const result = initCacheTable();

      expect(result).toBe(true);
      expect(mockDb.exec).toHaveBeenCalledTimes(2);
      expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS'));
      expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE INDEX IF NOT EXISTS'));
    });

    it('should handle errors gracefully', () => {
      mockDb.exec.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = initCacheTable();

      expect(result).toBe(false);
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent keys for same input', () => {
      const params = { front: 'hello', back: 'world', hintType: 'association' };

      const key1 = generateCacheKey('hint', params);
      const key2 = generateCacheKey('hint', params);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^hint_/);
    });

    it('should generate different keys for different inputs', () => {
      const params1 = { front: 'hello', back: 'world' };
      const params2 = { front: 'foo', back: 'bar' };

      const key1 = generateCacheKey('hint', params1);
      const key2 = generateCacheKey('hint', params2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different types', () => {
      const params = { text: 'hello' };

      const key1 = generateCacheKey('hint', params);
      const key2 = generateCacheKey('pronunciation', params);

      expect(key1).not.toBe(key2);
    });
  });

  describe('getCachedContent', () => {
    it('should return null when cache is empty', () => {
      mockStmt.get.mockReturnValue(null);

      const result = getCachedContent('hint', 'test-key');

      expect(result).toBeNull();
    });

    it('should return cached content when found', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 86400000); // +1 day

      mockStmt.get.mockReturnValue({
        id: 1,
        cache_type: 'hint',
        cache_key: 'test-key',
        content: '"This is a hint"',
        metadata: null,
        expires_at: future.toISOString(),
        created_at: now.toISOString(),
      });

      const result = getCachedContent('hint', 'test-key');

      expect(result).not.toBeNull();
      expect(result.content).toBe('This is a hint');
      expect(result.cacheType).toBe('hint');
      expect(result.cacheKey).toBe('test-key');
    });

    it('should parse JSON content', () => {
      mockStmt.get.mockReturnValue({
        id: 1,
        cache_type: 'pronunciation',
        cache_key: 'test-key',
        content: JSON.stringify({ text: 'hello', language: 'en-US' }),
        metadata: JSON.stringify({ source: 'tts' }),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      });

      const result = getCachedContent('pronunciation', 'test-key');

      expect(result.content).toEqual({ text: 'hello', language: 'en-US' });
      expect(result.metadata).toEqual({ source: 'tts' });
    });

    it('should return null and delete expired content', () => {
      const past = new Date(Date.now() - 86400000); // -1 day

      mockStmt.get.mockReturnValue({
        id: 1,
        cache_type: 'hint',
        cache_key: 'test-key',
        content: '"Expired hint"',
        metadata: null,
        expires_at: past.toISOString(),
        created_at: new Date().toISOString(),
      });

      const result = getCachedContent('hint', 'test-key');

      expect(result).toBeNull();
      // Should have called delete
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM ai_cache'));
    });

    it('should filter by user when token provided', () => {
      mockStmt.get.mockReturnValue(null);

      getCachedContent('hint', 'test-key', 'valid-token');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('user_id'));
    });
  });

  describe('setCachedContent', () => {
    it('should store content in cache', () => {
      const result = setCachedContent('hint', 'test-key', 'This is a hint');

      expect(result.success).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE'));
      expect(mockStmt.run).toHaveBeenCalled();
    });

    it('should stringify object content', () => {
      const content = { text: 'hello', type: 'tts' };

      setCachedContent('pronunciation', 'test-key', content);

      expect(mockStmt.run).toHaveBeenCalledWith(
        'pronunciation',
        'test-key',
        JSON.stringify(content),
        null, // metadata
        expect.any(String), // expires_at
        expect.any(String), // created_at
        null // user_id
      );
    });

    it('should store metadata when provided', () => {
      const metadata = { hintType: 'association', itemFront: 'test' };

      setCachedContent('hint', 'test-key', 'content', { metadata });

      expect(mockStmt.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        JSON.stringify(metadata),
        expect.any(String),
        expect.any(String),
        null
      );
    });

    it('should set user_id when token provided', () => {
      setCachedContent('hint', 'test-key', 'content', { token: 'valid-token' });

      expect(mockStmt.run).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        null,
        expect.any(String),
        expect.any(String),
        1 // user_id from valid-token
      );
    });

    it('should handle custom expiry days', () => {
      // This tests that the expiry calculation works
      setCachedContent('hint', 'test-key', 'content', { expiryDays: 90 });

      expect(mockStmt.run).toHaveBeenCalled();
      const expiresAt = mockStmt.run.mock.calls[0][4];
      const expiryDate = new Date(expiresAt);
      const now = new Date();
      const diffDays = Math.round((expiryDate - now) / (1000 * 60 * 60 * 24));

      expect(diffDays).toBeGreaterThanOrEqual(89);
      expect(diffDays).toBeLessThanOrEqual(91);
    });

    it('should handle errors gracefully', () => {
      mockStmt.run.mockImplementationOnce(() => {
        throw new Error('Database error');
      });

      const result = setCachedContent('hint', 'test-key', 'content');

      expect(result.error).toBeDefined();
    });
  });

  describe('deleteCachedContent', () => {
    it('should delete cached content', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      const result = deleteCachedContent('hint', 'test-key');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(1);
    });

    it('should filter by user when token provided', () => {
      mockStmt.run.mockReturnValue({ changes: 1 });

      deleteCachedContent('hint', 'test-key', 'valid-token');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('user_id = ?'));
    });

    it('should handle non-existent content', () => {
      mockStmt.run.mockReturnValue({ changes: 0 });

      const result = deleteCachedContent('hint', 'non-existent');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(0);
    });
  });

  describe('clearExpiredCache', () => {
    it('should delete all expired entries', () => {
      mockStmt.run.mockReturnValue({ changes: 5 });

      const result = clearExpiredCache();

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(5);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('expires_at'));
    });
  });

  describe('clearCacheByType', () => {
    it('should clear all cache of a type', () => {
      mockStmt.run.mockReturnValue({ changes: 10 });

      const result = clearCacheByType('hint');

      expect(result.success).toBe(true);
      expect(result.deleted).toBe(10);
    });

    it('should filter by user when token provided', () => {
      mockStmt.run.mockReturnValue({ changes: 5 });

      clearCacheByType('hint', 'valid-token');

      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('user_id = ?'));
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      mockStmt.all.mockReturnValue([
        { cache_type: 'hint', count: 10, total_size: 1024 },
        { cache_type: 'pronunciation', count: 5, total_size: 2048 },
      ]);

      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(15);
      expect(stats.totalSize).toBe(3072);
      expect(stats.byType.hint.count).toBe(10);
      expect(stats.byType.pronunciation.count).toBe(5);
    });

    it('should handle empty cache', () => {
      mockStmt.all.mockReturnValue([]);

      const stats = getCacheStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('CACHE_TYPES', () => {
    it('should have all expected cache types', () => {
      expect(CACHE_TYPES.HINT).toBe('hint');
      expect(CACHE_TYPES.PRONUNCIATION).toBe('pronunciation');
      expect(CACHE_TYPES.EXPLANATION).toBe('explanation');
      expect(CACHE_TYPES.AUDIO).toBe('audio');
      expect(CACHE_TYPES.TTS).toBe('tts');
    });
  });
});
