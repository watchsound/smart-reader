/**
 * learningHandlers.js
 *
 * IPC handlers for AI Learning Companion operations.
 * Handles learning topics, plans, sessions, and performance tracking.
 *
 * Naming convention: learning-{operation}-{entity}
 * Example: learning-create-topic, learning-get-topics
 */

import { ipcMain } from 'electron';
import {
  getLearningTopicById,
  getLearningTopics,
  getActiveTopics,
  getTopicsBySource,
  createLearningTopic,
  updateLearningTopic,
  deleteLearningTopic,
  updateTopicProgress,
  getTopicStatistics,
  countTopicsByStatus,
} from '../db/LearningTopicManager';
import {
  getLearningPlanById,
  getLearningPlanByTopic,
  getLearningPlans,
  createLearningPlan,
  updateLearningPlan,
  deleteLearningPlan,
  advancePlanDay,
  startPlan,
  pausePlan,
  resumePlan,
  getTodaysItems,
  updatePlanItem,
} from '../db/LearningPlanManager';
import {
  getLearningSessionById,
  getSessionsByTopic,
  getRecentSessions,
  startLearningSession,
  completeLearningSession,
  updateSessionProgress,
  deleteLearningSession,
  recordItemPerformance,
  getItemPerformanceHistory,
  getItemPerformanceSummary,
  getWeakItems,
  getMistakePatterns,
  getDailyActivity,
  getOverallStatistics,
} from '../db/LearningSessionManager';
import {
  getGlobalProfile,
  updateGlobalProfile,
  getDomainProfile,
  getAllDomainProfiles,
  updateDomainProfile,
  updateProfileFromSession,
  getFullProfile,
  recordWeakArea,
} from '../db/LearnerProfileManager';

/**
 * Register all learning-related IPC handlers
 * @param {Object} store - electron-store instance
 * @param {Object} services - Optional services (AI provider, etc.)
 */
export function registerLearningHandlers(store, services = {}) {
  // ===========================================================================
  // TOPIC OPERATIONS
  // ===========================================================================

  /**
   * Get a learning topic by ID
   */
  ipcMain.handle('learning-get-topic', async (event, id, token) => {
    try {
      const result = getLearningTopicById(id, token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-topic error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get all learning topics for the user
   */
  ipcMain.handle('learning-get-topics', async (event, token, options = {}) => {
    try {
      const result = getLearningTopics(token, options);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-topics error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get active learning topics (for dashboard)
   */
  ipcMain.handle('learning-get-active-topics', async (event, token) => {
    try {
      const result = getActiveTopics(token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-active-topics error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get topics by source (e.g., for a specific book)
   */
  ipcMain.handle(
    'learning-get-topics-by-source',
    async (event, sourceType, sourceId, token) => {
      try {
        const result = getTopicsBySource(sourceType, sourceId, token);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-topics-by-source error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Create a new learning topic
   */
  ipcMain.handle('learning-create-topic', async (event, topic, token) => {
    try {
      const result = createLearningTopic(topic, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-create-topic error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update a learning topic
   */
  ipcMain.handle(
    'learning-update-topic',
    async (event, id, updates, token) => {
      try {
        const result = updateLearningTopic(id, updates, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-topic error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Delete a learning topic
   */
  ipcMain.handle('learning-delete-topic', async (event, id, token) => {
    try {
      const result = deleteLearningTopic(id, token);
      return result;
    } catch (error) {
      console.error('learning-delete-topic error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update topic progress after a study session
   */
  ipcMain.handle(
    'learning-update-topic-progress',
    async (event, id, sessionResult, token) => {
      try {
        const result = updateTopicProgress(id, sessionResult, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-topic-progress error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get topic statistics
   */
  ipcMain.handle('learning-get-topic-stats', async (event, id, token) => {
    try {
      const result = getTopicStatistics(id, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-topic-stats error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Count topics by status
   */
  ipcMain.handle('learning-count-topics-by-status', async (event, token) => {
    try {
      const result = countTopicsByStatus(token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-count-topics-by-status error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // PLAN OPERATIONS
  // ===========================================================================

  /**
   * Get a learning plan by ID
   */
  ipcMain.handle('learning-get-plan', async (event, id, token) => {
    try {
      const result = getLearningPlanById(id, token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-plan error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get learning plan for a topic
   */
  ipcMain.handle('learning-get-plan-by-topic', async (event, topicId, token) => {
    try {
      const result = getLearningPlanByTopic(topicId, token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-plan-by-topic error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get all learning plans
   */
  ipcMain.handle('learning-get-plans', async (event, token, options = {}) => {
    try {
      const result = getLearningPlans(token, options);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-plans error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Create a learning plan
   */
  ipcMain.handle('learning-create-plan', async (event, plan, token) => {
    try {
      const result = createLearningPlan(plan, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-create-plan error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update a learning plan
   */
  ipcMain.handle(
    'learning-update-plan',
    async (event, id, updates, token) => {
      try {
        const result = updateLearningPlan(id, updates, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-plan error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Delete a learning plan
   */
  ipcMain.handle('learning-delete-plan', async (event, id, token) => {
    try {
      const result = deleteLearningPlan(id, token);
      return result;
    } catch (error) {
      console.error('learning-delete-plan error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Start a plan
   */
  ipcMain.handle('learning-start-plan', async (event, id, token) => {
    try {
      const result = startPlan(id, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-start-plan error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Pause a plan
   */
  ipcMain.handle('learning-pause-plan', async (event, id, token) => {
    try {
      const result = pausePlan(id, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-pause-plan error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Resume a plan
   */
  ipcMain.handle('learning-resume-plan', async (event, id, token) => {
    try {
      const result = resumePlan(id, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-resume-plan error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Advance plan to next day
   */
  ipcMain.handle('learning-advance-plan-day', async (event, id, token) => {
    try {
      const result = advancePlanDay(id, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-advance-plan-day error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get today's items from a plan
   */
  ipcMain.handle('learning-get-todays-items', async (event, id, token) => {
    try {
      const result = getTodaysItems(id, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-todays-items error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update an item in a plan
   */
  ipcMain.handle(
    'learning-update-plan-item',
    async (event, planId, itemId, itemUpdate, token) => {
      try {
        const result = updatePlanItem(planId, itemId, itemUpdate, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-plan-item error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // ===========================================================================
  // SESSION OPERATIONS
  // ===========================================================================

  /**
   * Get a learning session by ID
   */
  ipcMain.handle('learning-get-session', async (event, id, token) => {
    try {
      const result = getLearningSessionById(id, token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-session error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get sessions for a topic
   */
  ipcMain.handle(
    'learning-get-sessions-by-topic',
    async (event, topicId, token, options = {}) => {
      try {
        const result = getSessionsByTopic(topicId, token, options);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-sessions-by-topic error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get recent sessions
   */
  ipcMain.handle(
    'learning-get-recent-sessions',
    async (event, token, days = 7) => {
      try {
        const result = getRecentSessions(token, days);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-recent-sessions error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Start a learning session
   */
  ipcMain.handle('learning-start-session', async (event, session, token) => {
    try {
      const result = startLearningSession(session, token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-start-session error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Complete a learning session
   */
  ipcMain.handle(
    'learning-complete-session',
    async (event, id, results, token) => {
      try {
        const result = completeLearningSession(id, results, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-complete-session error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Update session progress
   */
  ipcMain.handle(
    'learning-update-session-progress',
    async (event, id, updates, token) => {
      try {
        const result = updateSessionProgress(id, updates, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-session-progress error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Delete a learning session
   */
  ipcMain.handle('learning-delete-session', async (event, id, token) => {
    try {
      const result = deleteLearningSession(id, token);
      return result;
    } catch (error) {
      console.error('learning-delete-session error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // PERFORMANCE OPERATIONS
  // ===========================================================================

  /**
   * Record item performance
   */
  ipcMain.handle(
    'learning-record-performance',
    async (event, performance, token) => {
      try {
        const result = recordItemPerformance(performance, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-record-performance error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get item performance history
   */
  ipcMain.handle(
    'learning-get-item-history',
    async (event, topicId, itemId, token, options = {}) => {
      try {
        const result = getItemPerformanceHistory(
          topicId,
          itemId,
          token,
          options,
        );
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-item-history error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get item performance summary
   */
  ipcMain.handle(
    'learning-get-item-summary',
    async (event, topicId, itemId, token) => {
      try {
        const result = getItemPerformanceSummary(topicId, itemId, token);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-item-summary error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get weak items for a topic
   */
  ipcMain.handle(
    'learning-get-weak-items',
    async (event, topicId, token, limit = 10) => {
      try {
        const result = getWeakItems(topicId, token, limit);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-weak-items error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get mistake patterns for a topic
   */
  ipcMain.handle(
    'learning-get-mistake-patterns',
    async (event, topicId, token) => {
      try {
        const result = getMistakePatterns(topicId, token);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-mistake-patterns error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  // ===========================================================================
  // STATISTICS OPERATIONS
  // ===========================================================================

  /**
   * Get daily activity
   */
  ipcMain.handle(
    'learning-get-daily-activity',
    async (event, token, days = 30) => {
      try {
        const result = getDailyActivity(token, days);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-daily-activity error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get overall statistics
   */
  ipcMain.handle('learning-get-overall-stats', async (event, token) => {
    try {
      const result = getOverallStatistics(token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-overall-stats error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // PROFILE OPERATIONS
  // ===========================================================================

  /**
   * Get global learner profile
   */
  ipcMain.handle('learning-get-global-profile', async (event, token) => {
    try {
      const result = getGlobalProfile(token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-global-profile error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update global learner profile
   */
  ipcMain.handle(
    'learning-update-global-profile',
    async (event, updates, token) => {
      try {
        const result = updateGlobalProfile(updates, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-global-profile error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get domain profile
   */
  ipcMain.handle(
    'learning-get-domain-profile',
    async (event, domainType, token) => {
      try {
        const result = getDomainProfile(domainType, token);
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-get-domain-profile error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get all domain profiles
   */
  ipcMain.handle('learning-get-all-domain-profiles', async (event, token) => {
    try {
      const result = getAllDomainProfiles(token);
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-all-domain-profiles error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update domain profile
   */
  ipcMain.handle(
    'learning-update-domain-profile',
    async (event, domainType, updates, token) => {
      try {
        const result = updateDomainProfile(domainType, updates, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-domain-profile error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Get full profile (global + all domains)
   */
  ipcMain.handle('learning-get-full-profile', async (event, token) => {
    try {
      const result = getFullProfile(token);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('learning-get-full-profile error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Update profile from session
   */
  ipcMain.handle(
    'learning-update-profile-from-session',
    async (event, domainType, sessionData, token) => {
      try {
        const result = updateProfileFromSession(domainType, sessionData, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-update-profile-from-session error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * Record weak area
   */
  ipcMain.handle(
    'learning-record-weak-area',
    async (event, domainType, weakArea, token) => {
      try {
        const result = recordWeakArea(domainType, weakArea, token);
        if (result.error) {
          return { success: false, error: result.error };
        }
        return { success: true, data: result };
      } catch (error) {
        console.error('learning-record-weak-area error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  console.log('Learning IPC handlers registered');
}

export default { registerLearningHandlers };
