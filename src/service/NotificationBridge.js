/**
 * NotificationBridge - System notifications for the background service
 *
 * Uses node-notifier for cross-platform system notifications.
 * Supports action buttons that can open the main app or trigger specific actions.
 */

class NotificationBridge {
  constructor() {
    this.notifier = null;
    this.pendingNotifications = [];
    this.notificationHistory = [];
    this.maxHistorySize = 50;
  }

  /**
   * Initialize the notifier (lazy load to avoid issues if package not installed)
   */
  async init() {
    if (!this.notifier) {
      try {
        // node-notifier must be installed: npm install node-notifier
        this.notifier = require('node-notifier');
        console.log('[NotificationBridge] Initialized');
      } catch (e) {
        console.warn('[NotificationBridge] node-notifier not available:', e.message);
        this.notifier = null;
      }
    }
  }

  /**
   * Send a system notification
   * @param {Object} notification
   * @param {string} notification.title - Notification title
   * @param {string} notification.message - Notification message
   * @param {string} notification.type - Notification type (for tracking)
   * @param {string} notification.urgency - 'low' | 'normal' | 'high'
   * @param {Array<string>} notification.actions - Action button labels
   * @returns {Promise<Object>}
   */
  async send(notification) {
    await this.init();

    const {
      title = 'SmartReader',
      message,
      type = 'general',
      urgency = 'normal',
      actions = [],
      icon,
    } = notification;

    if (!this.notifier) {
      // Fallback: store notification for later retrieval
      console.log('[NotificationBridge] Queuing notification (notifier unavailable):', title);
      this.pendingNotifications.push({
        ...notification,
        timestamp: new Date().toISOString(),
      });
      return { sent: false, queued: true };
    }

    return new Promise((resolve) => {
      const notifOptions = {
        title,
        message,
        sound: urgency === 'high',
        wait: actions.length > 0, // Wait for user interaction if there are actions
        timeout: urgency === 'high' ? 30 : 10, // Seconds
      };

      // Platform-specific options
      if (process.platform === 'win32') {
        // Windows Toast notifications
        notifOptions.appID = 'SmartReader';
        if (actions.length > 0) {
          notifOptions.actions = actions;
        }
      } else if (process.platform === 'darwin') {
        // macOS notifications
        if (actions.length > 0) {
          notifOptions.actions = actions.join(',');
          notifOptions.closeLabel = 'Close';
        }
      } else {
        // Linux notifications (notify-send)
        notifOptions.urgency = urgency === 'high' ? 'critical' : 'normal';
      }

      // Add icon if available
      if (icon) {
        notifOptions.icon = icon;
      } else {
        // Use app icon if available
        notifOptions.icon = this.getAppIconPath();
      }

      console.log('[NotificationBridge] Sending notification:', title);

      this.notifier.notify(notifOptions, (err, response, metadata) => {
        const result = {
          sent: !err,
          error: err?.message,
          response,
          metadata,
          timestamp: new Date().toISOString(),
        };

        // Track in history
        this.addToHistory({
          ...notification,
          ...result,
        });

        if (err) {
          console.error('[NotificationBridge] Failed to send:', err);
        } else {
          console.log('[NotificationBridge] Notification sent:', response);
        }

        resolve(result);
      });

      // Handle action clicks (if supported)
      this.notifier.on('click', (notifierObject, options, event) => {
        console.log('[NotificationBridge] Notification clicked');
        this.handleAction('click', notification);
      });

      this.notifier.on('timeout', (notifierObject, options) => {
        console.log('[NotificationBridge] Notification timed out');
      });

      // Windows-specific action handling
      this.notifier.on('activate', (notifierObject, options, event) => {
        console.log('[NotificationBridge] Action activated:', event);
        this.handleAction(event, notification);
      });
    });
  }

  /**
   * Handle notification action
   * @param {string} action
   * @param {Object} notification
   */
  handleAction(action, notification) {
    const { type } = notification;

    // Map actions to app commands
    const actionMap = {
      click: 'open-app',
      'Open SmartReader': 'open-app',
      'Quick Review': 'open-app:study',
      'Start Catch-Up': 'open-app:catchup',
      'View Details': 'open-app:insights',
      'Get Help': 'open-app:help',
      'Remind Later': 'snooze',
      Later: 'snooze',
      'Not Today': 'dismiss',
      Dismiss: 'dismiss',
    };

    const command = actionMap[action] || 'open-app';

    if (command.startsWith('open-app')) {
      this.openMainApp(command.split(':')[1]);
    } else if (command === 'snooze') {
      this.snoozeNotification(notification);
    }
    // 'dismiss' - do nothing
  }

  /**
   * Open the main Electron app
   * @param {string} view - Optional view to navigate to
   */
  openMainApp(view) {
    const { spawn } = require('child_process');

    // Try to find the app executable
    let appPath;
    if (process.platform === 'win32') {
      appPath =
        process.env.SMARTREADER_APP_PATH ||
        'C:\\Program Files\\SmartReader\\SmartReader.exe';
    } else if (process.platform === 'darwin') {
      appPath = '/Applications/SmartReader.app/Contents/MacOS/SmartReader';
    } else {
      appPath = '/usr/bin/smartreader';
    }

    const args = view ? [`--open-view=${view}`] : [];

    try {
      const child = spawn(appPath, args, {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      console.log('[NotificationBridge] Opened main app');
    } catch (e) {
      console.error('[NotificationBridge] Failed to open app:', e);
    }
  }

  /**
   * Snooze a notification (re-schedule for later)
   * @param {Object} notification
   */
  snoozeNotification(notification) {
    const snoozeMinutes = 30;
    const snoozeTime = new Date(Date.now() + snoozeMinutes * 60 * 1000);

    this.pendingNotifications.push({
      ...notification,
      scheduledFor: snoozeTime.toISOString(),
      snoozed: true,
    });

    console.log(
      '[NotificationBridge] Snoozed notification for',
      snoozeMinutes,
      'minutes'
    );
  }

  /**
   * Get app icon path
   * @returns {string|undefined}
   */
  getAppIconPath() {
    const path = require('path');

    // Try common locations
    const iconPaths = [
      path.join(__dirname, '../../assets/icon.png'),
      path.join(__dirname, '../../assets/icons/icon.png'),
      path.join(__dirname, '../../../resources/icon.png'),
    ];

    const fs = require('fs');
    for (const iconPath of iconPaths) {
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
    }

    return undefined;
  }

  /**
   * Add notification to history
   * @param {Object} notification
   */
  addToHistory(notification) {
    this.notificationHistory.push(notification);

    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get notification history
   * @param {number} limit
   * @returns {Array}
   */
  getHistory(limit = 20) {
    return this.notificationHistory.slice(-limit);
  }

  /**
   * Get pending (snoozed) notifications that are due
   * @returns {Array}
   */
  getDuePendingNotifications() {
    const now = new Date();
    const due = [];
    const remaining = [];

    for (const notif of this.pendingNotifications) {
      if (notif.scheduledFor && new Date(notif.scheduledFor) <= now) {
        due.push(notif);
      } else if (!notif.scheduledFor) {
        // Immediate notifications that couldn't be sent
        due.push(notif);
      } else {
        remaining.push(notif);
      }
    }

    this.pendingNotifications = remaining;
    return due;
  }

  /**
   * Clear all pending notifications
   */
  clearPending() {
    this.pendingNotifications = [];
  }

  /**
   * Check if notifications are supported
   * @returns {boolean}
   */
  isSupported() {
    return this.notifier !== null;
  }
}

module.exports = NotificationBridge;
