/**
 * Notification API
 *
 * Renderer-side API for managing learning notifications.
 * Communicates with the main process via IPC.
 */

const { ipcRenderer } = window.electron || {};

/**
 * Get notifications with optional filters
 * @param {Object} options - Filter options
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notifications: Array}>}
 */
export const getNotifications = async (options = {}, token) => {
  if (!ipcRenderer) {
    console.warn('IPC not available');
    return { success: false, notifications: [] };
  }
  return ipcRenderer.invoke('notification-get-list', { token, options });
};

/**
 * Get unread notification count
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, count: number}>}
 */
export const getUnreadCount = async (token) => {
  if (!ipcRenderer) return { success: false, count: 0 };
  return ipcRenderer.invoke('notification-get-unread-count', { token });
};

/**
 * Get notifications that are due for delivery
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notifications: Array}>}
 */
export const getDueNotifications = async (token) => {
  if (!ipcRenderer) return { success: false, notifications: [] };
  return ipcRenderer.invoke('notification-get-due', { token });
};

/**
 * Create a new notification
 * @param {Object} notification - Notification data
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const createNotification = async (notification, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-create', { token, notification });
};

/**
 * Create a study reminder
 * @param {Object} reminderData - Reminder configuration
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const createStudyReminder = async (reminderData, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-create-reminder', { token, reminderData });
};

/**
 * Create an achievement notification
 * @param {Object} achievement - Achievement data
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const createAchievementNotification = async (achievement, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-create-achievement', { token, achievement });
};

/**
 * Create a milestone notification
 * @param {Object} milestone - Milestone data
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const createMilestoneNotification = async (milestone, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-create-milestone', { token, milestone });
};

/**
 * Create a streak notification
 * @param {Object} streakData - Streak data
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const createStreakNotification = async (streakData, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-create-streak', { token, streakData });
};

/**
 * Create a review due notification
 * @param {Object} reviewData - Review data
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const createReviewDueNotification = async (reviewData, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-create-review-due', { token, reviewData });
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const markAsRead = async (notificationId, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-mark-read', { token, notificationId });
};

/**
 * Mark all notifications as read
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, count: number}>}
 */
export const markAllAsRead = async (token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-mark-all-read', { token });
};

/**
 * Dismiss a notification
 * @param {string} notificationId - Notification ID
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, notification: Object}>}
 */
export const dismissNotification = async (notificationId, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-dismiss', { token, notificationId });
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, deleted: boolean}>}
 */
export const deleteNotification = async (notificationId, token) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.invoke('notification-delete', { token, notificationId });
};

/**
 * Deliver due notifications (check and deliver scheduled notifications)
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, delivered: Array, count: number}>}
 */
export const deliverDueNotifications = async (token) => {
  if (!ipcRenderer) return { success: false, delivered: [], count: 0 };
  return ipcRenderer.invoke('notification-deliver-due', { token });
};

/**
 * Delete expired notifications
 * @param {string} token - Auth token
 * @returns {Promise<{success: boolean, count: number}>}
 */
export const deleteExpiredNotifications = async (token) => {
  if (!ipcRenderer) return { success: false, count: 0 };
  return ipcRenderer.invoke('notification-delete-expired', { token });
};

/**
 * Get notification preferences (sync)
 * @returns {{success: boolean, preferences: Object}}
 */
export const getPreferences = () => {
  if (!ipcRenderer) return { success: false, preferences: {} };
  return ipcRenderer.sendSync('notification-get-preferences');
};

/**
 * Set notification preferences (sync)
 * @param {Object} preferences - Preference settings
 * @returns {{success: boolean, preferences: Object}}
 */
export const setPreferences = (preferences) => {
  if (!ipcRenderer) return { success: false };
  return ipcRenderer.sendSync('notification-set-preferences', { preferences });
};

// Default export with all functions
export default {
  getNotifications,
  getUnreadCount,
  getDueNotifications,
  createNotification,
  createStudyReminder,
  createAchievementNotification,
  createMilestoneNotification,
  createStreakNotification,
  createReviewDueNotification,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  deleteNotification,
  deliverDueNotifications,
  deleteExpiredNotifications,
  getPreferences,
  setPreferences,
};
