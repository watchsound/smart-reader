/**
 * IPCServer - Inter-process communication server for service-app communication
 *
 * Uses Named Pipes (Windows) or Unix Sockets (macOS/Linux) for reliable
 * bi-directional communication between the background service and main Electron app.
 */

const net = require('net');
const path = require('path');
const os = require('os');
const fs = require('fs');

class IPCServer {
  constructor(service) {
    this.service = service;
    this.server = null;
    this.clients = new Set();
    this.pipePath = this.getPipePath();
  }

  /**
   * Get the pipe/socket path based on platform
   * @returns {string}
   */
  getPipePath() {
    if (process.platform === 'win32') {
      return '\\\\.\\pipe\\smartreader-brain';
    } else {
      // Unix socket
      const tmpDir = os.tmpdir();
      return path.join(tmpDir, 'smartreader-brain.sock');
    }
  }

  /**
   * Start the IPC server
   */
  async start() {
    return new Promise((resolve, reject) => {
      // Clean up old socket file if exists (Unix only)
      if (process.platform !== 'win32' && fs.existsSync(this.pipePath)) {
        fs.unlinkSync(this.pipePath);
      }

      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', (err) => {
        console.error('[IPCServer] Server error:', err);
        if (err.code === 'EADDRINUSE') {
          // Try to clean up and restart
          if (process.platform !== 'win32') {
            fs.unlinkSync(this.pipePath);
            this.server.listen(this.pipePath);
          }
        }
        reject(err);
      });

      this.server.listen(this.pipePath, () => {
        console.log('[IPCServer] Listening on', this.pipePath);
        resolve();
      });
    });
  }

  /**
   * Stop the IPC server
   */
  async stop() {
    return new Promise((resolve) => {
      // Close all client connections
      for (const client of this.clients) {
        try {
          client.end();
        } catch (e) {
          // Ignore errors during shutdown
        }
      }
      this.clients.clear();

      if (this.server) {
        this.server.close(() => {
          console.log('[IPCServer] Server stopped');

          // Clean up socket file (Unix only)
          if (process.platform !== 'win32' && fs.existsSync(this.pipePath)) {
            try {
              fs.unlinkSync(this.pipePath);
            } catch (e) {
              // Ignore
            }
          }

          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new client connection
   * @param {net.Socket} socket
   */
  handleConnection(socket) {
    console.log('[IPCServer] Client connected');
    this.clients.add(socket);

    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited JSON)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const message = buffer.substring(0, newlineIndex);
        buffer = buffer.substring(newlineIndex + 1);

        if (message.trim()) {
          this.handleMessage(socket, message);
        }
      }
    });

    socket.on('close', () => {
      console.log('[IPCServer] Client disconnected');
      this.clients.delete(socket);
    });

    socket.on('error', (err) => {
      console.error('[IPCServer] Socket error:', err);
      this.clients.delete(socket);
    });
  }

  /**
   * Handle incoming message from client
   * @param {net.Socket} socket
   * @param {string} message
   */
  async handleMessage(socket, message) {
    try {
      const request = JSON.parse(message);
      const { id, method, params } = request;

      console.log('[IPCServer] Received:', method);

      let result;
      let error;

      try {
        result = await this.dispatchMethod(method, params);
      } catch (e) {
        error = e.message;
      }

      // Send response
      const response = { id, result, error };
      this.sendToClient(socket, response);
    } catch (e) {
      console.error('[IPCServer] Failed to parse message:', e);
    }
  }

  /**
   * Dispatch method call to appropriate handler
   * @param {string} method
   * @param {Object} params
   * @returns {any}
   */
  async dispatchMethod(method, params = {}) {
    switch (method) {
      case 'getStatus':
        return this.service.getStatus();

      case 'getInsights':
        return this.service.getInsights();

      case 'triggerHeartbeat':
        return this.service.scheduler.triggerNow();

      case 'updateConfig':
        await this.service.updateConfig(params.config);
        return { success: true };

      case 'getTimeUntilNext':
        return this.service.scheduler.getTimeUntilNext();

      case 'getHeartbeatHistory':
        return this.service.state.getHeartbeatHistory(params.limit || 10);

      case 'ping':
        return { pong: true, timestamp: Date.now() };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Send message to a specific client
   * @param {net.Socket} socket
   * @param {Object} message
   */
  sendToClient(socket, message) {
    try {
      const data = JSON.stringify(message) + '\n';
      socket.write(data);
    } catch (e) {
      console.error('[IPCServer] Failed to send to client:', e);
    }
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message
   */
  broadcast(message) {
    const data = JSON.stringify(message) + '\n';
    for (const client of this.clients) {
      try {
        client.write(data);
      } catch (e) {
        console.error('[IPCServer] Failed to broadcast to client:', e);
      }
    }
  }

  /**
   * Send notification event to all clients
   * @param {Object} notification
   */
  notifyClients(notification) {
    this.broadcast({
      type: 'notification',
      data: notification,
    });
  }

  /**
   * Send heartbeat completed event to all clients
   * @param {Object} result
   */
  notifyHeartbeatComplete(result) {
    this.broadcast({
      type: 'heartbeatComplete',
      data: result,
    });
  }

  /**
   * Check if any clients are connected
   * @returns {boolean}
   */
  hasClients() {
    return this.clients.size > 0;
  }

  /**
   * Get connected client count
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = IPCServer;
