/**
 * ConsolidatedMemoryManager.js
 *
 * Database manager for consolidated memories - LLM-synthesized learning summaries
 * that replace raw episodes after consolidation.
 *
 * Memory Types:
 * - concept_session: Learning session for a specific concept
 * - daily: Daily learning summary across all concepts
 * - weekly: Weekly learning summary
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Initialize consolidated_memory table if not exists
 */
export const initConsolidatedMemoryTable = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS "consolidated_memory" (
        "id" TEXT PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "concept_id" TEXT,
        "concept_name" TEXT,
        "memory_type" TEXT NOT NULL,
        "period_start" TEXT NOT NULL,
        "period_end" TEXT NOT NULL,
        "episode_count" INTEGER NOT NULL,
        "summary" TEXT NOT NULL,
        "insights" TEXT,
        "learning_process" TEXT,
        "metrics" TEXT,
        "source_episodes" TEXT,
        "mastery_assessment" TEXT,
        "learning_style" TEXT,
        "recommendations" TEXT,
        "created_at" TEXT NOT NULL,
        "expires_at" TEXT,
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `);

    // Create indexes for faster lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS "idx_consolidated_memory_user_period"
        ON "consolidated_memory"("user_id", "period_start");
      CREATE INDEX IF NOT EXISTS "idx_consolidated_memory_concept"
        ON "consolidated_memory"("concept_id");
      CREATE INDEX IF NOT EXISTS "idx_consolidated_memory_type"
        ON "consolidated_memory"("memory_type");
    `);

    console.log('Consolidated memory table initialized');
    return true;
  } catch (err) {
    console.error('Error initializing consolidated memory table:', err);
    return false;
  }
};

/**
 * Generate unique ID for consolidated memory
 */
const generateMemoryId = () => {
  return `cm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create a new consolidated memory
 * @param {Object} memory - Memory data
 * @param {string} memory.conceptId - Optional concept ID
 * @param {string} memory.conceptName - Concept/topic name
 * @param {string} memory.memoryType - Type: 'concept_session', 'daily', 'weekly'
 * @param {string} memory.periodStart - ISO date string
 * @param {string} memory.periodEnd - ISO date string
 * @param {number} memory.episodeCount - Number of episodes consolidated
 * @param {string} memory.summary - Main LLM-generated summary
 * @param {Array} memory.insights - Key patterns discovered
 * @param {Object} memory.learningProcess - Learning process analysis
 * @param {Object} memory.metrics - Metrics (accuracy, reviewCount, etc.)
 * @param {Array} memory.sourceEpisodes - Array of source episode IDs
 * @param {string} memory.masteryAssessment - beginner/developing/proficient/mastered
 * @param {string} memory.learningStyle - quick/steady/needs-repetition/variable
 * @param {Array} memory.recommendations - Actionable suggestions
 * @param {string} token - User token
 * @returns {Object} Created memory or error
 */
export const createConsolidatedMemory = (memory, token) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid token' };
    }

    const id = memory.id || generateMemoryId();
    const now = new Date();
    const createdAt = dateToSQLiteString(now);

    // Default expiry: 365 days for consolidated memories
    const expiresAt = memory.expiresAt
      ? dateToSQLiteString(new Date(memory.expiresAt))
      : dateToSQLiteString(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000));

    const stmt = db.prepare(`
      INSERT INTO consolidated_memory (
        id, user_id, concept_id, concept_name, memory_type,
        period_start, period_end, episode_count, summary,
        insights, learning_process, metrics, source_episodes,
        mastery_assessment, learning_style, recommendations,
        created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      userId,
      memory.conceptId || null,
      memory.conceptName || null,
      memory.memoryType,
      memory.periodStart,
      memory.periodEnd,
      memory.episodeCount,
      memory.summary,
      typeof memory.insights === 'string' ? memory.insights : JSON.stringify(memory.insights || []),
      typeof memory.learningProcess === 'string' ? memory.learningProcess : JSON.stringify(memory.learningProcess || {}),
      typeof memory.metrics === 'string' ? memory.metrics : JSON.stringify(memory.metrics || {}),
      typeof memory.sourceEpisodes === 'string' ? memory.sourceEpisodes : JSON.stringify(memory.sourceEpisodes || []),
      memory.masteryAssessment || null,
      memory.learningStyle || null,
      typeof memory.recommendations === 'string' ? memory.recommendations : JSON.stringify(memory.recommendations || []),
      createdAt,
      expiresAt
    );

    return {
      success: true,
      memory: {
        id,
        userId,
        ...memory,
        createdAt: now,
        expiresAt: new Date(expiresAt),
      },
    };
  } catch (err) {
    console.error('Error creating consolidated memory:', err);
    return { error: err.message };
  }
};

/**
 * Get consolidated memories with filters
 * @param {Object} options - Filter options
 * @param {string} options.token - User token (required)
 * @param {string} options.conceptId - Filter by concept ID
 * @param {string} options.conceptName - Filter by concept name
 * @param {string} options.memoryType - Filter by memory type
 * @param {string} options.startDate - Filter by period_start >= startDate
 * @param {string} options.endDate - Filter by period_end <= endDate
 * @param {number} options.limit - Max results (default 50)
 * @param {number} options.offset - Offset for pagination
 * @returns {Array} Array of consolidated memories
 */
export const getConsolidatedMemories = (options = {}) => {
  const {
    token,
    conceptId,
    conceptName,
    memoryType,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return [];
    }

    let query = 'SELECT * FROM consolidated_memory WHERE user_id = ?';
    const params = [userId];

    if (conceptId) {
      query += ' AND concept_id = ?';
      params.push(conceptId);
    }

    if (conceptName) {
      query += ' AND concept_name LIKE ?';
      params.push(`%${conceptName}%`);
    }

    if (memoryType) {
      query += ' AND memory_type = ?';
      params.push(memoryType);
    }

    if (startDate) {
      query += ' AND period_start >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND period_end <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY period_end DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => parseMemoryRow(row));
  } catch (err) {
    console.error('Error getting consolidated memories:', err);
    return [];
  }
};

/**
 * Get a single consolidated memory by ID
 * @param {string} id - Memory ID
 * @param {string} token - User token
 * @returns {Object|null} Memory object or null
 */
export const getMemoryById = (id, token) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return null;
    }

    const stmt = db.prepare(`
      SELECT * FROM consolidated_memory
      WHERE id = ? AND user_id = ?
    `);
    const row = stmt.get(id, userId);

    if (!row) return null;

    return parseMemoryRow(row);
  } catch (err) {
    console.error('Error getting memory by ID:', err);
    return null;
  }
};

/**
 * Update a consolidated memory
 * @param {string} id - Memory ID
 * @param {Object} updates - Fields to update
 * @param {string} token - User token
 * @returns {Object} Result with success/error
 */
export const updateConsolidatedMemory = (id, updates, token) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid token' };
    }

    const allowedFields = [
      'summary', 'insights', 'learning_process', 'metrics',
      'mastery_assessment', 'learning_style', 'recommendations', 'expires_at'
    ];

    const setClauses = [];
    const params = [];

    Object.entries(updates).forEach(([key, value]) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = ?`);
        if (typeof value === 'object' && value !== null) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    });

    if (setClauses.length === 0) {
      return { error: 'No valid fields to update' };
    }

    params.push(id, userId);

    const stmt = db.prepare(`
      UPDATE consolidated_memory
      SET ${setClauses.join(', ')}
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(...params);

    return { success: true, updated: result.changes };
  } catch (err) {
    console.error('Error updating consolidated memory:', err);
    return { error: err.message };
  }
};

/**
 * Delete a consolidated memory
 * @param {string} id - Memory ID
 * @param {string} token - User token
 * @returns {Object} Result with success/error
 */
export const deleteConsolidatedMemory = (id, token) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid token' };
    }

    const stmt = db.prepare(`
      DELETE FROM consolidated_memory
      WHERE id = ? AND user_id = ?
    `);
    const result = stmt.run(id, userId);

    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('Error deleting consolidated memory:', err);
    return { error: err.message };
  }
};

/**
 * Delete old/expired memories
 * @param {number} olderThanDays - Delete memories older than this many days
 * @param {string} token - User token
 * @returns {Object} Result with count of deleted memories
 */
export const deleteOldMemories = (olderThanDays, token) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid token' };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffStr = dateToSQLiteString(cutoffDate);

    const stmt = db.prepare(`
      DELETE FROM consolidated_memory
      WHERE user_id = ? AND created_at < ?
    `);
    const result = stmt.run(userId, cutoffStr);

    console.log(`Deleted ${result.changes} old consolidated memories`);
    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('Error deleting old memories:', err);
    return { error: err.message };
  }
};

/**
 * Clear expired memories (based on expires_at field)
 * @returns {Object} Result with count of deleted memories
 */
export const clearExpiredMemories = () => {
  try {
    const now = dateToSQLiteString(new Date());
    const stmt = db.prepare(`
      DELETE FROM consolidated_memory
      WHERE expires_at IS NOT NULL AND expires_at < ?
    `);
    const result = stmt.run(now);

    console.log(`Cleared ${result.changes} expired consolidated memories`);
    return { success: true, deleted: result.changes };
  } catch (err) {
    console.error('Error clearing expired memories:', err);
    return { error: err.message };
  }
};

/**
 * Get consolidation statistics
 * @param {string} token - User token
 * @returns {Object} Consolidation statistics
 */
export const getConsolidationStats = (token) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { error: 'Invalid token' };
    }

    // Total memories by type
    const typeStmt = db.prepare(`
      SELECT memory_type, COUNT(*) as count, SUM(episode_count) as total_episodes
      FROM consolidated_memory
      WHERE user_id = ?
      GROUP BY memory_type
    `);
    const typeRows = typeStmt.all(userId);

    // Total unique concepts
    const conceptStmt = db.prepare(`
      SELECT COUNT(DISTINCT concept_id) as unique_concepts
      FROM consolidated_memory
      WHERE user_id = ? AND concept_id IS NOT NULL
    `);
    const conceptRow = conceptStmt.get(userId);

    // Recent consolidations (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    const recentStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM consolidated_memory
      WHERE user_id = ? AND created_at >= ?
    `);
    const recentRow = recentStmt.get(userId, dateToSQLiteString(recentDate));

    // Mastery distribution
    const masteryStmt = db.prepare(`
      SELECT mastery_assessment, COUNT(*) as count
      FROM consolidated_memory
      WHERE user_id = ? AND mastery_assessment IS NOT NULL
      GROUP BY mastery_assessment
    `);
    const masteryRows = masteryStmt.all(userId);

    const stats = {
      byType: {},
      totalMemories: 0,
      totalEpisodesConsolidated: 0,
      uniqueConcepts: conceptRow?.unique_concepts || 0,
      recentConsolidations: recentRow?.count || 0,
      masteryDistribution: {},
    };

    typeRows.forEach(row => {
      stats.byType[row.memory_type] = {
        count: row.count,
        totalEpisodes: row.total_episodes || 0,
      };
      stats.totalMemories += row.count;
      stats.totalEpisodesConsolidated += row.total_episodes || 0;
    });

    masteryRows.forEach(row => {
      stats.masteryDistribution[row.mastery_assessment] = row.count;
    });

    return stats;
  } catch (err) {
    console.error('Error getting consolidation stats:', err);
    return {
      byType: {},
      totalMemories: 0,
      totalEpisodesConsolidated: 0,
      uniqueConcepts: 0,
      recentConsolidations: 0,
      masteryDistribution: {},
    };
  }
};

/**
 * Get memories for a specific concept
 * @param {string} conceptId - Concept ID
 * @param {string} token - User token
 * @param {number} limit - Max results
 * @returns {Array} Array of memories for the concept
 */
export const getMemoriesForConcept = (conceptId, token, limit = 20) => {
  return getConsolidatedMemories({
    token,
    conceptId,
    limit,
  });
};

/**
 * Search memories by summary content
 * @param {string} searchQuery - Search text
 * @param {string} token - User token
 * @param {number} limit - Max results
 * @returns {Array} Matching memories
 */
export const searchMemories = (searchQuery, token, limit = 20) => {
  try {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return [];
    }

    const stmt = db.prepare(`
      SELECT * FROM consolidated_memory
      WHERE user_id = ?
        AND (summary LIKE ? OR concept_name LIKE ? OR insights LIKE ?)
      ORDER BY period_end DESC
      LIMIT ?
    `);

    const searchPattern = `%${searchQuery}%`;
    const rows = stmt.all(userId, searchPattern, searchPattern, searchPattern, limit);

    return rows.map(row => parseMemoryRow(row));
  } catch (err) {
    console.error('Error searching memories:', err);
    return [];
  }
};

/**
 * Parse a database row into a memory object
 * @param {Object} row - Database row
 * @returns {Object} Parsed memory object
 */
function parseMemoryRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    conceptId: row.concept_id,
    conceptName: row.concept_name,
    memoryType: row.memory_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    episodeCount: row.episode_count,
    summary: row.summary,
    insights: safeJsonParse(row.insights, []),
    learningProcess: safeJsonParse(row.learning_process, {}),
    metrics: safeJsonParse(row.metrics, {}),
    sourceEpisodes: safeJsonParse(row.source_episodes, []),
    masteryAssessment: row.mastery_assessment,
    learningStyle: row.learning_style,
    recommendations: safeJsonParse(row.recommendations, []),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Safely parse JSON string
 * @param {string} jsonStr - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed value or default
 */
function safeJsonParse(jsonStr, defaultValue) {
  if (!jsonStr) return defaultValue;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return defaultValue;
  }
}

// Memory type constants
export const MEMORY_TYPES = {
  CONCEPT_SESSION: 'concept_session',
  DAILY: 'daily',
  WEEKLY: 'weekly',
};

// Mastery assessment constants
export const MASTERY_LEVELS = {
  BEGINNER: 'beginner',
  DEVELOPING: 'developing',
  PROFICIENT: 'proficient',
  MASTERED: 'mastered',
};

// Learning style constants
export const LEARNING_STYLES = {
  QUICK: 'quick',
  STEADY: 'steady',
  NEEDS_REPETITION: 'needs-repetition',
  VARIABLE: 'variable',
};

export default {
  initConsolidatedMemoryTable,
  createConsolidatedMemory,
  getConsolidatedMemories,
  getMemoryById,
  updateConsolidatedMemory,
  deleteConsolidatedMemory,
  deleteOldMemories,
  clearExpiredMemories,
  getConsolidationStats,
  getMemoriesForConcept,
  searchMemories,
  MEMORY_TYPES,
  MASTERY_LEVELS,
  LEARNING_STYLES,
};
