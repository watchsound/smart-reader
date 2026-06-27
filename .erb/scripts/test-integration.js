/**
 * test-integration.js
 *
 * Runs the Jest integration suite (`src/__tests__/integration/`) with
 * better-sqlite3 rebuilt against system Node so the real-SQLite suites
 * (phase8) can load. After the run — pass OR fail — rebuilds the binary
 * back against Electron's ABI so `npm start` keeps working.
 *
 * Without this dance, anyone running `npx jest integration` from a tree
 * where the Electron app has been built will see all SQLite-backed
 * suites skipped (the .node binary fails to load against system Node).
 */

const { spawnSync } = require('child_process');
const { copyFileWithRetry, verifyBinaryAbi } = require('./lib/binary-abi');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

function run(cmd, args, opts = {}) {
  // eslint-disable-next-line no-console
  console.log(`\n$ ${cmd} ${args.join(' ')}\n`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: isWin, // .cmd shims on Windows
    ...opts,
  });
  return result.status === null ? 1 : result.status;
}

function rebuildForNode() {
  // Install a prebuilt better-sqlite3 binary for system Node ABI into
  // release/app/node_modules (where better-sqlite3 lives as a dep).
  // We use prebuild-install (bundled with better-sqlite3) to download the
  // prebuilt binary for the running Node version, bypassing node-gyp which
  // fails on Windows paths containing non-ASCII characters (MSBuild limit).
  //
  // After that, we copy the Node-ABI binary into src/node_modules/better-sqlite3
  // too, since Jest also resolves that hoisted copy first (moduleDirectories: ["src"]).
  const { existsSync } = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..');
  const bsqDir = path.join(root, 'release', 'app', 'node_modules', 'better-sqlite3');
  const prebuildBin = path.join(
    root, 'release', 'app', 'node_modules', '.bin', isWin ? 'prebuild-install.cmd' : 'prebuild-install',
  );

  if (existsSync(bsqDir) && existsSync(prebuildBin)) {
    const nodeVersion = process.version.slice(1); // strip leading 'v'
    const prebuildStatus = run(prebuildBin, ['--runtime', 'node', '--target', nodeVersion], { cwd: bsqDir });
    if (prebuildStatus !== 0) return prebuildStatus;

    // Copy the freshly installed Node-ABI binary to the Jest-resolved copy.
    const nodeBinary = path.join(bsqDir, 'build', 'Release', 'better_sqlite3.node');
    const jestCopy = path.join(root, 'src', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    if (existsSync(nodeBinary) && existsSync(path.dirname(jestCopy))) {
      // eslint-disable-next-line no-console
      console.log('[test-integration] copying system-Node binary to src/node_modules');
      try {
        // 30 attempts × 500ms = up to 15s wait for the file lock to clear.
        // Windows holds .node handles for a surprising amount of time after
        // an Electron child tree dies — the default 5×300ms=1.5s wasn't
        // enough when a prior smoke run lingered.
        copyFileWithRetry(nodeBinary, jestCopy, { attempts: 30, delayMs: 500 });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[test-integration] ${err.message}`);
        return 1;
      }
    }

    // Belt-and-suspenders: if the copy succeeded but the resulting
    // binary still can't load under system Node (stale file picked up
    // from somewhere, partial copy, wrong-ABI override), fail loudly
    // here rather than letting every integration test silently skip
    // and the run look green.
    if (existsSync(jestCopy)) {
      const verify = verifyBinaryAbi(jestCopy);
      if (!verify.ok) {
        // eslint-disable-next-line no-console
        console.error(
          `[test-integration] FATAL: ${jestCopy} is NOT loadable under system Node ` +
            `(NODE_MODULE_VERSION ${verify.expectedAbi}). ` +
            (verify.actualAbi != null
              ? `Found NODE_MODULE_VERSION ${verify.actualAbi} (probably Electron-ABI).`
              : `Error: ${verify.error}`) +
            ` Integration tests would skip silently with this binary in place.`,
        );
        return 1;
      }
    }
    return 0;
  }

  // Fallback: try npm rebuild (may fail silently on this setup)
  return run(npmCmd, ['rebuild', 'better-sqlite3']);
}

function rebuildForElectron() {
  // Restore the Electron binary by fetching the Electron-ABI prebuilt
  // directly via prebuild-install. The package-level `npm run rebuild`
  // delegates to electron-rebuild, which is unreliable on this codebase:
  //   - It treats "build/Release/better_sqlite3.node already exists" as
  //     "nothing to do" — leaving the Node-ABI binary from runJest's
  //     rebuildForNode step in place.
  //   - On Windows with non-ASCII project paths it falls back to
  //     node-gyp-from-source, which then fails (MSBuild can't handle
  //     non-ASCII path segments). The failure surfaces as a noisy
  //     exception, but only after we've already wasted minutes.
  // prebuild-install is the underlying tool that actually downloads
  // the v116 prebuild from the better-sqlite3 GitHub releases. We
  // invoke it directly with the explicit Electron target.
  const { existsSync, rmSync } = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..', '..');
  const releaseAppBsq = path.join(
    root, 'release', 'app', 'node_modules', 'better-sqlite3',
  );
  const releaseAppBinary = path.join(
    releaseAppBsq, 'build', 'Release', 'better_sqlite3.node',
  );
  const srcCopy = path.join(
    root, 'src', 'node_modules', 'better-sqlite3',
    'build', 'Release', 'better_sqlite3.node',
  );

  // Wipe stale Node-ABI artifacts so prebuild-install does the install.
  for (const target of [
    path.join(releaseAppBsq, 'build'),
    path.join(releaseAppBsq, 'prebuilds'),
  ]) {
    if (existsSync(target)) {
      try { rmSync(target, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
    }
  }

  // Look up Electron's version from its installed package.json so this
  // doesn't drift when Electron is bumped.
  let electronVersion;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
  } catch (_e) {
    // eslint-disable-next-line no-console
    console.error('[test-integration] could not read electron version');
    return 1;
  }

  const prebuildInstall = path.join(
    root, 'release', 'app', 'node_modules', '.bin',
    isWin ? 'prebuild-install.cmd' : 'prebuild-install',
  );
  if (!existsSync(prebuildInstall)) {
    // eslint-disable-next-line no-console
    console.error('[test-integration] prebuild-install not found at', prebuildInstall);
    return 1;
  }
  const status = run(prebuildInstall, ['--runtime', 'electron', '--target', electronVersion], {
    cwd: releaseAppBsq,
  });
  if (status !== 0) {
    // eslint-disable-next-line no-console
    console.error('[test-integration] prebuild-install failed for Electron target', electronVersion);
    return status;
  }

  // Verify the fetched binary is genuinely Electron-ABI. If it loads under
  // system Node, the prebuild ended up Node-ABI (shouldn't happen, but
  // detect rather than silently propagate).
  if (!existsSync(releaseAppBinary)) {
    // eslint-disable-next-line no-console
    console.error('[test-integration] prebuild-install reported success but no binary exists');
    return 1;
  }
  let isElectronAbi = false;
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    require(releaseAppBinary);
  } catch (e) {
    if (/NODE_MODULE_VERSION/.test(String(e && e.message))) isElectronAbi = true;
  }
  if (!isElectronAbi) {
    // eslint-disable-next-line no-console
    console.error(
      '[test-integration] FATAL: fetched binary loads under system Node — wrong ABI. ' +
        '`npm start` would fail.',
    );
    return 1;
  }

  if (existsSync(path.dirname(srcCopy))) {
    // eslint-disable-next-line no-console
    console.log('[test-integration] copying Electron-ABI binary back to src/node_modules');
    try {
      // Same generous retry budget as the system-Node copy above.
      copyFileWithRetry(releaseAppBinary, srcCopy, { attempts: 30, delayMs: 500 });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[test-integration] ${err.message}`);
      return 1;
    }
  }
  return 0;
}

function runJest() {
  return run(npxCmd, [
    'jest',
    'src/__tests__/integration/',
    'src/__tests__/main/',
    'src/__tests__/db/',
    'src/__tests__/spine/',
    'src/__tests__/utils/',
    'src/__tests__/brain/SessionRunner.attribution.test.js',
    'src/__tests__/ipc/microCardHandlers.masteryEvent.test.js',
    'src/__tests__/ipc/forumHandlers.test.js',
    '--no-coverage',
    // Override testPathIgnorePatterns from package.json — those exclusions
    // exist so `npm test` skips DB-touching files; this runner explicitly
    // re-includes them after rebuilding better-sqlite3 for system Node.
    '--testPathIgnorePatterns',
    'release/app/dist',
    '--testPathIgnorePatterns',
    '.erb/dll',
    '--testPathIgnorePatterns',
    'src/__tests__/setup.js',
    '--testPathIgnorePatterns',
    '__fixtures__',
  ]);
}

(async function main() {
  // eslint-disable-next-line no-console
  console.log('[test-integration] rebuilding better-sqlite3 for system Node...');
  const rebuildStatus = rebuildForNode();
  if (rebuildStatus !== 0) {
    // eslint-disable-next-line no-console
    console.error('[test-integration] rebuild for Node failed; aborting.');
    process.exit(rebuildStatus);
  }

  let jestStatus = 1;
  try {
    jestStatus = runJest();
  } finally {
    // eslint-disable-next-line no-console
    console.log(
      '\n[test-integration] restoring Electron binary so `npm start` works again...',
    );
    const restoreStatus = rebuildForElectron();
    if (restoreStatus !== 0) {
      // eslint-disable-next-line no-console
      console.error(
        '[test-integration] WARNING: failed to restore Electron binary. ' +
          'Run `npm run rebuild` manually before `npm start`.',
      );
      // Prefer surfacing the more diagnostic failure: if Jest failed,
      // exit with that; otherwise exit with the restore failure.
      process.exit(jestStatus !== 0 ? jestStatus : restoreStatus);
    }
  }

  process.exit(jestStatus);
})();
