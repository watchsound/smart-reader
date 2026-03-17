/**
 * LearnerProfileManager.js
 *
 * Database manager for learner_profile and learner_domain_profile tables.
 * Handles CRUD operations for learner profiles in the AI Learning Companion.
 *
 * Table Schemas:
 *
 * CREATE TABLE "learner_profile" (
 *   "id" INTEGER PRIMARY KEY AUTOINCREMENT,
 *   "user_id" INTEGER NOT NULL UNIQUE,
 *   "global_profile" TEXT NOT NULL,
 *   "created_at" TEXT NOT NULL,
 *   "updated_at" TEXT
 * );
 *
 * CREATE TABLE "learner_domain_profile" (
 *   "id" INTEGER PRIMARY KEY AUTOINCREMENT,
 *   "user_id" INTEGER NOT NULL,
 *   "domain_type" TEXT NOT NULL,
 *   "domain_name" TEXT,
 *   "profile_data" TEXT NOT NULL,
 *   "created_at" TEXT NOT NULL,
 *   "updated_at" TEXT,
 *   UNIQUE("user_id", "domain_type")
 * );
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Initialize tables if they don't exist
 */
const initializeTables = () => {
  try {
    // Create learner_profile table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "learner_profile" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL UNIQUE,
        "global_profile" TEXT NOT NULL,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT,
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `).run();

    // Create learner_domain_profile table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "learner_domain_profile" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "user_id" INTEGER NOT NULL,
        "domain_type" TEXT NOT NULL,
        "domain_name" TEXT,
        "profile_data" TEXT NOT NULL,
        "created_at" TEXT NOT NULL,
        "updated_at" TEXT,
        UNIQUE("user_id", "domain_type"),
        FOREIGN KEY ("user_id") REFERENCES "user"("id")
      )
    `).run();

    // Create indexes
    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_learner_domain_profile_user"
      ON "learner_domain_profile"("user_id", "domain_type")
    `).run();
  } catch (error) {
    console.error('Error initializing learner profile tables:', error);
  }
};

// Initialize tables on module load
initializeTables();

/**
 * Default global profile for new users
 */
const DEFAULT_GLOBAL_PROFILE = {
  learningStyle: 'mixed',
  learningStyleScores: {
    visual: 0.25,
    reading: 0.25,
    hands_on: 0.25,
    auditory: 0.25,
  },
  preferredTimeOfDay: 'any',
  optimalSessionLength: 15,
  sessionLengthPreference: 'adaptive',
  averageLearningVelocity: 10,
  consistencyScore: 0.5,
  streakRecord: 0,
  averageRetentionRate: 0.7,
  optimalReviewInterval: 3,
  forgettingCurveSlope: 0.5,
  averageSessionsPerWeek: 0,
  preferredDays: [],
  engagementTrend: 'stable',
  performsWellWith: [],
  strugglesWidth: [],
  motivationalTriggers: [],
  aiInsights: [],
  lastAnalyzedAt: null,
};

/**
 * Default domain profile template
 */
const DEFAULT_DOMAIN_PROFILE = {
  proficiencyLevel: 'novice',
  estimatedProficiencyScore: 0,
  totalItemsLearned: 0,
  totalItemsMastered: 0,
  averageMasteryLevel: 0,
  itemsPerSession: 0,
  averageTimePerItem: 0,
  learningVelocityTrend: 'stable',
  overallAccuracy: 0,
  recentAccuracy: 0,
  accuracyTrend: 'stable',
  retentionRate: 0.7,
  optimalReviewIntervals: [1, 3, 7, 14, 30],
  currentDifficultyLevel: 'beginner',
  difficultyAdjustmentNeeded: 'maintain',
  weakAreas: [],
  strongAreas: [],
  contentTypePerformance: {},
  assessmentTypePerformance: {},
  totalTimeSpentMinutes: 0,
  averageSessionMinutes: 0,
  currentGoals: [],
  aiInsights: [],
  suggestedFocus: [],
  lastStudiedAt: null,
  lastAnalyzedAt: null,
};

/**
 * Convert database row to global profile object
 */
const rowToGlobalProfile = (row) => {
  if (!row) return null;

  let globalProfile = DEFAULT_GLOBAL_PROFILE;
  try {
    globalProfile = row.global_profile
      ? JSON.parse(row.global_profile)
      : DEFAULT_GLOBAL_PROFILE;
  } catch (e) {
    console.error('Error parsing global_profile:', e);
  }

  return {
    id: row.id,
    userId: row.user_id,
    globalProfile,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

/**
 * Convert database row to domain profile object
 */
const rowToDomainProfile = (row) => {
  if (!row) return null;

  let profileData = { ...DEFAULT_DOMAIN_PROFILE };
  try {
    if (row.profile_data) {
      profileData = { ...DEFAULT_DOMAIN_PROFILE, ...JSON.parse(row.profile_data) };
    }
  } catch (e) {
    console.error('Error parsing domain profile_data:', e);
  }

  return {
    id: row.id,
    userId: row.user_id,
    domainType: row.domain_type,
    domainName: row.domain_name || null,
    ...profileData,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
};

// =============================================================================
// GLOBAL PROFILE OPERATIONS
// =============================================================================

/**
 * Get global learner profile
 * @param {string} token - User token
 * @returns {Object|null} Global profile
 */
export const getGlobalProfile = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getGlobalProfile: invalid session');
    return null;
  }

  try {
    const stmt = db.prepare('SELECT * FROM learner_profile WHERE user_id = ?');
    const row = stmt.get(userId);

    if (!row) {
      // Auto-create profile for new users
      return createGlobalProfile(token);
    }

    return rowToGlobalProfile(row);
  } catch (err) {
    console.error('getGlobalProfile error:', err);
    return null;
  }
};

/**
 * Create global learner profile
 * @param {string} token - User token
 * @param {Object} initialProfile - Initial profile data (optional)
 * @returns {Object} Created profile
 */
export const createGlobalProfile = (token, initialProfile = null) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('createGlobalProfile: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const now = dateToSQLiteString(new Date());
    const profile = initialProfile || DEFAULT_GLOBAL_PROFILE;
    const profileJson = JSON.stringify(profile);

    const stmt = db.prepare(`
      INSERT INTO learner_profile (user_id, global_profile, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        global_profile = excluded.global_profile,
        updated_at = excluded.updated_at
    `);

    stmt.run(userId, profileJson, now, null);

    return getGlobalProfile(token);
  } catch (err) {
    console.error('createGlobalProfile error:', err);
    return { error: err.message };
  }
};

/**
 * Update global learner profile
 * @param {Object} updates - Profile updates
 * @param {string} token - User token
 * @returns {Object} Updated profile
 */
export const updateGlobalProfile = (updates, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('updateGlobalProfile: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    // Get existing profile
    const existing = getGlobalProfile(token);
    if (!existing || existing.error) {
      // Create if doesn't exist
      return createGlobalProfile(token, { ...DEFAULT_GLOBAL_PROFILE, ...updates });
    }

    // Merge updates
    const updatedProfile = {
      ...existing.globalProfile,
      ...updates,
    };

    // Handle nested objects
    if (updates.learningStyleScores) {
      updatedProfile.learningStyleScores = {
        ...existing.globalProfile.learningStyleScores,
        ...updates.learningStyleScores,
      };
    }

    const now = dateToSQLiteString(new Date());
    const profileJson = JSON.stringify(updatedProfile);

    const stmt = db.prepare(`
      UPDATE learner_profile
      SET global_profile = ?, updated_at = ?
      WHERE user_id = ?
    `);

    stmt.run(profileJson, now, userId);

    return getGlobalProfile(token);
  } catch (err) {
    console.error('updateGlobalProfile error:', err);
    return { error: err.message };
  }
};

// =============================================================================
// DOMAIN PROFILE OPERATIONS
// =============================================================================

/**
 * Get domain profile
 * @param {string} domainType - Domain type
 * @param {string} token - User token
 * @returns {Object|null} Domain profile
 */
export const getDomainProfile = (domainType, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getDomainProfile: invalid session');
    return null;
  }

  try {
    const stmt = db.prepare(`
      SELECT * FROM learner_domain_profile
      WHERE user_id = ? AND domain_type = ?
    `);
    const row = stmt.get(userId, domainType);

    if (!row) {
      // Auto-create profile for new domain
      return createDomainProfile(domainType, null, token);
    }

    return rowToDomainProfile(row);
  } catch (err) {
    console.error('getDomainProfile error:', err);
    return null;
  }
};

/**
 * Get all domain profiles for user
 * @param {string} token - User token
 * @returns {Array} Array of domain profiles
 */
export const getAllDomainProfiles = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('getAllDomainProfiles: invalid session');
    return [];
  }

  try {
    const stmt = db.prepare(`
      SELECT * FROM learner_domain_profile
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(userId);
    return rows.map(rowToDomainProfile);
  } catch (err) {
    console.error('getAllDomainProfiles error:', err);
    return [];
  }
};

/**
 * Create domain profile
 * @param {string} domainType - Domain type
 * @param {string} domainName - Optional domain name
 * @param {string} token - User token
 * @param {Object} initialData - Initial profile data (optional)
 * @returns {Object} Created profile
 */
export const createDomainProfile = (
  domainType,
  domainName = null,
  token,
  initialData = null,
) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('createDomainProfile: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const now = dateToSQLiteString(new Date());
    const profile = initialData || { ...DEFAULT_DOMAIN_PROFILE };
    const profileJson = JSON.stringify(profile);

    const stmt = db.prepare(`
      INSERT INTO learner_domain_profile (
        user_id, domain_type, domain_name, profile_data, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, domain_type) DO UPDATE SET
        domain_name = COALESCE(excluded.domain_name, domain_name),
        profile_data = excluded.profile_data,
        updated_at = excluded.updated_at
    `);

    stmt.run(userId, domainType, domainName, profileJson, now, null);

    return getDomainProfile(domainType, token);
  } catch (err) {
    console.error('createDomainProfile error:', err);
    return { error: err.message };
  }
};

/**
 * Update domain profile
 * @param {string} domainType - Domain type
 * @param {Object} updates - Profile updates
 * @param {string} token - User token
 * @returns {Object} Updated profile
 */
export const updateDomainProfile = (domainType, updates, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('updateDomainProfile: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    // Get existing profile
    const existing = getDomainProfile(domainType, token);
    if (!existing || existing.error) {
      // Create if doesn't exist
      return createDomainProfile(
        domainType,
        updates.domainName || null,
        token,
        { ...DEFAULT_DOMAIN_PROFILE, ...updates },
      );
    }

    // Extract the existing profile data (without id, userId, etc.)
    const {
      id,
      userId: uid,
      domainType: dt,
      createdAt,
      updatedAt,
      ...existingData
    } = existing;

    // Merge updates
    const updatedProfile = {
      ...existingData,
      ...updates,
    };

    const now = dateToSQLiteString(new Date());
    const profileJson = JSON.stringify(updatedProfile);

    const stmt = db.prepare(`
      UPDATE learner_domain_profile
      SET profile_data = ?,
          domain_name = COALESCE(?, domain_name),
          updated_at = ?
      WHERE user_id = ? AND domain_type = ?
    `);

    stmt.run(profileJson, updates.domainName || null, now, userId, domainType);

    return getDomainProfile(domainType, token);
  } catch (err) {
    console.error('updateDomainProfile error:', err);
    return { error: err.message };
  }
};

/**
 * Delete domain profile
 * @param {string} domainType - Domain type
 * @param {string} token - User token
 * @returns {Object} Success/error status
 */
export const deleteDomainProfile = (domainType, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.log('deleteDomainProfile: invalid session');
    return { error: 'Invalid session' };
  }

  try {
    const stmt = db.prepare(`
      DELETE FROM learner_domain_profile
      WHERE user_id = ? AND domain_type = ?
    `);
    const result = stmt.run(userId, domainType);
    return { success: result.changes > 0 };
  } catch (err) {
    console.error('deleteDomainProfile error:', err);
    return { error: err.message };
  }
};

// =============================================================================
// PROFILE ANALYSIS AND UPDATE HELPERS
// =============================================================================

/**
 * Update profile based on session results
 * @param {string} domainType - Domain type
 * @param {Object} sessionData - Session results
 * @param {string} token - User token
 * @returns {Object} Updated profiles
 */
export const updateProfileFromSession = (domainType, sessionData, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  try {
    // Get current profiles
    const globalProfile = getGlobalProfile(token);
    const domainProfile = getDomainProfile(domainType, token);

    if (!globalProfile || !domainProfile) {
      return { error: 'Could not load profiles' };
    }

    // Update domain profile metrics
    const {
      itemsReviewed = 0,
      itemsCorrect = 0,
      itemsNew = 0,
      durationMinutes = 0,
    } = sessionData;

    const accuracy =
      itemsReviewed > 0 ? itemsCorrect / itemsReviewed : domainProfile.overallAccuracy;

    // Calculate running averages
    const totalSessions =
      domainProfile.totalTimeSpentMinutes > 0
        ? domainProfile.totalTimeSpentMinutes / domainProfile.averageSessionMinutes
        : 0;
    const newTotalSessions = totalSessions + 1;

    const domainUpdates = {
      totalItemsLearned: domainProfile.totalItemsLearned + itemsNew,
      totalTimeSpentMinutes: domainProfile.totalTimeSpentMinutes + durationMinutes,
      averageSessionMinutes:
        (domainProfile.averageSessionMinutes * totalSessions + durationMinutes) /
        newTotalSessions,
      itemsPerSession:
        (domainProfile.itemsPerSession * totalSessions + itemsReviewed) /
        newTotalSessions,
      recentAccuracy: accuracy,
      lastStudiedAt: new Date().toISOString(),
    };

    // Update accuracy trend
    const oldAccuracy = domainProfile.overallAccuracy || 0;
    if (accuracy > oldAccuracy + 0.05) {
      domainUpdates.accuracyTrend = 'improving';
    } else if (accuracy < oldAccuracy - 0.05) {
      domainUpdates.accuracyTrend = 'declining';
    } else {
      domainUpdates.accuracyTrend = 'stable';
    }

    // Update overall accuracy (exponential moving average)
    domainUpdates.overallAccuracy = oldAccuracy * 0.8 + accuracy * 0.2;

    // Update global profile
    const globalUpdates = {
      averageLearningVelocity:
        (globalProfile.globalProfile.averageLearningVelocity * totalSessions +
          itemsReviewed) /
        newTotalSessions,
      averageSessionsPerWeek: globalProfile.globalProfile.averageSessionsPerWeek + 0.14, // rough daily estimate
    };

    // Apply updates
    const updatedDomain = updateDomainProfile(domainType, domainUpdates, token);
    const updatedGlobal = updateGlobalProfile(globalUpdates, token);

    return {
      success: true,
      globalProfile: updatedGlobal,
      domainProfile: updatedDomain,
    };
  } catch (err) {
    console.error('updateProfileFromSession error:', err);
    return { error: err.message };
  }
};

/**
 * Get full profile (global + all domains)
 * @param {string} token - User token
 * @returns {Object} Full profile
 */
export const getFullProfile = (token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    return { error: 'Invalid session' };
  }

  try {
    const globalProfile = getGlobalProfile(token);
    const domainProfiles = getAllDomainProfiles(token);

    return {
      success: true,
      userId,
      globalProfile: globalProfile?.globalProfile || DEFAULT_GLOBAL_PROFILE,
      domainProfiles,
      createdAt: globalProfile?.createdAt || new Date(),
      updatedAt: globalProfile?.updatedAt || null,
    };
  } catch (err) {
    console.error('getFullProfile error:', err);
    return { error: err.message };
  }
};

/**
 * Record weak area for a domain
 * @param {string} domainType - Domain type
 * @param {Object} weakArea - Weak area data
 * @param {string} token - User token
 * @returns {Object} Updated domain profile
 */
export const recordWeakArea = (domainType, weakArea, token) => {
  const profile = getDomainProfile(domainType, token);
  if (!profile || profile.error) {
    return { error: 'Domain profile not found' };
  }

  const existingWeakAreas = profile.weakAreas || [];

  // Check if area already exists
  const existingIndex = existingWeakAreas.findIndex(
    (w) => w.concept === weakArea.concept,
  );

  if (existingIndex >= 0) {
    // Update existing
    existingWeakAreas[existingIndex] = {
      ...existingWeakAreas[existingIndex],
      ...weakArea,
      reviewCount: existingWeakAreas[existingIndex].reviewCount + 1,
    };
  } else {
    // Add new
    existingWeakAreas.push({
      ...weakArea,
      reviewCount: 1,
    });
  }

  // Keep only top 10 weak areas
  const sortedWeakAreas = existingWeakAreas
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 10);

  return updateDomainProfile(domainType, { weakAreas: sortedWeakAreas }, token);
};

export default {
  // Global profile
  getGlobalProfile,
  createGlobalProfile,
  updateGlobalProfile,
  // Domain profile
  getDomainProfile,
  getAllDomainProfiles,
  createDomainProfile,
  updateDomainProfile,
  deleteDomainProfile,
  // Helpers
  updateProfileFromSession,
  getFullProfile,
  recordWeakArea,
};
