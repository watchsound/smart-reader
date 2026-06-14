/**
 * HybridScheduler - Fallback heartbeat scheduler for when background service is unavailable
 *
 * This runs inside the main Electron process and provides:
 * - In-app setTimeout-based heartbeat while app is running
 * - Catch-up logic on app launch if heartbeats were missed
 * - Automatic fallback when service installation fails
 *
 * Usage:
 *   const scheduler = new HybridScheduler(brainAgent, services);
 *   await scheduler.initialize();
 *   // Scheduler will auto-detect service availability and act accordingly
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class HybridScheduler {
  constructor(brainAgent, services = {}) {
    this.brainAgent = brainAgent;
    this.services = services;
    this.store = services.store; // electron-store

    this.timer = null;
    this.serviceClient = null;
    this.mode = 'unknown'; // 'service' | 'hybrid' | 'disabled'
    this.isRunning = false;

    // Default configuration
    this.config = {
      intervalMs: 24 * 60 * 60 * 1000, // 24 hours
      catchUpEnabled: true,
      maxCatchUpDays: 7,
      activeHours: { start: 8, end: 22 },
    };
  }

  /**
   * Initialize the hybrid scheduler
   * - Try to connect to background service
   * - If service unavailable, run in hybrid mode
   * - Check for missed heartbeats and catch up
   */
  async initialize() {
    console.log('[HybridScheduler] Initializing...');

    // Load configuration
    this.loadConfig();

    // Try to connect to background service
    const serviceAvailable = await this.checkServiceConnection();

    if (serviceAvailable) {
      this.mode = 'service';
      console.log('[HybridScheduler] Background service available, delegating to service');
      // Service handles everything, we just relay status
    } else {
      this.mode = 'hybrid';
      console.log('[HybridScheduler] Background service unavailable, running in hybrid mode');

      // Check if catch-up needed
      const catchUpNeeded = await this.checkCatchUp();
      if (catchUpNeeded) {
        console.log('[HybridScheduler] Running catch-up heartbeat...');
        await this.runHeartbeat({ isCatchUp: true });
      }

      // Schedule next heartbeat
      this.scheduleNext();
    }

    this.isRunning = true;
    return { mode: this.mode, serviceAvailable };
  }

  /**
   * Load configuration from electron-store
   */
  loadConfig() {
    if (this.store) {
      const brainConfig = this.store.get('learningBrain', {});
      const heartbeatConfig = brainConfig.heartbeat || {};

      if (heartbeatConfig.interval) {
        this.config.intervalMs = this.parseInterval(heartbeatConfig.interval);
      }
      if (heartbeatConfig.catchUp) {
        this.config.catchUpEnabled = heartbeatConfig.catchUp.enabled !== false;
        this.config.maxCatchUpDays = heartbeatConfig.catchUp.maxCatchUpDays || 7;
      }
      if (heartbeatConfig.activeHours) {
        this.config.activeHours = heartbeatConfig.activeHours;
      }
    }
  }

  /**
   * Parse interval string to milliseconds
   * @param {string|number} interval
   * @returns {number}
   */
  parseInterval(interval) {
    if (typeof interval === 'number') return interval;

    const match = String(interval).match(/^(\d+)(h|m|s|d)?$/i);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = (match[2] || 'h').toLowerCase();

      switch (unit) {
        case 'd': return value * 24 * 60 * 60 * 1000;
        case 'h': return value * 60 * 60 * 1000;
        case 'm': return value * 60 * 1000;
        case 's': return value * 1000;
        default: return value * 60 * 60 * 1000;
      }
    }

    return 24 * 60 * 60 * 1000; // Default 24 hours
  }

  /**
   * Check if background service is available
   * @returns {Promise<boolean>}
   */
  async checkServiceConnection() {
    try {
      const ServiceClient = require('./ServiceClient');
      this.serviceClient = new ServiceClient();

      const connected = await this.serviceClient.connect();
      if (connected) {
        const status = await this.serviceClient.getStatus();
        return status && status.running;
      }
      return false;
    } catch (e) {
      console.log('[HybridScheduler] Service connection failed:', e.message);
      return false;
    }
  }

  /**
   * Check if catch-up heartbeat is needed
   * @returns {boolean}
   */
  async checkCatchUp() {
    if (!this.config.catchUpEnabled) return false;

    const lastHeartbeat = this.getLastHeartbeat();
    if (!lastHeartbeat) {
      // First run ever
      return true;
    }

    const hoursSinceLast = (Date.now() - lastHeartbeat.getTime()) / (1000 * 60 * 60);
    const thresholdHours = this.config.intervalMs / (1000 * 60 * 60);

    return hoursSinceLast > thresholdHours;
  }

  /**
   * Get last heartbeat time from storage
   * @returns {Date|null}
   */
  getLastHeartbeat() {
    if (this.store) {
      const timestamp = this.store.get('learningBrain.lastHeartbeat');
      return timestamp ? new Date(timestamp) : null;
    }

    // Fallback to state file
    const statePath = this.getStatePath();
    if (fs.existsSync(statePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        return state.lastHeartbeat ? new Date(state.lastHeartbeat) : null;
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  /**
   * Get state file path
   * @returns {string}
   */
  getStatePath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'hybrid-scheduler-state.json');
  }

  /**
   * Save state to file + electron-store. Best-effort: a disk or store
   * failure must NOT kill the heartbeat — the agent already did its work
   * and the next tick will overwrite anyway. Errors are logged and
   * swallowed.
   *
   * @param {Object} state
   */
  saveState(state) {
    try {
      const statePath = this.getStatePath();
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('[HybridScheduler] saveState file write failed:', err);
    }

    if (this.store) {
      try {
        if (state.lastHeartbeat) {
          this.store.set('learningBrain.lastHeartbeat', state.lastHeartbeat);
        }
        if (state.nextScheduledHeartbeat) {
          this.store.set(
            'learningBrain.nextScheduledHeartbeat',
            state.nextScheduledHeartbeat,
          );
        }
        if (state.lastHeartbeatResult) {
          this.store.set(
            'learningBrain.lastHeartbeatResult',
            state.lastHeartbeatResult,
          );
        }
      } catch (err) {
        console.error('[HybridScheduler] saveState store write failed:', err);
      }
    }
  }

  /**
   * Schedule the next heartbeat
   */
  scheduleNext() {
    this.cancel();

    let nextTime = new Date(Date.now() + this.config.intervalMs);

    // Adjust for active hours
    if (this.config.activeHours) {
      nextTime = this.adjustForActiveHours(nextTime);
    }

    const delayMs = nextTime.getTime() - Date.now();

    console.log('[HybridScheduler] Scheduling next heartbeat:', {
      nextTime: nextTime.toISOString(),
      delayMs,
      delayHuman: this.formatDuration(delayMs),
    });

    // Save scheduled time
    this.saveState({
      nextScheduledHeartbeat: nextTime.toISOString(),
    });

    this.timer = setTimeout(async () => {
      try {
        await this.runHeartbeat();
      } catch (error) {
        console.error('[HybridScheduler] Heartbeat failed:', error);
      }
      // Schedule next
      this.scheduleNext();
    }, delayMs);
  }

  /**
   * Adjust time to fall within active hours
   * @param {Date} time
   * @returns {Date}
   */
  adjustForActiveHours(time) {
    const { start = 8, end = 22 } = this.config.activeHours;
    const hour = time.getHours();

    if (hour < start) {
      time.setHours(start, 0, 0, 0);
    } else if (hour >= end) {
      time.setDate(time.getDate() + 1);
      time.setHours(start, 0, 0, 0);
    }

    return time;
  }

  /**
   * Cancel scheduled heartbeat
   */
  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Run the heartbeat
   * @param {Object} options
   */
  async runHeartbeat(options = {}) {
    const { isCatchUp = false, manual = false } = options;
    const startTime = Date.now();

    console.log('[HybridScheduler] Running heartbeat...', { isCatchUp, manual });

    try {
      // Delegate to brain agent
      const result = await this.brainAgent.runHeartbeat({
        isCatchUp,
        manual,
        mode: this.mode,
      });

      // Save state — include persistedNotifications so getStatus can
      // surface "fired N nudges today, skipped M duplicates" without
      // requiring a separate query.
      this.saveState({
        lastHeartbeat: new Date().toISOString(),
        lastHeartbeatResult: {
          success: result.success,
          duration: Date.now() - startTime,
          isCatchUp,
          manual,
          persistedNotifications: result.persistedNotifications || null,
        },
      });

      return result;
    } catch (error) {
      console.error('[HybridScheduler] Heartbeat error:', error);

      this.saveState({
        lastHeartbeat: new Date().toISOString(),
        lastHeartbeatResult: {
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
          isCatchUp,
          manual,
        },
      });

      throw error;
    }
  }

  /**
   * Trigger an immediate heartbeat
   * @returns {Promise<Object>}
   */
  async triggerNow() {
    if (this.mode === 'service' && this.serviceClient) {
      // Delegate to service
      return this.serviceClient.triggerHeartbeat();
    }

    return this.runHeartbeat({ manual: true });
  }

  /**
   * Get current status
   * @returns {Object}
   */
  getStatus() {
    const lastHeartbeat = this.getLastHeartbeat();

    return {
      mode: this.mode,
      isRunning: this.isRunning,
      lastHeartbeat: lastHeartbeat?.toISOString(),
      lastHeartbeatResult: this.store?.get(
        'learningBrain.lastHeartbeatResult',
      ),
      nextScheduledHeartbeat: this.store?.get('learningBrain.nextScheduledHeartbeat'),
      config: this.config,
    };
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('[HybridScheduler] Stopping...');
    this.cancel();

    if (this.serviceClient) {
      this.serviceClient.disconnect();
    }

    this.isRunning = false;
  }

  /**
   * Format duration for logging
   * @param {number} ms
   * @returns {string}
   */
  formatDuration(ms) {
    if (ms < 0) return 'overdue';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
}

module.exports = HybridScheduler;
