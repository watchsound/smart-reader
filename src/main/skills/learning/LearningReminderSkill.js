/**
 * LearningReminderSkill - Manage learning reminders and notifications
 *
 * This skill handles:
 * - Scheduling study reminders based on learning plans
 * - Creating notifications for due sessions, achievements, milestones
 * - Managing notification preferences
 * - Delivering pending notifications
 *
 * Reminder Types:
 * - daily_study: Daily study session reminder
 * - session_due: Specific session coming up
 * - review_due: Spaced repetition items due
 * - streak_reminder: Reminder to maintain streak
 * - milestone_approaching: Upcoming milestone
 * - plan_deadline: Learning plan deadline approaching
 */

const BaseSkill = require('../BaseSkill');

// Default reminder configurations
const DEFAULT_REMINDER_CONFIG = {
  dailyStudyTime: '09:00', // Default time for daily reminders
  reminderLeadTime: 30, // Minutes before session to remind
  streakWarningTime: '20:00', // Time to warn about streak if not studied
  enableDailyReminder: true,
  enableSessionReminder: true,
  enableStreakReminder: true,
  enableMilestoneReminder: true,
  enableReviewReminder: true,
};

// Notification priority by reminder type
const REMINDER_PRIORITIES = {
  daily_study: 'normal',
  session_due: 'high',
  review_due: 'normal',
  streak_reminder: 'high',
  milestone_approaching: 'normal',
  plan_deadline: 'urgent',
};

class LearningReminderSkill extends BaseSkill {
  static get name() {
    return 'manage_learning_reminders';
  }

  static get description() {
    return 'Manage learning reminders and notifications. Schedule study reminders, create notifications for achievements and milestones, and configure notification preferences.';
  }

  static get parameters() {
    return {
      action: {
        type: 'string',
        enum: [
          'schedule_daily_reminder',
          'schedule_session_reminder',
          'schedule_review_reminder',
          'create_achievement_notification',
          'create_milestone_notification',
          'create_streak_notification',
          'check_and_deliver',
          'get_pending',
          'get_notifications',
          'mark_read',
          'dismiss',
          'configure_preferences',
          'get_preferences',
        ],
        description: 'The reminder management action to perform',
      },
      reminderType: {
        type: 'string',
        enum: ['daily_study', 'session_due', 'review_due', 'streak_reminder', 'milestone_approaching', 'plan_deadline'],
        description: 'Type of reminder to create',
      },
      scheduledFor: {
        type: 'string',
        description: 'ISO datetime string for when to deliver the reminder',
      },
      planId: {
        type: 'string',
        description: 'Associated learning plan ID',
      },
      topicId: {
        type: 'string',
        description: 'Associated learning topic ID',
      },
      title: {
        type: 'string',
        description: 'Notification title',
      },
      message: {
        type: 'string',
        description: 'Notification message',
      },
      notificationId: {
        type: 'string',
        description: 'ID of notification to act on',
      },
      preferences: {
        type: 'object',
        description: 'Notification preference settings',
      },
      achievement: {
        type: 'object',
        description: 'Achievement data for notification',
      },
      milestone: {
        type: 'object',
        description: 'Milestone data for notification',
      },
      streakData: {
        type: 'object',
        description: 'Streak data for notification',
      },
      sessionData: {
        type: 'object',
        description: 'Session data for reminder',
      },
      reviewData: {
        type: 'object',
        description: 'Review items data for reminder',
      },
      limit: {
        type: 'number',
        default: 50,
        description: 'Maximum number of notifications to return',
      },
      status: {
        type: 'string',
        enum: ['pending', 'delivered', 'read', 'actioned', 'dismissed'],
        description: 'Filter notifications by status',
      },
    };
  }

  static get requiredParams() {
    return ['action'];
  }

  static get category() {
    return 'learning';
  }

  async execute(params) {
    const { action } = params;

    switch (action) {
      case 'schedule_daily_reminder':
        return this.scheduleDailyReminder(params);
      case 'schedule_session_reminder':
        return this.scheduleSessionReminder(params);
      case 'schedule_review_reminder':
        return this.scheduleReviewReminder(params);
      case 'create_achievement_notification':
        return this.createAchievementNotification(params);
      case 'create_milestone_notification':
        return this.createMilestoneNotification(params);
      case 'create_streak_notification':
        return this.createStreakNotification(params);
      case 'check_and_deliver':
        return this.checkAndDeliverNotifications(params);
      case 'get_pending':
        return this.getPendingNotifications(params);
      case 'get_notifications':
        return this.getNotifications(params);
      case 'mark_read':
        return this.markNotificationRead(params);
      case 'dismiss':
        return this.dismissNotification(params);
      case 'configure_preferences':
        return this.configurePreferences(params);
      case 'get_preferences':
        return this.getPreferences(params);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Schedule a daily study reminder
   */
  async scheduleDailyReminder(params) {
    const {
      planId,
      topicId,
      scheduledFor,
      title = 'Time for Your Daily Study!',
      message,
    } = params;

    // Calculate scheduled time
    let scheduleTime;
    if (scheduledFor) {
      scheduleTime = new Date(scheduledFor);
    } else {
      // Default to next day at configured time
      const preferences = await this.getStoredPreferences();
      const [hours, minutes] = (preferences.dailyStudyTime || '09:00').split(':').map(Number);
      scheduleTime = new Date();
      scheduleTime.setDate(scheduleTime.getDate() + 1);
      scheduleTime.setHours(hours, minutes, 0, 0);
    }

    // Create the notification
    const notification = {
      type: 'study_reminder',
      priority: REMINDER_PRIORITIES.daily_study,
      title,
      message: message || 'Your daily learning session awaits. Keep your streak going!',
      icon: 'school',
      color: '#4CAF50',
      planId,
      topicId,
      actionUrl: planId ? `/learning/plan/${planId}` : '/learning',
      actionLabel: 'Start Learning',
      scheduledFor: scheduleTime.toISOString(),
      expiresAt: new Date(scheduleTime.getTime() + 24 * 60 * 60 * 1000).toISOString(), // Expires after 24h
      dismissible: true,
    };

    const created = await this.createNotification(notification);

    this.logExecution(
      { action: 'schedule_daily_reminder', planId },
      { notificationId: created?.id, scheduledFor: scheduleTime.toISOString() }
    );

    return {
      success: true,
      notification: created,
      scheduledFor: scheduleTime.toISOString(),
    };
  }

  /**
   * Schedule a session-specific reminder
   */
  async scheduleSessionReminder(params) {
    const {
      sessionData = {},
      planId,
      topicId,
      scheduledFor,
      title,
      message,
    } = params;

    const preferences = await this.getStoredPreferences();
    const leadTimeMinutes = preferences.reminderLeadTime || 30;

    // Calculate reminder time (before session)
    let scheduleTime;
    if (scheduledFor) {
      scheduleTime = new Date(scheduledFor);
    } else if (sessionData.startTime) {
      scheduleTime = new Date(new Date(sessionData.startTime).getTime() - leadTimeMinutes * 60 * 1000);
    } else {
      throw new Error('Either scheduledFor or sessionData.startTime is required');
    }

    const sessionTypeText = this.getSessionTypeText(sessionData.sessionType);

    const notification = {
      type: 'session_due',
      priority: REMINDER_PRIORITIES.session_due,
      title: title || `${sessionTypeText} Session Starting Soon`,
      message: message || `Your ${sessionTypeText.toLowerCase()} session starts in ${leadTimeMinutes} minutes.`,
      icon: 'event',
      color: '#FF9800',
      planId,
      topicId,
      actionUrl: planId ? `/learning/session/${planId}` : '/learning',
      actionLabel: 'Start Now',
      scheduledFor: scheduleTime.toISOString(),
      expiresAt: sessionData.startTime || new Date(scheduleTime.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      dismissible: true,
    };

    const created = await this.createNotification(notification);

    this.logExecution(
      { action: 'schedule_session_reminder', planId, sessionType: sessionData.sessionType },
      { notificationId: created?.id }
    );

    return {
      success: true,
      notification: created,
      scheduledFor: scheduleTime.toISOString(),
    };
  }

  /**
   * Schedule a review reminder (spaced repetition)
   */
  async scheduleReviewReminder(params) {
    const {
      reviewData = {},
      planId,
      topicId,
      scheduledFor,
      title,
      message,
    } = params;

    const itemCount = reviewData.itemCount || reviewData.items?.length || 0;

    const notification = {
      type: 'review_due',
      priority: itemCount > 20 ? 'high' : REMINDER_PRIORITIES.review_due,
      title: title || 'Review Items Ready',
      message: message || `You have ${itemCount} item${itemCount !== 1 ? 's' : ''} ready for review.`,
      icon: 'replay',
      color: '#2196F3',
      planId,
      topicId,
      actionUrl: topicId ? `/learning/review/${topicId}` : '/learning/review',
      actionLabel: 'Start Review',
      scheduledFor: scheduledFor || new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      dismissible: true,
    };

    const created = await this.createNotification(notification);

    this.logExecution(
      { action: 'schedule_review_reminder', itemCount },
      { notificationId: created?.id }
    );

    return {
      success: true,
      notification: created,
      itemCount,
    };
  }

  /**
   * Create an achievement notification (immediate delivery)
   */
  async createAchievementNotification(params) {
    const { achievement = {} } = params;

    const notification = {
      type: 'achievement',
      priority: 'high',
      title: achievement.title || 'Achievement Unlocked! 🏆',
      message: achievement.description || achievement.message || 'You\'ve earned a new achievement!',
      icon: achievement.icon || 'emoji_events',
      color: '#FFD700',
      planId: achievement.planId || params.planId,
      topicId: achievement.topicId || params.topicId,
      persistent: true,
      dismissible: true,
    };

    const created = await this.createNotification(notification);

    this.logExecution(
      { action: 'create_achievement_notification', achievementType: achievement.type },
      { notificationId: created?.id }
    );

    return {
      success: true,
      notification: created,
    };
  }

  /**
   * Create a milestone notification (immediate delivery)
   */
  async createMilestoneNotification(params) {
    const { milestone = {} } = params;

    const notification = {
      type: 'milestone',
      priority: 'high',
      title: milestone.title || 'Milestone Reached! 🎯',
      message: milestone.description || milestone.message || 'You\'ve reached an important milestone!',
      icon: milestone.icon || 'flag',
      color: '#9C27B0',
      planId: milestone.planId || params.planId,
      topicId: milestone.topicId || params.topicId,
      persistent: true,
      dismissible: true,
    };

    const created = await this.createNotification(notification);

    this.logExecution(
      { action: 'create_milestone_notification', milestoneId: milestone.id },
      { notificationId: created?.id }
    );

    return {
      success: true,
      notification: created,
    };
  }

  /**
   * Create a streak notification
   */
  async createStreakNotification(params) {
    const { streakData = {} } = params;
    const streakDays = streakData.streakDays || streakData.days || 0;
    const isPositive = streakDays > 0 && !streakData.broken;

    const notification = {
      type: 'streak',
      priority: isPositive ? 'normal' : 'high',
      title: isPositive ? `${streakDays} Day Streak! 🔥` : 'Streak Alert',
      message: streakData.message || (isPositive
        ? `Amazing! You've maintained your study streak for ${streakDays} consecutive days!`
        : 'Your study streak is at risk. Study today to keep it going!'),
      icon: isPositive ? 'local_fire_department' : 'warning',
      color: isPositive ? '#FF5722' : '#F44336',
      actionUrl: '/learning',
      actionLabel: isPositive ? 'Keep Going!' : 'Study Now',
      dismissible: true,
    };

    const created = await this.createNotification(notification);

    this.logExecution(
      { action: 'create_streak_notification', streakDays, isPositive },
      { notificationId: created?.id }
    );

    return {
      success: true,
      notification: created,
      streakDays,
    };
  }

  /**
   * Check for and deliver pending notifications
   */
  async checkAndDeliverNotifications(params) {
    const notificationManager = this.getNotificationManager();
    if (!notificationManager) {
      return {
        success: false,
        error: 'Notification manager not available',
        delivered: [],
      };
    }

    const token = this.context?.token;
    if (!token) {
      return {
        success: false,
        error: 'Authentication required',
        delivered: [],
      };
    }

    try {
      const delivered = notificationManager.deliverDueNotifications(token);

      this.logExecution(
        { action: 'check_and_deliver' },
        { deliveredCount: delivered.length }
      );

      return {
        success: true,
        delivered,
        count: delivered.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        delivered: [],
      };
    }
  }

  /**
   * Get pending scheduled notifications
   */
  async getPendingNotifications(params) {
    const notificationManager = this.getNotificationManager();
    if (!notificationManager) {
      return { success: false, error: 'Notification manager not available', notifications: [] };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required', notifications: [] };
    }

    try {
      const notifications = notificationManager.getNotifications(token, {
        status: 'pending',
        limit: params.limit || 50,
      });

      return {
        success: true,
        notifications,
        count: notifications.length,
      };
    } catch (error) {
      return { success: false, error: error.message, notifications: [] };
    }
  }

  /**
   * Get notifications with filters
   */
  async getNotifications(params) {
    const notificationManager = this.getNotificationManager();
    if (!notificationManager) {
      return { success: false, error: 'Notification manager not available', notifications: [] };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required', notifications: [] };
    }

    try {
      const { status, limit = 50, planId, topicId } = params;

      const notifications = notificationManager.getNotifications(token, {
        status,
        planId,
        topicId,
        limit,
      });

      const unreadCount = notificationManager.getUnreadCount(token);

      return {
        success: true,
        notifications,
        count: notifications.length,
        unreadCount,
      };
    } catch (error) {
      return { success: false, error: error.message, notifications: [] };
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(params) {
    const { notificationId } = params;
    if (!notificationId) {
      return { success: false, error: 'notificationId is required' };
    }

    const notificationManager = this.getNotificationManager();
    if (!notificationManager) {
      return { success: false, error: 'Notification manager not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const notification = notificationManager.markAsRead(notificationId, token);
      return {
        success: true,
        notification,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(params) {
    const { notificationId } = params;
    if (!notificationId) {
      return { success: false, error: 'notificationId is required' };
    }

    const notificationManager = this.getNotificationManager();
    if (!notificationManager) {
      return { success: false, error: 'Notification manager not available' };
    }

    const token = this.context?.token;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    try {
      const notification = notificationManager.dismissNotification(notificationId, token);
      return {
        success: true,
        notification,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Configure notification preferences
   */
  async configurePreferences(params) {
    const { preferences = {} } = params;

    const store = this.context?.store;
    if (!store) {
      return { success: false, error: 'Store not available' };
    }

    try {
      const currentPrefs = store.get('learningNotificationPreferences') || DEFAULT_REMINDER_CONFIG;
      const newPrefs = { ...currentPrefs, ...preferences };

      store.set('learningNotificationPreferences', newPrefs);

      this.logExecution(
        { action: 'configure_preferences' },
        { updatedKeys: Object.keys(preferences) }
      );

      return {
        success: true,
        preferences: newPrefs,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get notification preferences
   */
  async getPreferences(params) {
    const preferences = await this.getStoredPreferences();
    return {
      success: true,
      preferences,
    };
  }

  // =============================================================================
  // Helper methods
  // =============================================================================

  async createNotification(notification) {
    const notificationManager = this.getNotificationManager();
    if (!notificationManager) {
      console.error('[LearningReminderSkill] NotificationManager not available');
      return null;
    }

    const token = this.context?.token;
    if (!token) {
      console.error('[LearningReminderSkill] No authentication token available');
      return null;
    }

    try {
      return notificationManager.createNotification(notification, token);
    } catch (error) {
      console.error('[LearningReminderSkill] Failed to create notification:', error);
      return null;
    }
  }

  getNotificationManager() {
    // Try to get from context services
    if (this.context?.services?.notificationManager) {
      return this.context.services.notificationManager;
    }

    // Try to require it directly (for testing or direct usage)
    try {
      return require('../../db/NotificationManager').default;
    } catch (e) {
      return null;
    }
  }

  async getStoredPreferences() {
    const store = this.context?.store;
    if (!store) {
      return DEFAULT_REMINDER_CONFIG;
    }

    try {
      const prefs = store.get('learningNotificationPreferences');
      return prefs ? { ...DEFAULT_REMINDER_CONFIG, ...prefs } : DEFAULT_REMINDER_CONFIG;
    } catch (e) {
      return DEFAULT_REMINDER_CONFIG;
    }
  }

  getSessionTypeText(sessionType) {
    const typeNames = {
      review: 'Review',
      learn_new: 'Learning',
      quiz: 'Quiz',
      practice: 'Practice',
      reading: 'Reading',
      project: 'Project',
      assessment: 'Assessment',
      mixed: 'Study',
    };
    return typeNames[sessionType] || 'Study';
  }
}

module.exports = LearningReminderSkill;
