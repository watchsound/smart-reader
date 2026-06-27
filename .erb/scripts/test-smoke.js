#!/usr/bin/env node
/**
 * test-smoke.js — minimal Electron launch smoke test.
 *
 * What this catches (real bugs from this session that would have failed
 * a smoke test):
 *   - `require('electron-debug').default is not a function` (post-merge)
 *   - `SqliteError: no such table: learning_point` (brain heartbeat)
 *   - `TypeError: recordEvent.X is not a function` (Phase 8 wiring miss)
 *   - any uncaught exception logged to main-process stderr during boot
 *
 * What it does NOT catch:
 *   - UI bugs that only appear on interaction
 *   - renderer-side errors that don't bubble to the main process console
 *   - race conditions later than the SAMPLE_SECONDS window
 *
 * Why custom harness instead of Playwright: Playwright sends
 * `--remote-debugging-port=0` which Electron 26 rejects. Compatible
 * Playwright versions for Electron 26 are old and brittle. This harness
 * uses zero test-tooling — just Node child_process + a regex.
 *
 * Why dev entry, not the built bundle: `npm start:main` uses
 *   electronmon -r ts-node/register/transpile-only .
 * which loads src/main/main.ts directly and resolves deps from
 * src/node_modules where native modules are built for Electron's ABI.
 * The packaged bundle path (release/app/dist/main/main.js) depends on
 * `electron-builder install-app-deps` having populated
 * release/app/node_modules/, which is fragile and gets wiped any time
 * something triggers postinstall. We launch what the user actually runs.
 */

const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';

// How long to let Electron run before we assume "it's stable". Long
// enough for the brain heartbeat to fire once (heartbeat is ~3s into
// startup; checklist tasks ~5-7s).
const SAMPLE_SECONDS = 12;

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const APP_ENTRY = path.join(PROJECT_ROOT, 'src', 'main', 'main.ts');
const TS_NODE_LOADER = path.join(
  PROJECT_ROOT,
  'node_modules',
  'ts-node',
  'register',
  'transpile-only.js',
);
const ELECTRON_BIN = path.join(
  PROJECT_ROOT,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
);

// Lines matching these patterns trip the smoke test. Add new patterns
// as you find regressions; remove patterns only if they prove noisy.
// Each pattern must come with a one-line comment explaining what bug
// class it catches.
const ERROR_PATTERNS = [
  // require(...).X is not a function — covers the electron-debug merge
  // bug and the Phase 8 wiring bug (recordEvent.X undefined).
  /TypeError:.*is not a function/i,
  // Cannot read properties of undefined — covers the case where
  // `require('electron')` returns a string (script mode vs main-process
  // mode), so `import { app } from 'electron'` leaves `app` undefined.
  /TypeError: Cannot read properties of undefined/i,
  // SqliteError: no such table / column — covers init-table omissions.
  /SqliteError/,
  // Module resolution failures from typo'd imports.
  /Cannot find module/,
  // Uncaught exceptions from anywhere.
  /Uncaught Exception/i,
  // Sync IPC errors that crash the main process.
  /Failed to construct '.*': /i,
  // better-sqlite3 ABI mismatch — happens after test:integration leaves the
  // src/node_modules binary built for system Node instead of Electron.
  // Symptom: "was compiled against a different Node.js version using
  //          NODE_MODULE_VERSION X. This version of Node.js requires N."
  // Fix: `npm run rebuild` THEN copy the rebuilt binary from
  //      release/app/node_modules/better-sqlite3/build/Release/ into
  //      src/node_modules/better-sqlite3/build/Release/.
  /NODE_MODULE_VERSION/,
  // electronmon's "uncaught exception" line — generic catch-all for any
  // boot crash that the more specific patterns above miss.
  /\[electronmon\] uncaught exception/i,
];

// Lines matching these are benign and ignored even if they hit an
// error pattern. Each entry has a one-line WHY-IGNORED comment.
const IGNORE_PATTERNS = [
  // Node's punycode deprecation warning — not actionable for us.
  /DeprecationWarning.*punycode/,
  // electron-store first-run config-missing warning.
  /electron-store.*config not set/i,
  // (Kùzu-missing patterns removed in D3: SqliteAdapter is the default
  // graph backend now; Kùzu was retired because its prebuilt segfaults
  // Electron on Windows.)
];

function isFlagged(line) {
  if (IGNORE_PATTERNS.some((p) => p.test(line))) return false;
  return ERROR_PATTERNS.some((p) => p.test(line));
}

function preflight() {
  // Boot via project root (package.json `main` field) so Electron loads
  // the entry as the main process, NOT as a standalone Node script.
  // When invoked with an explicit script path, `require('electron')`
  // returns the path string instead of the API object, so destructured
  // imports like `import { app } from 'electron'` leave `app` undefined.
  const PKG_JSON = path.join(PROJECT_ROOT, 'package.json');
  if (!fs.existsSync(PKG_JSON)) {
    console.error(`[test-smoke] missing package.json at ${PROJECT_ROOT}`);
    process.exit(1);
  }
  if (!fs.existsSync(APP_ENTRY)) {
    console.error(`[test-smoke] missing main entry: ${APP_ENTRY}`);
    process.exit(1);
  }
  if (!fs.existsSync(ELECTRON_BIN)) {
    console.error(`[test-smoke] electron binary not found: ${ELECTRON_BIN}`);
    process.exit(1);
  }
  if (!fs.existsSync(TS_NODE_LOADER)) {
    console.error(`[test-smoke] ts-node loader not found: ${TS_NODE_LOADER}`);
    process.exit(1);
  }

  // better-sqlite3's native binary must be built for Electron's ABI,
  // not system Node's. Test:integration rebuilds it for Node and back
  // for Electron — if that ran but didn't finish the restore, this is
  // the wrong ABI and Electron crashes with a Windows access-violation
  // (3221225477) that looks scary but is just a bad module load. Bail
  // with the actual fix instead.
  const sqliteBin = path.join(
    PROJECT_ROOT,
    'src',
    'node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  );
  if (!fs.existsSync(sqliteBin)) {
    console.error(
      '[test-smoke] missing native module: better-sqlite3 binary not built.\n' +
        `  expected at: ${sqliteBin}\n` +
        '  fix with: `npm run rebuild` (rebuilds native deps for Electron)\n' +
        '  then re-run: `npm run test:smoke`',
    );
    process.exit(1);
  }
}

function run() {
  preflight();

  console.log(
    `[test-smoke] launching Electron via ts-node entry (matches npm start:main), sampling ${SAMPLE_SECONDS}s...`,
  );

  const flagged = [];
  // Pass PROJECT_ROOT (the dir containing package.json) so Electron
  // resolves the entry via the `main` field and runs it as the main
  // process. Passing APP_ENTRY directly puts Electron in node-script
  // mode where `require('electron')` returns a string path instead of
  // the API object.
  //
  // CRITICAL: explicitly delete ELECTRON_RUN_AS_NODE from the env. If
  // it is set (some shells / global configs set =1), Electron runs as
  // a plain Node binary — `require('electron')` returns the binary
  // path string, so `import { app } from 'electron'` gives undefined
  // and main.ts crashes at the first `app.isPackaged` access.
  const childEnv = {
    ...process.env,
    // dev mode so resolveHtmlPath uses localhost:1212; renderer
    // window may show ECONNREFUSED if the dev server isn't up,
    // but main-process boot is what we care about here.
    NODE_ENV: 'development',
    TS_NODE_TRANSPILE_ONLY: 'true',
  };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  const proc = spawn(
    ELECTRON_BIN,
    ['-r', 'ts-node/register/transpile-only', PROJECT_ROOT],
    {
      cwd: PROJECT_ROOT,
      env: childEnv,
    },
  );

  const onChunk = (stream) => (chunk) => {
    const text = chunk.toString();
    text.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      if (isFlagged(line)) {
        flagged.push({ stream, line: line.trim() });
        // Echo flagged lines immediately so failures are findable
        // in the console even before the final summary.
        console.error(`[test-smoke] FLAGGED (${stream}): ${line.trim()}`);
      }
    });
  };

  proc.stdout.on('data', onChunk('stdout'));
  proc.stderr.on('data', onChunk('stderr'));

  let exitedEarly = null;
  proc.on('exit', (code, signal) => {
    if (code !== 0 && signal == null) {
      exitedEarly = { code, signal };
    } else if (signal && signal !== 'SIGTERM') {
      // SIGTERM is what we send on our happy-path kill; anything else
      // (SIGSEGV, SIGABRT, etc.) is a crash.
      exitedEarly = { code, signal };
    }
  });

  setTimeout(() => {
    if (exitedEarly) {
      console.error(
        `[test-smoke] FAIL: Electron exited early before ${SAMPLE_SECONDS}s ` +
          `(code=${exitedEarly.code} signal=${exitedEarly.signal})`,
      );
      process.exit(1);
    }

    // Kill the Electron PROCESS TREE, not just the parent. Electron spawns
    // GPU / renderer / utility helpers; killing only the parent orphans
    // them and they keep native-module file handles (esp. better_sqlite3.node)
    // open. On Windows a subsequent `test-integration` rebuild then fails
    // with EBUSY because the .node file is still locked.
    //
    // Wait for the OS to confirm the parent has exited before reporting,
    // then add a brief NTFS settle delay so file handles drain.
    if (isWin) {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(proc.pid)], {
        stdio: 'ignore',
      });
    } else {
      proc.kill('SIGTERM');
    }

    const finish = () => {
      // Extra NTFS handle-release window on Windows. Empirically 1500ms is
      // enough for better_sqlite3.node to become writable again after the
      // process tree dies.
      const settleMs = isWin ? 1500 : 200;
      setTimeout(() => {
        if (flagged.length === 0) {
          console.log('[test-smoke] PASS: no flagged lines during boot');
          process.exit(0);
        } else {
          console.error(
            `\n[test-smoke] FAIL: ${flagged.length} flagged line(s) during boot:`,
          );
          flagged.forEach((f, i) => {
            console.error(`  ${i + 1}. [${f.stream}] ${f.line}`);
          });
          process.exit(1);
        }
      }, settleMs);
    };

    // If proc already exited, finish immediately; otherwise wait for the
    // exit event so we don't race the kill.
    if (proc.exitCode != null || proc.signalCode != null) {
      finish();
    } else {
      proc.once('exit', finish);
      // Hard backstop — if `exit` never fires for some reason, don't hang.
      setTimeout(finish, 5000);
    }
  }, SAMPLE_SECONDS * 1000);
}

run();
