/**
 * AICacheManager.js
 *
 * Database manager for caching AI-generated content (hints, pronunciations, etc.)
 * Avoids repeated AI API calls for the same content.
 *
 * Cache Types:
 * - hint: AI-generated hints for learning points
 * - pronunciation: Audio pronunciation data (base64 or URL)
 * - explanation: AI explanations for concepts
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

// Cache expiry in days (default 30 days)
const DEFAULT_EXPIRY_DAYS = 30;

/**
 * Initialize cache table if not exists
 */
export const initCacheTable = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "ai_cache" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "cache_type" TEXT NOT NULL,
        "cache_key" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "metadata" TEXT,
        "expires_at" TEXT,
        "created_at" TEXT NOT NULL,
        "user_id" INTEGER,
        UNIQUE(cache_type, cache_key, user_id)
      )
    `);

    // Create index for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ai_cache_lookup
      ON ai_cache(cache_type, cache_key, user_id)
    `);

    console.log('AI cache table initialized');
    return true;
  } catch (err) {
    console.error('Error initializing AI cache table:', err);
    return false;
  }
};

/**
 * Generate a cache key from input parameters
 * @param {string} type - Cache type (hint, pronunciation, explanation)
 * @param {Object} params - Parameters to generate key from
 * @returns {string} Hash-like key
 */
export const generateCacheKey = (type, params) => {
  const str = JSON.stringify({ type, ...params });
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${type}_${Math.abs(hash).toString(36)}`;
};

/**
 * Get cached content
 * @param {string} cacheType - Type of cache (hint, pronunciation, explanation)
 * @param {string} cacheKey - Unique key for the cached item
 * @param {string} token - User token (optional for user-specific caching)
 * @returns {Object|null} Cached content or null if not found/expired
 */
export const getCachedContent = (cacheType, cacheKey, token = null) => {
  try {
    let query = `
      SELECT * FROM ai_cache
      WHERE cache_type = ? AND cache_key = ?
    `;
    const params = [cacheType, cacheKey];

    // If token provided, filter by user
    if (token) {
      const userId = getUserIdFromToken(token);
      if (userId >= 0) {
        query += ' AND (user_id = ? OR user_id IS NULL)';
        params.push(userId);
      }
    }

    query += ' ORDER BY created_at DESC LIMIT 1';

    const stmt = db.prepare(query);
    const row = stmt.get(...params);

    if (!row) return null;

    // Check expiry
    if (row.expires_at) {
      const expiryDate = new Date(row.expires_at);
      if (expiryDate < new Date()) {
        // Expired, delete and return null
        deleteCachedContent(cacheType, cacheKey, token);
        return null;
      }
    }

    // Parse content and metadata
    let content = row.content;
    try {
      content = JSON.parse(row.content);
    } catch (e) {
      // Content is plain text
    }

    let metadata = null;
    if (row.metadata) {
      try {
        metadata = JSON.parse(row.metadata);
      } catch (e) {
        metadata = row.metadata;
      }
    }

    return {
      id: row.id,
      cacheType: row.cache_type,
      cacheKey: row.cache_key,
      content,
      metadata,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    };
  } catch (err) {
    console.error('Error getting cached content:', err);
    return null;
  }
};

/**
 * Set cached content
 * @param {string} cacheType - Type of cache
 * @param {string} cacheKey - Unique key
 * @param {*} content - Content to cache (will be JSON stringified if object)
 * @param {Object} options - Additional options
 * @param {number} options.expiryDays - Days until expiry (default 30)
 * @param {Object} options.metadata - Additional metadata to store
 * @param {string} options.token - User token for user-specific caching
 * @returns {Object} Result with success/error
 */
export const setCachedContent = (cacheType, cacheKey, content, options = {}) => {
  const { expiryDays = DEFAULT_EXPIRY_DAYS, metadata = null, token = null } = options;

  try {
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    let userId = null;
    if (token) {
      userId = getUserIdFromToken(token);
      if (userId < 0) userId = null;
    }

    // Use INSERT OR REPLACE for upsert behavior
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO ai_cache (
        cache_type, cache_key, content, metadata, expires_at, created_at, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      cacheType,
      cacheKey,
      contentStr,
      metadataStr,
      dateToSQLiteString(expiresAt),
      dateToSQLiteString(now),
      userId
    );

    return { success: true };
  } catch (err) {
    console.error('Error setting cached content:', err);
    return { error: err.message };
  }
};

/**
 * Delete cached content
 * @param {string} cacheType - Type of cache
 * @param {string} cacheKey - Unique key
 * @param {string} token - User token (optional)
 * @returns {Object} Result with success/error
 */
export const deleteCachedContent = (cacheType, cacheKey, token = null) => {
  try {
    let query = 'DELETE FROM ai_cache WHERE cache_type = ? AND cache_key = ?';
    const params = [cacheType, cacheKey];

    if (token) {
      const userId = getUserIdFromToken(token);
      if (userId >= 0) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
    }

    const stmt = db.prepare(query);
    const result = stmt.run(...params);

    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('Error deleting cached content:', err);
    return { error: err.message };
  }
};

/**
 * Clear expired cache entries
 * @returns {Object} Result with count of deleted entries
 */
export const clearExpiredCache = () => {
  try {
    const now = dateToSQLiteString(new Date());
    const stmt = db.prepare(`
      DELETE FROM ai_cache WHERE expires_at IS NOT NULL AND expires_at < ?
    `);
    const result = stmt.run(now);

    console.log(`Cleared ${result.changes} expired cache entries`);
    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('Error clearing expired cache:', err);
    return { error: err.message };
  }
};

/**
 * Clear all cache of a specific type
 * @param {string} cacheType - Type of cache to clear
 * @param {string} token - User token (optional, clears only user's cache)
 * @returns {Object} Result with count of deleted entries
 */
export const clearCacheByType = (cacheType, token = null) => {
  try {
    let query = 'DELETE FROM ai_cache WHERE cache_type = ?';
    const params = [cacheType];

    if (token) {
      const userId = getUserIdFromToken(token);
      if (userId >= 0) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
    }

    const stmt = db.prepare(query);
    const result = stmt.run(...params);

    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('Error clearing cache by type:', err);
    return { error: err.message };
  }
};

/**
 * Get cache statistics
 * @param {string} token - User token (optional)
 * @returns {Object} Cache statistics
 */
export const getCacheStats = (token = null) => {
  try {
    let whereClause = '';
    const params = [];

    if (token) {
      const userId = getUserIdFromToken(token);
      if (userId >= 0) {
        whereClause = 'WHERE user_id = ? OR user_id IS NULL';
        params.push(userId);
      }
    }

    const stmt = db.prepare(`
      SELECT
        cache_type,
        COUNT(*) as count,
        SUM(LENGTH(content)) as total_size
      FROM ai_cache
      ${whereClause}
      GROUP BY cache_type
    `);

    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();

    const stats = {
      byType: {},
      totalEntries: 0,
      totalSize: 0,
    };

    rows.forEach(row => {
      stats.byType[row.cache_type] = {
        count: row.count,
        size: row.total_size || 0,
      };
      stats.totalEntries += row.count;
      stats.totalSize += row.total_size || 0;
    });

    return stats;
  } catch (err) {
    console.error('Error getting cache stats:', err);
    return { byType: {}, totalEntries: 0, totalSize: 0 };
  }
};

// Cache type constants
export const CACHE_TYPES = {
  HINT: 'hint',
  PRONUNCIATION: 'pronunciation',
  EXPLANATION: 'explanation',
  AUDIO: 'audio',
  TTS: 'tts',
};

export default {
  initCacheTable,
  generateCacheKey,
  getCachedContent,
  setCachedContent,
  deleteCachedContent,
  clearExpiredCache,
  clearCacheByType,
  getCacheStats,
  CACHE_TYPES,
};
