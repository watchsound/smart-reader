/**
 * ServiceState - Persistent state management for the background service
 *
 * Stores state in a JSON file that survives service restarts and computer reboots.
 * State file location:
 * - Windows: %APPDATA%/SmartReader/service-state.json
 * - macOS: ~/Library/Application Support/SmartReader/service-state.json
 * - Linux: ~/.config/smartreader/service-state.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class ServiceState {
  constructor(options = {}) {
    this.state = {};
    this.filePath = options.filePath || this.getDefaultStatePath();
    this.dirty = false;
    this.saveDebounceTimer = null;
    this.maxHistorySize = options.maxHistorySize || 50;
  }

  /**
   * Get the default state file path based on platform
   * @returns {string}
   */
  getDefaultStatePath() {
    let appDataDir;

    switch (process.platform) {
      case 'win32':
        appDataDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(appDataDir, 'SmartReader', 'service-state.json');

      case 'darwin':
        return path.join(
          os.homedir(),
          'Library',
          'Application Support',
          'SmartReader',
          'service-state.json'
        );

      default: // Linux and others
        appDataDir = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
        return path.join(appDataDir, 'smartreader', 'service-state.json');
    }
  }

  /**
   * Ensure the state directory exists
   */
  ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Load state from disk
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        this.state = JSON.parse(data);
        console.log('[ServiceState] Loaded state from', this.filePath);
      } else {
        this.state = this.getDefaultState();
        console.log('[ServiceState] No existing state, using defaults');
      }
    } catch (error) {
      console.error('[ServiceState] Failed to load state:', error);
      this.state = this.getDefaultState();
    }

    this.dirty = false;
    return this.state;
  }

  /**
   * Save state to disk
   */
  async save() {
    try {
      this.ensureDirectory();
      const data = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.filePath, data, 'utf8');
      this.dirty = false;
      console.log('[ServiceState] Saved state to', this.filePath);
    } catch (error) {
      console.error('[ServiceState] Failed to save state:', error);
      throw error;
    }
  }

  /**
   * Save state with debouncing (for frequent updates)
   * @param {number} delay - Debounce delay in ms (default: 1000)
   */
  saveDebouncedAsync(delay = 1000) {
    this.dirty = true;

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this.save().catch((err) => {
        console.error('[ServiceState] Debounced save failed:', err);
      });
    }, delay);
  }

  /**
   * Get default state structure
   * @returns {Object}
   */
  getDefaultState() {
    return {
      version: 1,
      lastHeartbeat: null,
      nextScheduledHeartbeat: null,
      lastBootTime: null,
      cachedInsights: null,
      heartbeatHistory: [],
      pendingNotifications: [],
      config: {
        heartbeat: {
          interval: '24h',
          activeHours: {
            start: 8,
            end: 22,
          },
          catchUp: {
            enabled: true,
            maxCatchUpDays: 7,
          },
        },
        notifications: {
          enabled: true,
          streakAlert: true,
          weeklyReport: true,
          struggleAlert: true,
          welcomeBack: true,
          dailySummary: true,
        },
      },
      lastStruggleAlert: null,
      lastWeeklyReport: null,
    };
  }

  /**
   * Get a state value
   * @param {string} key
   * @returns {any}
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Set a state value
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.state[key] = value;
    this.dirty = true;
  }

  /**
   * Check if state has unsaved changes
   * @returns {boolean}
   */
  isDirty() {
    return this.dirty;
  }

  /**
   * Add entry to heartbeat history
   * @param {Object} entry
   */
  addHeartbeatHistory(entry) {
    if (!this.state.heartbeatHistory) {
      this.state.heartbeatHistory = [];
    }

    this.state.heartbeatHistory.push(entry);

    // Trim history if too large
    if (this.state.heartbeatHistory.length > this.maxHistorySize) {
      this.state.heartbeatHistory = this.state.heartbeatHistory.slice(
        -this.maxHistorySize
      );
    }

    this.dirty = true;
  }

  /**
   * Get heartbeat history
   * @param {number} limit - Max entries to return
   * @returns {Array}
   */
  getHeartbeatHistory(limit = 10) {
    const history = this.state.heartbeatHistory || [];
    return history.slice(-limit);
  }

  /**
   * Add pending notification
   * @param {Object} notification
   */
  addPendingNotification(notification) {
    if (!this.state.pendingNotifications) {
      this.state.pendingNotifications = [];
    }

    this.state.pendingNotifications.push({
      ...notification,
      createdAt: new Date().toISOString(),
    });

    this.dirty = true;
  }

  /**
   * Get and clear pending notifications
   * @returns {Array}
   */
  getPendingNotifications() {
    const notifications = this.state.pendingNotifications || [];
    this.state.pendingNotifications = [];
    this.dirty = true;
    return notifications;
  }

  /**
   * Update configuration
   * @param {Object} config
   */
  updateConfig(config) {
    this.state.config = {
      ...this.state.config,
      ...config,
    };
    this.dirty = true;
  }

  /**
   * Get full state (for debugging/export)
   * @returns {Object}
   */
  getAll() {
    return { ...this.state };
  }

  /**
   * Clear all state (reset to defaults)
   */
  clear() {
    this.state = this.getDefaultState();
    this.dirty = true;
  }
}

module.exports = ServiceState;
