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
  // Restore the Electron binary. `npm run rebuild` is defined in
  // package.json to call electron-rebuild for the project's deps.
  return run(npmCmd, ['run', 'rebuild']);
}

function runJest() {
  return run(npxCmd, [
    'jest',
    'src/__tests__/integration/',
    'src/__tests__/main/',
    'src/__tests__/db/',
    '--no-coverage',
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
