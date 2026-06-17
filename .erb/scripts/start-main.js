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
const path = require('path');

const env = { ...process.env, NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true' };
delete env.ELECTRON_RUN_AS_NODE;

const isWin = process.platform === 'win32';
const electronmonBin = path.join(
  __dirname, '..', '..', 'node_modules', '.bin',
  isWin ? 'electronmon.cmd' : 'electronmon',
);

const proc = spawn(
  electronmonBin,
  ['-r', 'ts-node/register/transpile-only', '.'],
  { stdio: 'inherit', env, shell: isWin, cwd: path.join(__dirname, '..', '..') },
);
proc.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
