#!/usr/bin/env node
/**
 * start-main.js — launch electron + electronmon as the main process.
 *
 * Why this script exists: some shells / global configs set
 *   ELECTRON_RUN_AS_NODE=1
 * which forces Electron to run as a plain Node binary. In that mode
 * `require('electron')` returns the path string instead of the API
 * object, so `import { app } from 'electron'` in main.ts leaves
 * `app` undefined and the app crashes immediately at the first
 * `app.isPackaged` access. `cross-env VAR=` only SETS to empty —
 * Electron treats "set but empty" the same as "set to 1" (the C
 * getenv check is non-null, not truthy), so cross-env alone can't
 * fix this. We delete the variable here in Node before spawning.
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');

const env = { ...process.env, NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true' };
delete env.ELECTRON_RUN_AS_NODE;

const isWin = process.platform === 'win32';
const electronmonBin = path.join(
  __dirname, '..', '..', 'node_modules', '.bin',
  isWin ? 'electronmon.cmd' : 'electronmon',
);

const RENDERER_PORT = Number(process.env.PORT || 1212);
const WAIT_MS = 60_000;

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`renderer dev server on :${port} did not come up within ${timeoutMs}ms`));
        } else {
          setTimeout(attempt, 500);
        }
      });
    };
    attempt();
  });
}

async function main() {
  // If npm start ran both concurrently, the renderer dev server may not
  // be listening yet. Wait until it is before launching Electron, otherwise
  // BrowserWindow.loadURL hits ECONNREFUSED.
  process.stdout.write(`[start-main] waiting for renderer on :${RENDERER_PORT}...\n`);
  await waitForPort(RENDERER_PORT, WAIT_MS);
  process.stdout.write(`[start-main] renderer up, launching Electron\n`);

  const proc = spawn(
    electronmonBin,
    ['-r', 'ts-node/register/transpile-only', '.'],
    { stdio: 'inherit', env, shell: isWin, cwd: path.join(__dirname, '..', '..') },
  );
  proc.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  process.stderr.write(`[start-main] ${err.message}\n`);
  process.exit(1);
});
