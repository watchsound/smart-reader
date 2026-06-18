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
  const { existsSync, copyFileSync } = require('fs');
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
      copyFileSync(nodeBinary, jestCopy);
    }
    return 0;
  }

  // Fallback: try npm rebuild (may fail silently on this setup)
  return run(npmCmd, ['rebuild', 'better-sqlite3']);
}

function rebuildForElectron() {
  // Restore the Electron binary. Two pitfalls electron-rebuild trips on:
  //   1. It treats "build/Release/better_sqlite3.node already exists" as
  //      "nothing to do" and exits with "Rebuild Complete" — leaving the
  //      Node-ABI binary in place. We delete the binary first so the
  //      prebuild fetch actually runs.
  //   2. The fetched prebuild only matches Electron's ABI; if prebuild-install
  //      fails (network/timeout/missing asset), electron-rebuild falls back
  //      to compiling from source via node-gyp, which FAILS on Windows when
  //      the project path contains non-ASCII characters (MSBuild bug). We
  //      surface that failure rather than letting a broken restore silently
  //      pass.
  const { existsSync, unlinkSync, copyFileSync, rmSync } = require('fs');
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

  // Force a fresh build by wiping the cached Node-ABI binary so
  // electron-rebuild's existence check fails and it runs the prebuild fetch.
  if (existsSync(releaseAppBinary)) {
    // eslint-disable-next-line no-console
    console.log('[test-integration] removing stale binary so electron-rebuild fetches the prebuild');
    try { unlinkSync(releaseAppBinary); } catch (_e) { /* ignore */ }
  }
  const prebuildsDir = path.join(releaseAppBsq, 'prebuilds');
  if (existsSync(prebuildsDir)) {
    try { rmSync(prebuildsDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }

  const status = run(npmCmd, ['run', 'rebuild']);
  if (status !== 0) return status;

  // Verify rebuild actually produced an Electron-ABI binary. If it produced
  // a Node-ABI one (electron-rebuild silently fell back to system Node),
  // copying it to src/node_modules would break `npm start`. Detect by trying
  // to load it under system Node — Electron-ABI throws NODE_MODULE_VERSION.
  if (!existsSync(releaseAppBinary)) {
    // eslint-disable-next-line no-console
    console.error('[test-integration] electron-rebuild produced no binary; aborting copy');
    return 1;
  }
  let isElectronAbi = false;
  try {
    require(releaseAppBinary);
    // Loaded under Node — wrong ABI.
  } catch (e) {
    if (/NODE_MODULE_VERSION/.test(String(e && e.message))) isElectronAbi = true;
  }
  if (!isElectronAbi) {
    // eslint-disable-next-line no-console
    console.warn(
      '[test-integration] WARNING: rebuilt binary loads under system Node — ' +
        'electron-rebuild appears to have produced a Node-ABI binary. ' +
        '`npm start` will likely fail with NODE_MODULE_VERSION mismatch. ' +
        'Workaround: rm -rf release/app/node_modules/better-sqlite3 && ' +
        'npm --prefix release/app install better-sqlite3 && npm run rebuild.',
    );
  }

  if (existsSync(path.dirname(srcCopy))) {
    // eslint-disable-next-line no-console
    console.log('[test-integration] copying Electron-ABI binary back to src/node_modules');
    copyFileSync(releaseAppBinary, srcCopy);
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
