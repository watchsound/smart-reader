/**
 * ServiceClient - IPC client for communicating with the background service
 *
 * Connects to the background service via Named Pipe (Windows) or Unix Socket (macOS/Linux)
 * and provides methods to query status, trigger heartbeats, etc.
 */

const net = require('net');
const path = require('path');
const os = require('os');

class ServiceClient {
  constructor() {
    this.socket = null;
    this.pipePath = this.getPipePath();
    this.connected = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.eventHandlers = new Map();
  }

  /**
   * Get the pipe/socket path based on platform
   * @returns {string}
   */
  getPipePath() {
    if (process.platform === 'win32') {
      return '\\\\.\\pipe\\smartreader-brain';
    } else {
      return path.join(os.tmpdir(), 'smartreader-brain.sock');
    }
  }

  /**
   * Connect to the background service
   * @param {number} timeout - Connection timeout in ms
   * @returns {Promise<boolean>}
   */
  async connect(timeout = 5000) {
    if (this.connected) {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutHandle = setTimeout(() => {
        console.log('[ServiceClient] Connection timeout');
        this.socket?.destroy();
        resolve(false);
      }, timeout);

      this.socket = net.createConnection(this.pipePath, () => {
        clearTimeout(timeoutHandle);
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('[ServiceClient] Connected to service');
        resolve(true);
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.connected = false;
        console.log('[ServiceClient] Disconnected from service');
      });

      this.socket.on('error', (err) => {
        clearTimeout(timeoutHandle);
        console.log('[ServiceClient] Connection error:', err.message);
        this.connected = false;
        resolve(false);
      });
    });
  }

  /**
   * Disconnect from the service
   */
  disconnect() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Handle incoming data from service
   * @param {Buffer} data
   */
  handleData(data) {
    this.buffer += data.toString();

    // Process complete messages (newline-delimited JSON)
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const message = this.buffer.substring(0, newlineIndex);
      this.buffer = this.buffer.substring(newlineIndex + 1);

      if (message.trim()) {
        this.handleMessage(message);
      }
    }
  }

  /**
   * Handle a complete message from service
   * @param {string} messageStr
   */
  handleMessage(messageStr) {
    try {
      const message = JSON.parse(messageStr);

      // Check if it's a response to a request
      if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          this.pendingRequests.delete(message.id);
          if (message.error) {
            pending.reject(new Error(message.error));
          } else {
            pending.resolve(message.result);
          }
        }
      }
      // Check if it's an event (push from service)
      else if (message.type) {
        this.handleEvent(message.type, message.data);
      }
    } catch (e) {
      console.error('[ServiceClient] Failed to parse message:', e);
    }
  }

  /**
   * Handle event from service
   * @param {string} type
   * @param {any} data
   */
  handleEvent(type, data) {
    const handlers = this.eventHandlers.get(type) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error('[ServiceClient] Event handler error:', e);
      }
    }
  }

  /**
   * Register event handler
   * @param {string} type
   * @param {Function} handler
   */
  on(type, handler) {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, []);
    }
    this.eventHandlers.get(type).push(handler);
  }

  /**
   * Remove event handler
   * @param {string} type
   * @param {Function} handler
   */
  off(type, handler) {
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Send a request to the service
   * @param {string} method
   * @param {Object} params
   * @param {number} timeout
   * @returns {Promise<any>}
   */
  async request(method, params = {}, timeout = 10000) {
    if (!this.connected) {
      const reconnected = await this.connect();
      if (!reconnected) {
        throw new Error('Not connected to service');
      }
    }

    const id = ++this.requestId;
    const request = { id, method, params };

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutHandle);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
      });

      // Send request
      try {
        const data = JSON.stringify(request) + '\n';
        this.socket.write(data);
      } catch (e) {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutHandle);
        reject(e);
      }
    });
  }

  // ================== High-level API methods ==================

  /**
   * Ping the service
   * @returns {Promise<Object>}
   */
  async ping() {
    return this.request('ping');
  }

  /**
   * Get service status
   * @returns {Promise<Object>}
   */
  async getStatus() {
    return this.request('getStatus');
  }

  /**
   * Get cached insights
   * @returns {Promise<Object>}
   */
  async getInsights() {
    return this.request('getInsights');
  }

  /**
   * Trigger an immediate heartbeat
   * @returns {Promise<Object>}
   */
  async triggerHeartbeat() {
    return this.request('triggerHeartbeat', {}, 60000); // 60s timeout for heartbeat
  }

  /**
   * Get time until next heartbeat
   * @returns {Promise<Object>}
   */
  async getTimeUntilNext() {
    return this.request('getTimeUntilNext');
  }

  /**
   * Get heartbeat history
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async getHeartbeatHistory(limit = 10) {
    return this.request('getHeartbeatHistory', { limit });
  }

  /**
   * Update service configuration
   * @param {Object} config
   * @returns {Promise<Object>}
   */
  async updateConfig(config) {
    return this.request('updateConfig', { config });
  }

  /**
   * Check if service is running
   * @returns {Promise<boolean>}
   */
  async isServiceRunning() {
    try {
      const status = await this.getStatus();
      return status && status.running;
    } catch (e) {
      return false;
    }
  }
}

module.exports = ServiceClient;
