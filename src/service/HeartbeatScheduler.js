/**
 * HeartbeatScheduler - Manages periodic heartbeat timing
 *
 * Uses setTimeout (not setInterval) to prevent drift and allow for
 * dynamic interval adjustments based on active hours.
 */

class HeartbeatScheduler {
  constructor(service) {
    this.service = service;
    this.timer = null;
    this.nextScheduledTime = null;

    // Default configuration
    this.defaultConfig = {
      intervalMs: 24 * 60 * 60 * 1000, // 24 hours
      activeHours: {
        start: 8, // 8 AM
        end: 22, // 10 PM
      },
      catchUp: {
        enabled: true,
        maxCatchUpDays: 7,
      },
    };
  }

  /**
   * Get current heartbeat configuration
   * @returns {Object}
   */
  getConfig() {
    const stateConfig = this.service.state.get('config')?.heartbeat || {};
    return { ...this.defaultConfig, ...stateConfig };
  }

  /**
   * Parse interval string to milliseconds
   * @param {string|number} interval - e.g., "24h", "30m", 86400000
   * @returns {number} milliseconds
   */
  parseInterval(interval) {
    if (typeof interval === 'number') {
      return interval;
    }

    if (typeof interval === 'string') {
      const match = interval.match(/^(\d+)(h|m|s|d)?$/i);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = (match[2] || 'h').toLowerCase();

        switch (unit) {
          case 'd':
            return value * 24 * 60 * 60 * 1000;
          case 'h':
            return value * 60 * 60 * 1000;
          case 'm':
            return value * 60 * 1000;
          case 's':
            return value * 1000;
          default:
            return value * 60 * 60 * 1000; // Default to hours
        }
      }
    }

    return this.defaultConfig.intervalMs;
  }

  /**
   * Schedule the next heartbeat
   */
  scheduleNext() {
    // Cancel any existing timer
    this.cancel();

    const config = this.getConfig();
    const intervalMs = this.parseInterval(config.interval || config.intervalMs);

    // Calculate next scheduled time
    let nextTime = new Date(Date.now() + intervalMs);

    // Adjust for active hours if configured
    if (config.activeHours) {
      nextTime = this.adjustForActiveHours(nextTime, config.activeHours);
    }

    const delayMs = nextTime.getTime() - Date.now();

    console.log('[HeartbeatScheduler] Scheduling next heartbeat:', {
      nextTime: nextTime.toISOString(),
      delayMs,
      delayHuman: this.formatDuration(delayMs),
    });

    // Update state with scheduled time
    this.nextScheduledTime = nextTime;
    this.service.state.set('nextScheduledHeartbeat', nextTime.toISOString());
    this.service.state.save().catch((err) => {
      console.error('[HeartbeatScheduler] Failed to save state:', err);
    });

    // Schedule the heartbeat
    this.timer = setTimeout(async () => {
      try {
        await this.service.runHeartbeat();
      } catch (error) {
        console.error('[HeartbeatScheduler] Heartbeat execution failed:', error);
        // Still schedule next heartbeat even on failure
        this.scheduleNext();
      }
    }, delayMs);

    // Prevent timer from keeping Node.js process alive if nothing else is running
    // (Important for clean shutdown)
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Adjust scheduled time to fall within active hours
   * @param {Date} scheduledTime
   * @param {Object} activeHours - { start: 8, end: 22 }
   * @returns {Date}
   */
  adjustForActiveHours(scheduledTime, activeHours) {
    const { start = 8, end = 22 } = activeHours;
    const hour = scheduledTime.getHours();

    // If scheduled time is outside active hours, move to next active period
    if (hour < start) {
      // Too early - move to start of active hours today
      scheduledTime.setHours(start, 0, 0, 0);
    } else if (hour >= end) {
      // Too late - move to start of active hours tomorrow
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(start, 0, 0, 0);
    }

    return scheduledTime;
  }

  /**
   * Cancel the scheduled heartbeat
   */
  cancel() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      console.log('[HeartbeatScheduler] Scheduled heartbeat cancelled');
    }
  }

  /**
   * Trigger an immediate heartbeat (manual trigger)
   * @returns {Promise<Object>}
   */
  async triggerNow() {
    console.log('[HeartbeatScheduler] Manual heartbeat triggered');
    return this.service.runHeartbeat({ manual: true });
  }

  /**
   * Get time until next heartbeat
   * @returns {Object}
   */
  getTimeUntilNext() {
    if (!this.nextScheduledTime) {
      return null;
    }

    const ms = this.nextScheduledTime.getTime() - Date.now();
    return {
      ms,
      human: this.formatDuration(ms),
      scheduledTime: this.nextScheduledTime.toISOString(),
    };
  }

  /**
   * Format duration in human-readable format
   * @param {number} ms
   * @returns {string}
   */
  formatDuration(ms) {
    if (ms < 0) return 'overdue';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Calculate catch-up requirements
   * @returns {Object}
   */
  calculateCatchUp() {
    const config = this.getConfig();
    const lastHeartbeat = this.service.state.get('lastHeartbeat');

    if (!lastHeartbeat || !config.catchUp?.enabled) {
      return { needed: false };
    }

    const lastTime = new Date(lastHeartbeat);
    const now = new Date();
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);
    const daysSinceLast = hoursSinceLast / 24;

    const intervalHours = this.parseInterval(config.interval || config.intervalMs) / (1000 * 60 * 60);
    const missedHeartbeats = Math.floor(hoursSinceLast / intervalHours);

    // Cap at maxCatchUpDays
    const maxMissed = Math.floor((config.catchUp.maxCatchUpDays * 24) / intervalHours);
    const effectiveMissed = Math.min(missedHeartbeats, maxMissed);

    return {
      needed: missedHeartbeats > 0,
      hoursSinceLast,
      daysSinceLast,
      missedHeartbeats,
      effectiveMissed,
      willCatchUp: effectiveMissed > 0,
    };
  }
}

module.exports = HeartbeatScheduler;
