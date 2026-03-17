/**
 * scheduleApi.js
 *
 * Renderer-side API for LLM-driven schedule reconciliation.
 * Provides methods to get reconciled due items, generate catch-up plans,
 * and access personalized scheduling insights.
 */

const { ipcRenderer } = window.electron || {};

/**
 * Schedule Reconciliation API
 */
const scheduleApi = {
  /**
   * Get due items with LLM-driven reconciliation
   * Returns prioritized items based on learner profile and cross-concept patterns
   *
   * @param {Object} options
   * @param {string} options.planId - Plan ID (null for all plans)
   * @param {number} options.limit - Max items to return (default: 20)
   * @param {string} options.token - User token
   * @returns {Promise<Object>} Reconciled due items with metadata
   */
  getDueItemsReconciled: async ({ planId = null, limit = 20, token }) => {
    if (!ipcRenderer) {
      console.warn('[scheduleApi] IPC not available');
      return { success: false, error: 'IPC not available' };
    }

    return ipcRenderer.invoke('schedule-get-due-reconciled', { planId, limit, token });
  },

  /**
   * Reconcile schedule (full reconciliation with context)
   * Triggers LLM analysis of learning gap and generates scheduling adjustments
   *
   * @param {Object} options
   * @param {string} options.planId - Plan ID
   * @param {string} options.token - User token
   * @param {Object} options.options - Additional options
   * @param {boolean} options.options.forceReconcile - Force LLM reconciliation even if cached
   * @param {boolean} options.options.includeSessionPlan - Include session planning
   * @returns {Promise<Object>} Reconciliation result with adjustments and recommendations
   */
  reconcileSchedule: async ({ planId, token, options = {} }) => {
    if (!ipcRenderer) {
      console.warn('[scheduleApi] IPC not available');
      return { success: false, error: 'IPC not available' };
    }

    return ipcRenderer.invoke('schedule-reconcile', { planId, token, options });
  },

  /**
   * Get overdue items grouped by severity
   * Uses learner's personal forgetting curve for threshold calculation
   *
   * @param {Object} options
   * @param {string} options.planId - Plan ID (null for all plans)
   * @param {string} options.token - User token
   * @returns {Promise<Object>} Grouped items: { critical, important, routine, total }
   */
  getOverdueGrouped: async ({ planId = null, token }) => {
    if (!ipcRenderer) {
      console.warn('[scheduleApi] IPC not available');
      return { success: false, error: 'IPC not available' };
    }

    return ipcRenderer.invoke('schedule-get-overdue-grouped', { planId, token });
  },

  /**
   * Generate a catch-up plan for extended absence
   * Uses LLM to create a realistic plan based on backlog and learner profile
   *
   * @param {Object} options
   * @param {string} options.token - User token
   * @param {number} options.availableMinutesPerDay - Daily study time available
   * @param {number} options.targetCatchUpDays - Target days to catch up
   * @returns {Promise<Object>} Catch-up plan with schedule and strategy
   */
  generateCatchUpPlan: async ({ token, availableMinutesPerDay = 30, targetCatchUpDays = 7 }) => {
    if (!ipcRenderer) {
      console.warn('[scheduleApi] IPC not available');
      return { success: false, error: 'IPC not available' };
    }

    return ipcRenderer.invoke('schedule-generate-catch-up', {
      token,
      options: { availableMinutesPerDay, targetCatchUpDays },
    });
  },

  /**
   * Clear reconciliation cache
   * Forces fresh LLM analysis on next request
   *
   * @returns {Object} Success status
   */
  clearCache: () => {
    if (!ipcRenderer) {
      console.warn('[scheduleApi] IPC not available');
      return { success: false };
    }

    return ipcRenderer.sendSync('schedule-clear-cache');
  },

  /**
   * Check if schedule reconciliation is available
   *
   * @returns {boolean} Whether reconciliation is available
   */
  isAvailable: () => {
    if (!ipcRenderer) {
      return false;
    }

    return ipcRenderer.sendSync('schedule-reconciliation-available');
  },
};

/**
 * Gap severity levels relative to learner's optimal interval
 */
export const GAP_SEVERITY = {
  MINOR: 'minor', // < 1x optimal interval
  MODERATE: 'moderate', // 1-2x optimal interval
  SIGNIFICANT: 'significant', // 2-3x optimal interval
  CRITICAL: 'critical', // > 3x optimal interval
};

/**
 * Session types for same-day tracking
 */
export const SESSION_TYPE = {
  FIRST_TODAY: 'first_today',
  SUBSEQUENT: 'subsequent',
};

/**
 * Priority tiers for catch-up planning
 */
export const PRIORITY_TIERS = {
  CRITICAL: 'critical', // > 2x optimal interval overdue
  IMPORTANT: 'important', // 1-2x optimal interval overdue
  ROUTINE: 'routine', // < 1x optimal interval overdue
};

/**
 * Helper to get gap severity label and color
 *
 * @param {number} daysOverdue - Days since scheduled review
 * @param {number} optimalInterval - Learner's optimal review interval (default: 3)
 * @returns {Object} { severity, label, color }
 */
export const getGapSeverityInfo = (daysOverdue, optimalInterval = 3) => {
  const ratio = daysOverdue / optimalInterval;

  if (ratio < 1) {
    return { severity: GAP_SEVERITY.MINOR, label: 'Minor', color: '#4CAF50' };
  } else if (ratio < 2) {
    return { severity: GAP_SEVERITY.MODERATE, label: 'Moderate', color: '#FF9800' };
  } else if (ratio < 3) {
    return { severity: GAP_SEVERITY.SIGNIFICANT, label: 'Significant', color: '#f44336' };
  } else {
    return { severity: GAP_SEVERITY.CRITICAL, label: 'Critical', color: '#9C27B0' };
  }
};

/**
 * Helper to format days overdue for display
 *
 * @param {number} days - Days overdue
 * @returns {string} Formatted string
 */
export const formatDaysOverdue = (days) => {
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day overdue';
  if (days < 7) return `${days} days overdue`;
  if (days < 14) return '1 week overdue';
  if (days < 30) return `${Math.floor(days / 7)} weeks overdue`;
  if (days < 60) return '1 month overdue';
  return `${Math.floor(days / 30)} months overdue`;
};

/**
 * Helper to estimate catch-up time
 *
 * @param {number} overdueCount - Number of overdue items
 * @param {number} minutesPerItem - Average minutes per item (default: 1)
 * @returns {Object} { minutes, formatted }
 */
export const estimateCatchUpTime = (overdueCount, minutesPerItem = 1) => {
  const minutes = overdueCount * minutesPerItem;
  if (minutes < 60) {
    return { minutes, formatted: `${minutes} minutes` };
  }
  const hours = Math.ceil(minutes / 60);
  return { minutes, formatted: `${hours} hour${hours > 1 ? 's' : ''}` };
};

export default scheduleApi;
