/**
 * Notification IPC Handlers
 *
 * Handles IPC communication for learning notifications between
 * main and renderer processes.
 */

import { ipcMain } from 'electron';
import NotificationManager from '../db/NotificationManager';

/**
 * Register notification IPC handlers
 * @param {Object} store - Electron store instance
 */
export function registerNotificationHandlers(store) {
  // Get notifications with filters
  ipcMain.handle('notification-get-list', async (event, { token, options = {} }) => {
    try {
      const notifications = NotificationManager.getNotifications(token, options);
      return { success: true, notifications };
    } catch (error) {
      console.error('[Notification IPC] Error getting notifications:', error);
      return { success: false, error: error.message };
    }
  });

  // Get unread count
  ipcMain.handle('notification-get-unread-count', async (event, { token }) => {
    try {
      const count = NotificationManager.getUnreadCount(token);
      return { success: true, count };
    } catch (error) {
      console.error('[Notification IPC] Error getting unread count:', error);
      return { success: false, error: error.message, count: 0 };
    }
  });

  // Get due notifications
  ipcMain.handle('notification-get-due', async (event, { token }) => {
    try {
      const notifications = NotificationManager.getDueNotifications(token);
      return { success: true, notifications };
    } catch (error) {
      console.error('[Notification IPC] Error getting due notifications:', error);
      return { success: false, error: error.message, notifications: [] };
    }
  });

  // Create notification
  ipcMain.handle('notification-create', async (event, { token, notification }) => {
    try {
      const created = NotificationManager.createNotification(notification, token);
      return { success: true, notification: created };
    } catch (error) {
      console.error('[Notification IPC] Error creating notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Create study reminder
  ipcMain.handle('notification-create-reminder', async (event, { token, reminderData }) => {
    try {
      const notification = NotificationManager.createStudyReminder(reminderData, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error creating reminder:', error);
      return { success: false, error: error.message };
    }
  });

  // Create achievement notification
  ipcMain.handle('notification-create-achievement', async (event, { token, achievement }) => {
    try {
      const notification = NotificationManager.createAchievementNotification(achievement, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error creating achievement notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Create milestone notification
  ipcMain.handle('notification-create-milestone', async (event, { token, milestone }) => {
    try {
      const notification = NotificationManager.createMilestoneNotification(milestone, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error creating milestone notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Create streak notification
  ipcMain.handle('notification-create-streak', async (event, { token, streakData }) => {
    try {
      const notification = NotificationManager.createStreakNotification(streakData, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error creating streak notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Create review due notification
  ipcMain.handle('notification-create-review-due', async (event, { token, reviewData }) => {
    try {
      const notification = NotificationManager.createReviewDueNotification(reviewData, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error creating review notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Mark as read
  ipcMain.handle('notification-mark-read', async (event, { token, notificationId }) => {
    try {
      const notification = NotificationManager.markAsRead(notificationId, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error marking notification as read:', error);
      return { success: false, error: error.message };
    }
  });

  // Mark all as read
  ipcMain.handle('notification-mark-all-read', async (event, { token }) => {
    try {
      const count = NotificationManager.markAllAsRead(token);
      return { success: true, count };
    } catch (error) {
      console.error('[Notification IPC] Error marking all as read:', error);
      return { success: false, error: error.message };
    }
  });

  // Dismiss notification
  ipcMain.handle('notification-dismiss', async (event, { token, notificationId }) => {
    try {
      const notification = NotificationManager.dismissNotification(notificationId, token);
      return { success: true, notification };
    } catch (error) {
      console.error('[Notification IPC] Error dismissing notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete notification
  ipcMain.handle('notification-delete', async (event, { token, notificationId }) => {
    try {
      const deleted = NotificationManager.deleteNotification(notificationId, token);
      return { success: true, deleted };
    } catch (error) {
      console.error('[Notification IPC] Error deleting notification:', error);
      return { success: false, error: error.message };
    }
  });

  // Deliver due notifications
  ipcMain.handle('notification-deliver-due', async (event, { token }) => {
    try {
      const delivered = NotificationManager.deliverDueNotifications(token);
      return { success: true, delivered, count: delivered.length };
    } catch (error) {
      console.error('[Notification IPC] Error delivering due notifications:', error);
      return { success: false, error: error.message, delivered: [] };
    }
  });

  // Delete expired notifications
  ipcMain.handle('notification-delete-expired', async (event, { token }) => {
    try {
      const count = NotificationManager.deleteExpiredNotifications(token);
      return { success: true, count };
    } catch (error) {
      console.error('[Notification IPC] Error deleting expired notifications:', error);
      return { success: false, error: error.message };
    }
  });

  // Get notification preferences
  ipcMain.on('notification-get-preferences', (event) => {
    try {
      const preferences = store.get('learningNotificationPreferences') || {
        dailyStudyTime: '09:00',
        reminderLeadTime: 30,
        streakWarningTime: '20:00',
        enableDailyReminder: true,
        enableSessionReminder: true,
        enableStreakReminder: true,
        enableMilestoneReminder: true,
        enableReviewReminder: true,
      };
      event.returnValue = { success: true, preferences };
    } catch (error) {
      console.error('[Notification IPC] Error getting preferences:', error);
      event.returnValue = { success: false, error: error.message };
    }
  });

  // Set notification preferences
  ipcMain.on('notification-set-preferences', (event, { preferences }) => {
    try {
      const current = store.get('learningNotificationPreferences') || {};
      const updated = { ...current, ...preferences };
      store.set('learningNotificationPreferences', updated);
      event.returnValue = { success: true, preferences: updated };
    } catch (error) {
      console.error('[Notification IPC] Error setting preferences:', error);
      event.returnValue = { success: false, error: error.message };
    }
  });

  console.log('[Notification IPC] Handlers registered');
}

export default { registerNotificationHandlers };
