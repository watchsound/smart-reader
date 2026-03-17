/**
 * studyAnalyticsHandlers.js
 *
 * IPC handlers for study session analytics and insights.
 * Provides endpoints for:
 * - Recording session analytics
 * - Performance trends
 * - Learning velocity tracking
 * - Optimal study time analysis
 * - Weak items identification
 * - Session history and export
 */

import { ipcMain } from 'electron';
import SessionAnalyticsManager from '../db/SessionAnalyticsManager';
import graphLearningFeatures from '../utils/GraphLearningFeatures';
import graphInterface from '../utils/GraphInterface';

/**
 * Register all study analytics IPC handlers
 * @param {Object} store - Electron store instance
 * @param {Object} services - Service instances
 */
export const registerStudyAnalyticsHandlers = (store, services) => {
  // Initialize analytics tables
  SessionAnalyticsManager.initAnalyticsTables();

  // ===========================================================================
  // SESSION ANALYTICS
  // ===========================================================================

  /**
   * Record analytics for a completed session
   */
  ipcMain.handle('analytics-record-session', async (event, params) => {
    const { sessionId, analytics, token } = params;

    try {
      const result = SessionAnalyticsManager.recordSessionAnalytics(
        sessionId,
        analytics,
        token,
      );

      // If graph is available, sync session impact to concepts
      if (graphInterface.checkConnection() && analytics.conceptsImproved) {
        await syncSessionToGraph(sessionId, analytics, token);
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('analytics-record-session error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get analytics for a specific session
   */
  ipcMain.handle('analytics-get-session', async (event, params) => {
    const { sessionId, token } = params;

    try {
      const analytics = SessionAnalyticsManager.getSessionAnalytics(
        sessionId,
        token,
      );
      return { success: true, analytics };
    } catch (error) {
      console.error('analytics-get-session error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // PERFORMANCE TRENDS
  // ===========================================================================

  /**
   * Get performance trends over time
   */
  ipcMain.handle('analytics-get-trends', async (event, params) => {
    const { token, days = 30, topicId = null } = params;

    try {
      const trends = SessionAnalyticsManager.getPerformanceTrends(
        token,
        days,
        topicId,
      );
      return { success: true, trends };
    } catch (error) {
      console.error('analytics-get-trends error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get weekly performance summary
   */
  ipcMain.handle('analytics-get-weekly', async (event, params) => {
    const { token, weeks = 8 } = params;

    try {
      const weekly = SessionAnalyticsManager.getWeeklyPerformance(token, weeks);
      return { success: true, weekly };
    } catch (error) {
      console.error('analytics-get-weekly error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // LEARNING VELOCITY
  // ===========================================================================

  /**
   * Record learning velocity for a day
   */
  ipcMain.handle('analytics-record-velocity', async (event, params) => {
    const { data, token } = params;

    try {
      const result = SessionAnalyticsManager.recordLearningVelocity(data, token);
      return { success: true, ...result };
    } catch (error) {
      console.error('analytics-record-velocity error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get learning velocity trend
   */
  ipcMain.handle('analytics-get-velocity', async (event, params) => {
    const { token, days = 30, topicId = null } = params;

    try {
      const velocity = SessionAnalyticsManager.getLearningVelocity(
        token,
        days,
        topicId,
      );
      return { success: true, velocity };
    } catch (error) {
      console.error('analytics-get-velocity error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get aggregate velocity for a period
   */
  ipcMain.handle('analytics-get-aggregate-velocity', async (event, params) => {
    const { token, days = 7 } = params;

    try {
      const aggregate = SessionAnalyticsManager.getAggregateVelocity(token, days);
      return { success: true, aggregate };
    } catch (error) {
      console.error('analytics-get-aggregate-velocity error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // OPTIMAL STUDY TIME
  // ===========================================================================

  /**
   * Analyze optimal study times
   */
  ipcMain.handle('analytics-optimal-times', async (event, params) => {
    const { token, days = 90 } = params;

    try {
      const analysis = SessionAnalyticsManager.analyzeOptimalStudyTimes(
        token,
        days,
      );
      return { success: true, analysis };
    } catch (error) {
      console.error('analytics-optimal-times error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // WEAK ITEMS
  // ===========================================================================

  /**
   * Identify weak items needing practice
   */
  ipcMain.handle('analytics-weak-items', async (event, params) => {
    const { token, topicId = null, limit = 20 } = params;

    try {
      const weakItems = SessionAnalyticsManager.identifyWeakItems(
        token,
        topicId,
        limit,
      );

      // Enhance with graph data if available
      let enhancedItems = weakItems;
      if (graphInterface.checkConnection()) {
        const graphWeak = await graphLearningFeatures.detectWeakConcepts(
          token,
          limit,
        );
        enhancedItems = mergeWeakItemsWithGraph(weakItems, graphWeak);
      }

      return { success: true, weakItems: enhancedItems };
    } catch (error) {
      console.error('analytics-weak-items error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // SESSION HISTORY
  // ===========================================================================

  /**
   * Get detailed session history
   */
  ipcMain.handle('analytics-session-history', async (event, params) => {
    const { token, limit = 20, offset = 0, topicId = null, days = null } = params;

    try {
      const history = SessionAnalyticsManager.getSessionHistory(token, {
        limit,
        offset,
        topicId,
        days,
      });
      return { success: true, ...history };
    } catch (error) {
      console.error('analytics-session-history error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // EXPORT
  // ===========================================================================

  /**
   * Export session data
   */
  ipcMain.handle('analytics-export', async (event, params) => {
    const {
      token,
      startDate = null,
      endDate = null,
      format = 'json',
      includeItems = false,
    } = params;

    try {
      const exportData = SessionAnalyticsManager.exportSessionData(token, {
        startDate,
        endDate,
        format,
        includeItems,
      });

      if (!exportData) {
        return { success: false, error: 'No data to export' };
      }

      return { success: true, data: exportData };
    } catch (error) {
      console.error('analytics-export error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // DASHBOARD
  // ===========================================================================

  /**
   * Get comprehensive dashboard summary
   */
  ipcMain.handle('analytics-dashboard', async (event, params) => {
    const { token } = params;

    try {
      const summary = SessionAnalyticsManager.getDashboardSummary(token);

      // Enhance with graph insights if available
      let graphInsights = null;
      if (graphInterface.checkConnection()) {
        const [weakConcepts, masteryProgress] = await Promise.all([
          graphLearningFeatures.detectWeakConcepts(token, 5),
          graphLearningFeatures.getMasteryProgress(token, 7),
        ]);
        graphInsights = {
          weakConcepts,
          masteryProgress,
        };
      }

      return {
        success: true,
        summary,
        graphInsights,
      };
    } catch (error) {
      console.error('analytics-dashboard error:', error);
      return { success: false, error: error.message };
    }
  });

  // ===========================================================================
  // GRAPH INTEGRATION
  // ===========================================================================

  /**
   * Sync mastery changes to knowledge graph
   */
  ipcMain.handle('analytics-sync-mastery', async (event, params) => {
    const { conceptId, outcome, token } = params;

    try {
      if (!graphInterface.checkConnection()) {
        return { success: false, error: 'Graph not available' };
      }

      const result = await graphLearningFeatures.updateConceptMastery(
        conceptId,
        outcome,
        token,
      );

      return { success: true, concept: result };
    } catch (error) {
      console.error('analytics-sync-mastery error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get knowledge graph analytics
   */
  ipcMain.handle('analytics-graph-insights', async (event, params) => {
    const { token, lookbackDays = 30 } = params;

    try {
      if (!graphInterface.checkConnection()) {
        return { success: false, error: 'Graph not available', insights: null };
      }

      const [weakConcepts, masteryProgress, errorProne, clusters] =
        await Promise.all([
          graphLearningFeatures.detectWeakConcepts(token, 10),
          graphLearningFeatures.getMasteryProgress(token, lookbackDays),
          graphLearningFeatures.getErrorProneTopics(token, lookbackDays),
          graphLearningFeatures.getConceptClusters(token),
        ]);

      return {
        success: true,
        insights: {
          weakConcepts,
          masteryProgress,
          errorProne,
          clusters,
        },
      };
    } catch (error) {
      console.error('analytics-graph-insights error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[StudyAnalytics] Handlers registered');
};

// ===========================================================================
// HELPER FUNCTIONS
// ===========================================================================

/**
 * Sync session impact to knowledge graph
 */
async function syncSessionToGraph(sessionId, analytics, token) {
  try {
    const session = graphInterface.adapter?.session;
    if (!session) return;

    const { conceptsImproved = [] } = analytics;

    // Create IMPROVED_BY relationship from StudySession to concepts
    for (const concept of conceptsImproved) {
      await session.run(
        `
        MATCH (c:Concept {id: $conceptId})
        MERGE (s:StudySession {id: $sessionId})
        ON CREATE SET
          s.createdAt = datetime(),
          s.duration = $duration,
          s.itemsReviewed = $itemsReviewed,
          s.accuracy = $accuracy
        MERGE (c)-[r:IMPROVED_BY]->(s)
        SET r.masteryChange = $masteryChange,
            r.timestamp = datetime()
        `,
        {
          conceptId: concept.id,
          sessionId,
          duration: analytics.durationMinutes || 0,
          itemsReviewed: analytics.itemsReviewed || 0,
          accuracy: analytics.accuracy || 0,
          masteryChange: concept.masteryChange || 0,
        },
      );
    }
  } catch (error) {
    console.error('syncSessionToGraph error:', error);
  }
}

/**
 * Merge SQLite weak items with graph weak concepts
 */
function mergeWeakItemsWithGraph(sqliteItems, graphConcepts) {
  // Create a map of graph concepts by name for matching
  const graphMap = new Map();
  for (const gc of graphConcepts || []) {
    graphMap.set(gc.name?.toLowerCase(), gc);
  }

  // Enhance SQLite items with graph data
  const enhanced = sqliteItems.map((item) => {
    const graphMatch = graphMap.get(item.itemId?.toLowerCase());
    if (graphMatch) {
      return {
        ...item,
        graphData: {
          conceptId: graphMatch.id,
          dependentCount: graphMatch.dependentCount,
          weaknessScore: graphMatch.weaknessScore,
          graphReason: graphMatch.reason,
        },
      };
    }
    return item;
  });

  // Add graph-only weak concepts not in SQLite
  for (const gc of graphConcepts || []) {
    const existsInSqlite = sqliteItems.some(
      (item) => item.itemId?.toLowerCase() === gc.name?.toLowerCase(),
    );
    if (!existsInSqlite) {
      enhanced.push({
        itemId: gc.name,
        itemType: 'concept',
        topicId: null,
        reviewCount: gc.reviewCount || 0,
        accuracy: ((gc.mastery || 0) / 100 * 100).toFixed(1),
        currentMastery: gc.mastery || 0,
        weaknessReason: gc.reason,
        source: 'graph',
        graphData: {
          conceptId: gc.id,
          dependentCount: gc.dependentCount,
          weaknessScore: gc.weaknessScore,
        },
      });
    }
  }

  return enhanced;
}

export default { registerStudyAnalyticsHandlers };
