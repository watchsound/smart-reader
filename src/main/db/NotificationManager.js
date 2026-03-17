/**
 * NotificationManager.js
 *
 * Database manager for learning_notification table.
 * Handles persistent notifications for learning reminders, achievements,
 * progress updates, and study prompts.
 *
 * Table Schema:
 *
 * CREATE TABLE "learning_notification" (
 *   "id" TEXT PRIMARY KEY,
 *   "user_id" INTEGER NOT NULL,
 *   "type" TEXT NOT NULL,
 *   "priority" TEXT DEFAULT 'normal',
 *   "title" TEXT NOT NULL,
 *   "message" TEXT NOT NULL,
 *   "icon" TEXT,
 *   "color" TEXT,
 *   "plan_id" TEXT,
 *   "topic_id" TEXT,
 *   "action_url" TEXT,
 *   "action_label" TEXT,
 *   "actions" TEXT,
 *   "created_at" TEXT NOT NULL,
 *   "scheduled_for" TEXT,
 *   "expires_at" TEXT,
 *   "status" TEXT DEFAULT 'delivered',
 *   "read_at" TEXT,
 *   "actioned_at" TEXT,
 *   "persistent" INTEGER DEFAULT 0,
 *   "dismissible" INTEGER DEFAULT 1
 * );
 *
 * Notification Types:
 * - study_reminder: Time to study reminder
 * - session_due: Learning session is due
 * - achievement: Achievement unlocked
 * - milestone: Milestone reached
 * - streak: Streak notification (maintained/broken)
 * - progress: Progress update
 * - review_due: Items due for spaced repetition review
 * - plan_update: Learning plan update
 * - system: System notification
 *
 * Status Values:
 * - pending: Scheduled for future delivery
 * - delivered: Delivered to user
 * - read: User has seen it
 * - actioned: User clicked an action
 * - dismissed: User dismissed it
 * - expired: Past expiration date
 */

import db, { getUserIdFromToken } from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * Initialize tables if they don't exist
 */
const initializeTables = () => {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS "learning_notification" (
        "id" TEXT PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "priority" TEXT DEFAULT 'normal',
        "title" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "icon" TEXT,
        "color" TEXT,
        "plan_id" TEXT,
        "topic_id" TEXT,
        "action_url" TEXT,
        "action_label" TEXT,
        "actions" TEXT,
        "created_at" TEXT NOT NULL,
        "scheduled_for" TEXT,
        "expires_at" TEXT,
        "status" TEXT DEFAULT 'delivered',
        "read_at" TEXT,
        "actioned_at" TEXT,
        "persistent" INTEGER DEFAULT 0,
        "dismissible" INTEGER DEFAULT 1,
        FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        FOREIGN KEY ("plan_id") REFERENCES "learning_plan"("id"),
        FOREIGN KEY ("topic_id") REFERENCES "learning_topic"("id")
      )
    `).run();

    // Create indexes
    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_notification_user_status"
      ON "learning_notification"("user_id", "status", "created_at" DESC)
    `).run();

    db.prepare(`
      CREATE INDEX IF NOT EXISTS "idx_notification_scheduled"
      ON "learning_notification"("scheduled_for", "status")
    `).run();
  } catch (error) {
    console.error('Error initializing notification table:', error);
  }
};

// Initialize tables on module load
initializeTables();

// Notification types
export const NOTIFICATION_TYPES = {
  STUDY_REMINDER: 'study_reminder',
  SESSION_DUE: 'session_due',
  ACHIEVEMENT: 'achievement',
  MILESTONE: 'milestone',
  STREAK: 'streak',
  PROGRESS: 'progress',
  REVIEW_DUE: 'review_due',
  PLAN_UPDATE: 'plan_update',
  SYSTEM: 'system',
};

// Notification priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

// Notification statuses
export const NOTIFICATION_STATUSES = {
  PENDING: 'pending',
  DELIVERED: 'delivered',
  READ: 'read',
  ACTIONED: 'actioned',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
};

/**
 * Generate a unique notification ID
 */
const generateNotificationId = () => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `notif_${timestamp}_${randomPart}`;
};

/**
 * Convert database row to notification object
 */
const rowToNotification = (row) => {
  if (!row) return null;

  let actions = null;
  try {
    actions = row.actions ? JSON.parse(row.actions) : null;
  } catch (e) {
    console.error('Error parsing notification actions:', e);
    actions = null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    priority: row.priority || 'normal',
    title: row.title,
    message: row.message,
    icon: row.icon || null,
    color: row.color || null,
    planId: row.plan_id || null,
    topicId: row.topic_id || null,
    actionUrl: row.action_url || null,
    actionLabel: row.action_label || null,
    actions,
    createdAt: new Date(row.created_at),
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : null,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
    status: row.status || 'delivered',
    readAt: row.read_at ? new Date(row.read_at) : null,
    actionedAt: row.actioned_at ? new Date(row.actioned_at) : null,
    persistent: row.persistent === 1,
    dismissible: row.dismissible !== 0,
  };
};

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new notification
 * @param {Object} notification - Notification data
 * @param {string} token - User authentication token
 * @returns {Object} Created notification
 */
export const createNotification = (notification, token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) {
    throw new Error('Invalid authentication token');
  }

  const id = notification.id || generateNotificationId();
  const now = new Date();
  const createdAt = dateToSQLiteString(now);

  // Determine initial status
  let status = NOTIFICATION_STATUSES.DELIVERED;
  if (notification.scheduledFor && new Date(notification.scheduledFor) > now) {
    status = NOTIFICATION_STATUSES.PENDING;
  }

  const stmt = db.prepare(`
    INSERT INTO learning_notification (
      id, user_id, type, priority, title, message, icon, color,
      plan_id, topic_id, action_url, action_label, actions,
      created_at, scheduled_for, expires_at, status, persistent, dismissible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    userId,
    notification.type || NOTIFICATION_TYPES.SYSTEM,
    notification.priority || NOTIFICATION_PRIORITIES.NORMAL,
    notification.title,
    notification.message,
    notification.icon || null,
    notification.color || null,
    notification.planId || null,
    notification.topicId || null,
    notification.actionUrl || null,
    notification.actionLabel || null,
    notification.actions ? JSON.stringify(notification.actions) : null,
    createdAt,
    notification.scheduledFor ? dateToSQLiteString(new Date(notification.scheduledFor)) : null,
    notification.expiresAt ? dateToSQLiteString(new Date(notification.expiresAt)) : null,
    status,
    notification.persistent ? 1 : 0,
    notification.dismissible !== false ? 1 : 0
  );

  return getNotificationById(id, token);
};

/**
 * Get notification by ID
 * @param {string} id - Notification ID
 * @param {string} token - User authentication token
 * @returns {Object|null} Notification or null if not found
 */
export const getNotificationById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return null;

  const stmt = db.prepare(`
    SELECT * FROM learning_notification
    WHERE id = ? AND user_id = ?
  `);

  const row = stmt.get(id, userId);
  return rowToNotification(row);
};

/**
 * Get all notifications for a user
 * @param {string} token - User authentication token
 * @param {Object} options - Query options
 * @returns {Array} List of notifications
 */
export const getNotifications = (token, options = {}) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return [];

  const {
    status,
    type,
    types,
    priority,
    planId,
    topicId,
    includeExpired = false,
    limit = 50,
    offset = 0,
    orderBy = 'created_at',
    orderDir = 'DESC',
  } = options;

  let sql = `SELECT * FROM learning_notification WHERE user_id = ?`;
  const params = [userId];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }

  if (types && Array.isArray(types) && types.length > 0) {
    const placeholders = types.map(() => '?').join(', ');
    sql += ` AND type IN (${placeholders})`;
    params.push(...types);
  }

  if (priority) {
    sql += ` AND priority = ?`;
    params.push(priority);
  }

  if (planId) {
    sql += ` AND plan_id = ?`;
    params.push(planId);
  }

  if (topicId) {
    sql += ` AND topic_id = ?`;
    params.push(topicId);
  }

  if (!includeExpired) {
    sql += ` AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  }

  // Validate orderBy to prevent SQL injection
  const validOrderBy = ['created_at', 'scheduled_for', 'priority', 'status'];
  const safeOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'created_at';
  const safeOrderDir = orderDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  sql += ` ORDER BY ${safeOrderBy} ${safeOrderDir} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);

  return rows.map(rowToNotification);
};

/**
 * Get unread notifications count
 * @param {string} token - User authentication token
 * @returns {number} Count of unread notifications
 */
export const getUnreadCount = (token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return 0;

  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM learning_notification
    WHERE user_id = ? AND status IN ('delivered', 'pending')
    AND (expires_at IS NULL OR expires_at > datetime('now'))
  `);

  const row = stmt.get(userId);
  return row?.count || 0;
};

/**
 * Get pending scheduled notifications that are due
 * @param {string} token - User authentication token
 * @returns {Array} List of due notifications
 */
export const getDueNotifications = (token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return [];

  const stmt = db.prepare(`
    SELECT * FROM learning_notification
    WHERE user_id = ? AND status = 'pending'
    AND scheduled_for <= datetime('now')
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY scheduled_for ASC
  `);

  const rows = stmt.all(userId);
  return rows.map(rowToNotification);
};

/**
 * Update notification status
 * @param {string} id - Notification ID
 * @param {string} status - New status
 * @param {string} token - User authentication token
 * @returns {Object|null} Updated notification
 */
export const updateNotificationStatus = (id, status, token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return null;

  const now = dateToSQLiteString(new Date());
  let additionalField = '';

  if (status === NOTIFICATION_STATUSES.READ) {
    additionalField = `, read_at = '${now}'`;
  } else if (status === NOTIFICATION_STATUSES.ACTIONED) {
    additionalField = `, actioned_at = '${now}'`;
  }

  const stmt = db.prepare(`
    UPDATE learning_notification
    SET status = ?${additionalField}
    WHERE id = ? AND user_id = ?
  `);

  stmt.run(status, id, userId);
  return getNotificationById(id, token);
};

/**
 * Mark notification as read
 * @param {string} id - Notification ID
 * @param {string} token - User authentication token
 * @returns {Object|null} Updated notification
 */
export const markAsRead = (id, token) => {
  return updateNotificationStatus(id, NOTIFICATION_STATUSES.READ, token);
};

/**
 * Mark all notifications as read
 * @param {string} token - User authentication token
 * @returns {number} Number of notifications updated
 */
export const markAllAsRead = (token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return 0;

  const now = dateToSQLiteString(new Date());

  const stmt = db.prepare(`
    UPDATE learning_notification
    SET status = 'read', read_at = ?
    WHERE user_id = ? AND status = 'delivered'
  `);

  const result = stmt.run(now, userId);
  return result.changes;
};

/**
 * Dismiss notification
 * @param {string} id - Notification ID
 * @param {string} token - User authentication token
 * @returns {Object|null} Updated notification
 */
export const dismissNotification = (id, token) => {
  const notification = getNotificationById(id, token);
  if (!notification) return null;

  if (!notification.dismissible) {
    throw new Error('This notification cannot be dismissed');
  }

  return updateNotificationStatus(id, NOTIFICATION_STATUSES.DISMISSED, token);
};

/**
 * Delete notification
 * @param {string} id - Notification ID
 * @param {string} token - User authentication token
 * @returns {boolean} True if deleted
 */
export const deleteNotification = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return false;

  const stmt = db.prepare(`
    DELETE FROM learning_notification
    WHERE id = ? AND user_id = ?
  `);

  const result = stmt.run(id, userId);
  return result.changes > 0;
};

/**
 * Delete expired notifications
 * @param {string} token - User authentication token
 * @returns {number} Number of notifications deleted
 */
export const deleteExpiredNotifications = (token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return 0;

  const stmt = db.prepare(`
    DELETE FROM learning_notification
    WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at < datetime('now')
    AND persistent = 0
  `);

  const result = stmt.run(userId);
  return result.changes;
};

/**
 * Deliver pending scheduled notifications
 * Updates status from 'pending' to 'delivered' for due notifications
 * @param {string} token - User authentication token
 * @returns {Array} List of newly delivered notifications
 */
export const deliverDueNotifications = (token) => {
  const userId = getUserIdFromToken(token);
  if (!userId) return [];

  // Get due notifications before updating
  const dueNotifications = getDueNotifications(token);

  if (dueNotifications.length === 0) {
    return [];
  }

  const ids = dueNotifications.map(n => n.id);
  const placeholders = ids.map(() => '?').join(', ');

  const stmt = db.prepare(`
    UPDATE learning_notification
    SET status = 'delivered'
    WHERE user_id = ? AND id IN (${placeholders})
  `);

  stmt.run(userId, ...ids);

  return dueNotifications;
};

// =============================================================================
// Convenience Methods for Creating Specific Notification Types
// =============================================================================

/**
 * Create a study reminder notification
 */
export const createStudyReminder = (data, token) => {
  return createNotification({
    type: NOTIFICATION_TYPES.STUDY_REMINDER,
    priority: data.priority || NOTIFICATION_PRIORITIES.NORMAL,
    title: data.title || 'Time to Study!',
    message: data.message || 'Your daily study session is waiting.',
    icon: 'school',
    color: '#4CAF50',
    planId: data.planId,
    topicId: data.topicId,
    actionUrl: data.actionUrl || '/learning',
    actionLabel: data.actionLabel || 'Start Session',
    scheduledFor: data.scheduledFor,
    expiresAt: data.expiresAt,
    dismissible: true,
  }, token);
};

/**
 * Create a session due notification
 */
export const createSessionDueNotification = (data, token) => {
  return createNotification({
    type: NOTIFICATION_TYPES.SESSION_DUE,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    title: data.title || 'Learning Session Due',
    message: data.message,
    icon: 'event',
    color: '#FF9800',
    planId: data.planId,
    topicId: data.topicId,
    actionUrl: data.actionUrl,
    actionLabel: 'Start Now',
    scheduledFor: data.scheduledFor,
    dismissible: true,
  }, token);
};

/**
 * Create an achievement notification
 */
export const createAchievementNotification = (achievement, token) => {
  return createNotification({
    type: NOTIFICATION_TYPES.ACHIEVEMENT,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    title: achievement.title || 'Achievement Unlocked!',
    message: achievement.description || achievement.message,
    icon: achievement.icon || 'emoji_events',
    color: '#FFD700',
    planId: achievement.planId,
    topicId: achievement.topicId,
    persistent: true,
    dismissible: true,
  }, token);
};

/**
 * Create a milestone notification
 */
export const createMilestoneNotification = (milestone, token) => {
  return createNotification({
    type: NOTIFICATION_TYPES.MILESTONE,
    priority: NOTIFICATION_PRIORITIES.HIGH,
    title: milestone.title || 'Milestone Reached!',
    message: milestone.description || milestone.message,
    icon: milestone.icon || 'flag',
    color: '#9C27B0',
    planId: milestone.planId,
    topicId: milestone.topicId,
    persistent: true,
    dismissible: true,
  }, token);
};

/**
 * Create a streak notification
 */
export const createStreakNotification = (data, token) => {
  const isPositive = data.streakDays > 0;

  return createNotification({
    type: NOTIFICATION_TYPES.STREAK,
    priority: isPositive ? NOTIFICATION_PRIORITIES.NORMAL : NOTIFICATION_PRIORITIES.HIGH,
    title: isPositive ? `${data.streakDays} Day Streak! 🔥` : 'Streak Broken',
    message: data.message || (isPositive
      ? `You've been studying for ${data.streakDays} consecutive days!`
      : 'Your study streak was broken. Start a new one today!'),
    icon: isPositive ? 'local_fire_department' : 'heart_broken',
    color: isPositive ? '#FF5722' : '#F44336',
    actionUrl: '/learning',
    actionLabel: isPositive ? 'Keep Going!' : 'Start Again',
    dismissible: true,
  }, token);
};

/**
 * Create a review due notification
 */
export const createReviewDueNotification = (data, token) => {
  return createNotification({
    type: NOTIFICATION_TYPES.REVIEW_DUE,
    priority: data.itemCount > 20 ? NOTIFICATION_PRIORITIES.HIGH : NOTIFICATION_PRIORITIES.NORMAL,
    title: data.title || 'Review Items Due',
    message: data.message || `You have ${data.itemCount} items due for review.`,
    icon: 'replay',
    color: '#2196F3',
    planId: data.planId,
    topicId: data.topicId,
    actionUrl: data.actionUrl || '/learning/review',
    actionLabel: 'Start Review',
    scheduledFor: data.scheduledFor,
    dismissible: true,
  }, token);
};

/**
 * Create a progress notification
 */
export const createProgressNotification = (data, token) => {
  return createNotification({
    type: NOTIFICATION_TYPES.PROGRESS,
    priority: NOTIFICATION_PRIORITIES.LOW,
    title: data.title || 'Progress Update',
    message: data.message,
    icon: 'trending_up',
    color: '#00BCD4',
    planId: data.planId,
    topicId: data.topicId,
    dismissible: true,
  }, token);
};

export default {
  // Constants
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_STATUSES,

  // CRUD
  createNotification,
  getNotificationById,
  getNotifications,
  getUnreadCount,
  getDueNotifications,
  updateNotificationStatus,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  deleteNotification,
  deleteExpiredNotifications,
  deliverDueNotifications,

  // Convenience methods
  createStudyReminder,
  createSessionDueNotification,
  createAchievementNotification,
  createMilestoneNotification,
  createStreakNotification,
  createReviewDueNotification,
  createProgressNotification,
};
