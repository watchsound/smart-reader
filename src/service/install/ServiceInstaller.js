/**
 * ServiceInstaller - Cross-platform background service installer
 *
 * Installs the SmartReader background service as:
 * - Windows: Windows Service (via node-windows)
 * - macOS: LaunchDaemon (via node-mac)
 * - Linux: systemd service (via node-linux)
 *
 * Usage:
 *   const installer = new ServiceInstaller();
 *   await installer.install();  // Install the service
 *   await installer.uninstall(); // Uninstall the service
 *   await installer.start();    // Start the service
 *   await installer.stop();     // Stop the service
 */

const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

class ServiceInstaller {
  constructor(options = {}) {
    this.serviceName = options.serviceName || 'SmartReaderBrain';
    this.serviceDescription =
      options.serviceDescription ||
      'SmartReader Learning Brain - Background service for learning analytics and notifications';
    this.scriptPath =
      options.scriptPath || path.join(__dirname, '..', 'index.js');

    // Platform-specific installer
    this.platformInstaller = null;
  }

  /**
   * Get the platform-specific installer
   * @returns {Object}
   */
  getPlatformInstaller() {
    if (this.platformInstaller) {
      return this.platformInstaller;
    }

    const platform = process.platform;

    try {
      switch (platform) {
        case 'win32':
          return this.getWindowsInstaller();
        case 'darwin':
          return this.getMacInstaller();
        default:
          return this.getLinuxInstaller();
      }
    } catch (error) {
      console.error('[ServiceInstaller] Failed to load platform installer:', error);
      return null;
    }
  }

  /**
   * Get Windows service installer
   */
  getWindowsInstaller() {
    try {
      const Service = require('node-windows').Service;

      this.platformInstaller = new Service({
        name: this.serviceName,
        description: this.serviceDescription,
        script: this.scriptPath,
        nodeOptions: ['--harmony', '--max_old_space_size=256'],
        workingDirectory: path.dirname(this.scriptPath),
        allowServiceLogon: true,
      });

      return this.platformInstaller;
    } catch (e) {
      console.error('[ServiceInstaller] node-windows not available:', e.message);
      return null;
    }
  }

  /**
   * Get macOS service installer
   */
  getMacInstaller() {
    try {
      const Service = require('node-mac').Service;

      this.platformInstaller = new Service({
        name: this.serviceName,
        description: this.serviceDescription,
        script: this.scriptPath,
        nodeOptions: ['--harmony', '--max_old_space_size=256'],
        workingDirectory: path.dirname(this.scriptPath),
        logpath: path.join(
          process.env.HOME,
          'Library',
          'Logs',
          'SmartReader'
        ),
      });

      return this.platformInstaller;
    } catch (e) {
      console.error('[ServiceInstaller] node-mac not available:', e.message);
      return null;
    }
  }

  /**
   * Get Linux service installer
   */
  getLinuxInstaller() {
    try {
      const Service = require('node-linux').Service;

      this.platformInstaller = new Service({
        name: this.serviceName,
        description: this.serviceDescription,
        script: this.scriptPath,
        nodeOptions: ['--harmony', '--max_old_space_size=256'],
        workingDirectory: path.dirname(this.scriptPath),
        user: process.env.USER || 'root',
        group: process.env.USER || 'root',
      });

      return this.platformInstaller;
    } catch (e) {
      console.error('[ServiceInstaller] node-linux not available:', e.message);
      return null;
    }
  }

  /**
   * Install the background service
   * @returns {Promise<Object>}
   */
  async install() {
    return new Promise((resolve) => {
      const installer = this.getPlatformInstaller();

      if (!installer) {
        resolve({
          success: false,
          error: 'Platform installer not available. Install node-windows/mac/linux package.',
          fallbackMode: true,
        });
        return;
      }

      console.log('[ServiceInstaller] Installing service...');

      // Listen for install events
      installer.on('install', () => {
        console.log('[ServiceInstaller] Service installed successfully');
        // Start the service after installation
        installer.start();
      });

      installer.on('alreadyinstalled', () => {
        console.log('[ServiceInstaller] Service already installed');
        resolve({ success: true, alreadyInstalled: true });
      });

      installer.on('start', () => {
        console.log('[ServiceInstaller] Service started');
        resolve({ success: true, started: true });
      });

      installer.on('error', (err) => {
        console.error('[ServiceInstaller] Installation error:', err);
        resolve({
          success: false,
          error: err.message || String(err),
          fallbackMode: true,
        });
      });

      installer.on('invalidinstallation', () => {
        console.error('[ServiceInstaller] Invalid installation');
        resolve({
          success: false,
          error: 'Invalid installation',
          fallbackMode: true,
        });
      });

      // Start installation
      try {
        installer.install();
      } catch (e) {
        resolve({
          success: false,
          error: e.message,
          fallbackMode: true,
        });
      }
    });
  }

  /**
   * Uninstall the background service
   * @returns {Promise<Object>}
   */
  async uninstall() {
    return new Promise((resolve) => {
      const installer = this.getPlatformInstaller();

      if (!installer) {
        resolve({ success: false, error: 'Platform installer not available' });
        return;
      }

      console.log('[ServiceInstaller] Uninstalling service...');

      installer.on('uninstall', () => {
        console.log('[ServiceInstaller] Service uninstalled');
        resolve({ success: true });
      });

      installer.on('alreadyuninstalled', () => {
        console.log('[ServiceInstaller] Service already uninstalled');
        resolve({ success: true, alreadyUninstalled: true });
      });

      installer.on('error', (err) => {
        console.error('[ServiceInstaller] Uninstall error:', err);
        resolve({ success: false, error: err.message || String(err) });
      });

      try {
        installer.uninstall();
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  /**
   * Start the service
   * @returns {Promise<Object>}
   */
  async start() {
    return new Promise((resolve) => {
      const installer = this.getPlatformInstaller();

      if (!installer) {
        resolve({ success: false, error: 'Platform installer not available' });
        return;
      }

      installer.on('start', () => {
        console.log('[ServiceInstaller] Service started');
        resolve({ success: true });
      });

      installer.on('error', (err) => {
        resolve({ success: false, error: err.message || String(err) });
      });

      try {
        installer.start();
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  /**
   * Stop the service
   * @returns {Promise<Object>}
   */
  async stop() {
    return new Promise((resolve) => {
      const installer = this.getPlatformInstaller();

      if (!installer) {
        resolve({ success: false, error: 'Platform installer not available' });
        return;
      }

      installer.on('stop', () => {
        console.log('[ServiceInstaller] Service stopped');
        resolve({ success: true });
      });

      installer.on('error', (err) => {
        resolve({ success: false, error: err.message || String(err) });
      });

      try {
        installer.stop();
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  /**
   * Check if service is installed
   * @returns {boolean}
   */
  isInstalled() {
    const platform = process.platform;

    try {
      if (platform === 'win32') {
        // Check Windows service
        const result = execSync(`sc query "${this.serviceName}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.includes('STATE');
      } else if (platform === 'darwin') {
        // Check macOS LaunchDaemon
        const plistPath = `/Library/LaunchDaemons/${this.serviceName}.plist`;
        return fs.existsSync(plistPath);
      } else {
        // Check Linux systemd
        const servicePath = `/etc/systemd/system/${this.serviceName}.service`;
        return fs.existsSync(servicePath);
      }
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if service is running
   * @returns {boolean}
   */
  isRunning() {
    const platform = process.platform;

    try {
      if (platform === 'win32') {
        const result = execSync(`sc query "${this.serviceName}"`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.includes('RUNNING');
      } else if (platform === 'darwin') {
        const result = execSync(`launchctl list | grep ${this.serviceName}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.length > 0;
      } else {
        const result = execSync(`systemctl is-active ${this.serviceName}`, {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return result.trim() === 'active';
      }
    } catch (e) {
      return false;
    }
  }

  /**
   * Get service status
   * @returns {Object}
   */
  getStatus() {
    return {
      platform: process.platform,
      serviceName: this.serviceName,
      installed: this.isInstalled(),
      running: this.isRunning(),
      scriptPath: this.scriptPath,
      installerAvailable: this.getPlatformInstaller() !== null,
    };
  }

  /**
   * Check if the required platform package is available
   * @returns {Object}
   */
  checkDependencies() {
    const platform = process.platform;
    let packageName;
    let available = false;

    switch (platform) {
      case 'win32':
        packageName = 'node-windows';
        break;
      case 'darwin':
        packageName = 'node-mac';
        break;
      default:
        packageName = 'node-linux';
    }

    try {
      require(packageName);
      available = true;
    } catch (e) {
      available = false;
    }

    return {
      platform,
      packageName,
      available,
      installCommand: `npm install ${packageName}`,
    };
  }
}

// CLI usage
if (require.main === module) {
  const installer = new ServiceInstaller();
  const command = process.argv[2];

  const commands = {
    install: () => installer.install(),
    uninstall: () => installer.uninstall(),
    start: () => installer.start(),
    stop: () => installer.stop(),
    status: () => Promise.resolve(installer.getStatus()),
    check: () => Promise.resolve(installer.checkDependencies()),
  };

  if (!command || !commands[command]) {
    console.log('Usage: node ServiceInstaller.js <command>');
    console.log('Commands: install, uninstall, start, stop, status, check');
    process.exit(1);
  }

  commands[command]()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success !== false ? 0 : 1);
    })
    .catch((err) => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = ServiceInstaller;
