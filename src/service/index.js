/**
 * SmartReader Background Service
 *
 * A lightweight Node.js service that runs independently of the main Electron app.
 * Provides:
 * - Periodic heartbeat for learning brain analysis
 * - System notifications even when app is closed
 * - Catch-up logic after extended offline periods
 *
 * Installation:
 * - Windows: Installed as Windows Service via node-windows
 * - macOS: Installed as LaunchDaemon via node-mac
 * - Linux: Installed as systemd service via node-linux
 */

const HeartbeatScheduler = require('./HeartbeatScheduler');
const ServiceState = require('./ServiceState');
const IPCServer = require('./IPCServer');
const NotificationBridge = require('./NotificationBridge');
const DatabaseBridge = require('./DatabaseBridge');

class SmartReaderService {
  constructor() {
    this.state = new ServiceState();
    this.database = new DatabaseBridge();
    this.notifications = new NotificationBridge();
    this.ipcServer = new IPCServer(this);
    this.scheduler = new HeartbeatScheduler(this);

    this.isRunning = false;
    this.startTime = null;
  }

  /**
   * Start the background service
   */
  async start() {
    console.log('[SmartReaderService] Starting background service...');

    try {
      // 1. Load persistent state
      await this.state.load();
      console.log('[SmartReaderService] State loaded:', {
        lastHeartbeat: this.state.get('lastHeartbeat'),
        nextScheduled: this.state.get('nextScheduledHeartbeat'),
      });

      // 2. Initialize database connection
      await this.database.connect();
      console.log('[SmartReaderService] Database connected');

      // 3. Start IPC server for communication with main app
      await this.ipcServer.start();
      console.log('[SmartReaderService] IPC server started');

      // 4. Check if catch-up needed (missed heartbeats while offline)
      const catchUpNeeded = await this.checkCatchUp();
      if (catchUpNeeded) {
        console.log('[SmartReaderService] Running catch-up heartbeat...');
        await this.runHeartbeat({ isCatchUp: true });
      }

      // 5. Schedule next heartbeat
      this.scheduler.scheduleNext();

      this.isRunning = true;
      this.startTime = new Date();

      // Update state
      this.state.set('lastBootTime', this.startTime.toISOString());
      await this.state.save();

      console.log('[SmartReaderService] Service started successfully');

      // 6. Setup graceful shutdown handlers
      this.setupShutdownHandlers();
    } catch (error) {
      console.error('[SmartReaderService] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the background service gracefully
   */
  async stop() {
    console.log('[SmartReaderService] Stopping service...');

    try {
      // Cancel scheduled heartbeat
      this.scheduler.cancel();

      // Close IPC server
      await this.ipcServer.stop();

      // Close database connection
      await this.database.disconnect();

      // Save final state
      await this.state.save();

      this.isRunning = false;
      console.log('[SmartReaderService] Service stopped gracefully');
    } catch (error) {
      console.error('[SmartReaderService] Error during shutdown:', error);
    }
  }

  /**
   * Check if catch-up heartbeat is needed
   * @returns {boolean}
   */
  async checkCatchUp() {
    const lastHeartbeat = this.state.get('lastHeartbeat');
    if (!lastHeartbeat) {
      // First run ever
      return true;
    }

    const lastTime = new Date(lastHeartbeat);
    const now = new Date();
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

    // If more than 24 hours since last heartbeat, catch-up is needed
    const catchUpThresholdHours = 24;
    return hoursSinceLast > catchUpThresholdHours;
  }

  /**
   * Run the heartbeat (main brain logic)
   * @param {Object} options
   * @param {boolean} options.isCatchUp - Whether this is a catch-up run
   * @param {boolean} options.manual - Whether triggered manually
   */
  async runHeartbeat(options = {}) {
    const { isCatchUp = false, manual = false } = options;
    const startTime = Date.now();

    console.log('[SmartReaderService] Running heartbeat...', { isCatchUp, manual });

    try {
      // 1. Get learning data from database
      const learningData = await this.database.getLearningData();

      // 2. Run analysis (simplified version - full version uses AdaptiveLearningSkill)
      const insights = await this.analyzeLeaning(learningData);

      // 3. Determine notifications
      const notifications = this.determineNotifications(insights, { isCatchUp });

      // 4. Send notifications
      for (const notification of notifications) {
        await this.notifications.send(notification);
      }

      // 5. Update state
      const duration = Date.now() - startTime;
      this.state.set('lastHeartbeat', new Date().toISOString());
      this.state.set('cachedInsights', insights);
      this.state.addHeartbeatHistory({
        time: new Date().toISOString(),
        status: 'success',
        duration,
        isCatchUp,
        manual,
      });
      await this.state.save();

      // 6. Schedule next heartbeat
      if (!manual) {
        this.scheduler.scheduleNext();
      }

      console.log('[SmartReaderService] Heartbeat completed in', duration, 'ms');

      return { success: true, insights, duration };
    } catch (error) {
      console.error('[SmartReaderService] Heartbeat failed:', error);

      this.state.addHeartbeatHistory({
        time: new Date().toISOString(),
        status: 'error',
        error: error.message,
        isCatchUp,
        manual,
      });
      await this.state.save();

      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze learning data
   * @param {Object} learningData
   * @returns {Object} insights
   */
  async analyzeLeaning(learningData) {
    const {
      dueItems = [],
      recentReviews = [],
      streakDays = 0,
      weakConcepts = [],
      weeklyStats = {},
    } = learningData;

    // Calculate accuracy from recent reviews
    const correctCount = recentReviews.filter((r) => r.rating >= 3).length;
    const accuracy =
      recentReviews.length > 0
        ? Math.round((correctCount / recentReviews.length) * 100)
        : 0;

    // Identify struggling concepts (low ratings)
    const struggling = recentReviews
      .filter((r) => r.rating <= 2)
      .reduce((acc, r) => {
        acc[r.conceptName] = (acc[r.conceptName] || 0) + 1;
        return acc;
      }, {});

    const strugglingConcepts = Object.entries(struggling)
      .filter(([, count]) => count >= 2)
      .map(([name]) => name);

    return {
      dueItemsCount: dueItems.length,
      dueItems: dueItems.slice(0, 10), // Top 10
      streakDays,
      accuracy,
      weeklyReviews: weeklyStats.totalReviews || 0,
      weeklyAccuracy: weeklyStats.accuracy || 0,
      weakConcepts: weakConcepts.slice(0, 5),
      strugglingConcepts: strugglingConcepts.slice(0, 5),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Determine which notifications to send based on insights
   * @param {Object} insights
   * @param {Object} options
   * @returns {Array} notifications
   */
  determineNotifications(insights, options = {}) {
    const { isCatchUp = false } = options;
    const notifications = [];
    const config = this.state.get('config') || {};
    const notifConfig = config.notifications || {};

    // Welcome back notification (after extended offline)
    if (isCatchUp && notifConfig.welcomeBack !== false) {
      const lastHeartbeat = this.state.get('lastHeartbeat');
      if (lastHeartbeat) {
        const daysSince = Math.floor(
          (Date.now() - new Date(lastHeartbeat)) / (1000 * 60 * 60 * 24)
        );
        if (daysSince >= 1) {
          notifications.push({
            title: 'Welcome back to SmartReader!',
            message: `You were away for ${daysSince} day${daysSince > 1 ? 's' : ''}. ${insights.dueItemsCount} items are now due for review.`,
            type: 'welcomeBack',
            actions: ['Start Catch-Up', 'Later'],
          });
          return notifications; // Don't spam with multiple notifications on catch-up
        }
      }
    }

    // Streak at risk notification
    if (notifConfig.streakAlert !== false && insights.streakDays > 0) {
      const now = new Date();
      const hourOfDay = now.getHours();

      // If it's evening (after 6pm) and no reviews today, streak at risk
      if (hourOfDay >= 18) {
        // Check if reviewed today
        const todayReviews = insights.dueItems.filter((item) => {
          const reviewDate = new Date(item.lastReviewDate);
          return reviewDate.toDateString() === now.toDateString();
        });

        if (todayReviews.length === 0 && insights.dueItemsCount > 0) {
          const hoursLeft = 24 - hourOfDay;
          notifications.push({
            title: `Your ${insights.streakDays}-day streak ends soon!`,
            message: `Just ${Math.min(5, insights.dueItemsCount)} quick reviews to keep it going. ${hoursLeft} hours left.`,
            type: 'streakAlert',
            urgency: 'high',
            actions: ['Quick Review', 'Not Today'],
          });
        }
      }
    }

    // Daily summary notification
    if (notifConfig.dailySummary !== false && insights.dueItemsCount > 0) {
      // Only send if no other notifications
      if (notifications.length === 0) {
        const streakEmoji = insights.streakDays > 0 ? ` Your streak: ${insights.streakDays} days` : '';
        notifications.push({
          title: 'SmartReader',
          message: `${insights.dueItemsCount} items ready for review!${streakEmoji}`,
          type: 'dailySummary',
          actions: ['Open SmartReader', 'Remind Later'],
        });
      }
    }

    // Struggling concept alert
    if (
      notifConfig.struggleAlert !== false &&
      insights.strugglingConcepts.length > 0
    ) {
      // Rate limit: don't send more than once per day
      const lastStruggleAlert = this.state.get('lastStruggleAlert');
      const daysSinceAlert = lastStruggleAlert
        ? (Date.now() - new Date(lastStruggleAlert)) / (1000 * 60 * 60 * 24)
        : 999;

      if (daysSinceAlert >= 1) {
        notifications.push({
          title: 'Focus Area Detected',
          message: `You've been struggling with "${insights.strugglingConcepts[0]}". Try a different approach?`,
          type: 'struggleAlert',
          actions: ['Get Help', 'Dismiss'],
        });
        this.state.set('lastStruggleAlert', new Date().toISOString());
      }
    }

    // Weekly report (Sundays)
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0 && notifConfig.weeklyReport !== false) {
      const lastWeeklyReport = this.state.get('lastWeeklyReport');
      const daysSinceReport = lastWeeklyReport
        ? (Date.now() - new Date(lastWeeklyReport)) / (1000 * 60 * 60 * 24)
        : 999;

      if (daysSinceReport >= 6) {
        notifications.push({
          title: 'SmartReader Weekly Report',
          message: `This week: ${insights.weeklyReviews} reviews, ${insights.weeklyAccuracy}% accuracy. ${insights.weakConcepts.length > 0 ? `Focus area: ${insights.weakConcepts[0]}` : 'Great work!'}`,
          type: 'weeklyReport',
          actions: ['View Details', 'Dismiss'],
        });
        this.state.set('lastWeeklyReport', new Date().toISOString());
      }
    }

    return notifications;
  }

  /**
   * Get current service status
   * @returns {Object}
   */
  getStatus() {
    return {
      running: this.isRunning,
      startTime: this.startTime?.toISOString(),
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      lastHeartbeat: this.state.get('lastHeartbeat'),
      nextScheduledHeartbeat: this.state.get('nextScheduledHeartbeat'),
      cachedInsights: this.state.get('cachedInsights'),
      heartbeatHistory: this.state.get('heartbeatHistory') || [],
    };
  }

  /**
   * Get cached insights (quick response without running full analysis)
   * @returns {Object}
   */
  getInsights() {
    return this.state.get('cachedInsights') || null;
  }

  /**
   * Update configuration
   * @param {Object} config
   */
  async updateConfig(config) {
    const currentConfig = this.state.get('config') || {};
    this.state.set('config', { ...currentConfig, ...config });
    await this.state.save();

    // Re-schedule if interval changed
    if (config.heartbeat?.interval) {
      this.scheduler.scheduleNext();
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      console.log(`[SmartReaderService] Received ${signal}, shutting down...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Windows-specific
    if (process.platform === 'win32') {
      process.on('message', (msg) => {
        if (msg === 'shutdown') {
          shutdown('shutdown message');
        }
      });
    }
  }
}

// Main entry point
if (require.main === module) {
  const service = new SmartReaderService();
  service.start().catch((error) => {
    console.error('[SmartReaderService] Fatal error:', error);
    process.exit(1);
  });
}

module.exports = SmartReaderService;
