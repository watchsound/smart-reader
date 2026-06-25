/**
 * binary-abi.js
 *
 * Helpers for managing the better-sqlite3 .node binary as it shuttles
 * between Electron-ABI and Node-ABI during the integration-test dance.
 *
 * Two failure modes this defends against (both observed in production):
 *
 *  1. EBUSY on copyFileSync. Windows holds an exclusive lock on a .node
 *     binary that any live process has dlopen'd. A killed-but-not-reaped
 *     jest worker, an Electron app still running, or a stale terminal
 *     can all keep the file locked for seconds-to-minutes. The original
 *     script bailed on the first failure; copyFileWithRetry retries with
 *     backoff before giving up with a diagnostic message naming the file.
 *
 *  2. Silent ABI mismatch. The integration tests skip themselves when
 *     better-sqlite3 fails to load — graceful for local dev (you don't
 *     want a developer's missing rebuild to fail their unrelated test
 *     run), but invisible in CI: "Tests: 0 passed, 12 skipped" reads as
 *     green to a glance and to most CI status badges. verifyBinaryAbi
 *     fails LOUDLY immediately after the rebuild so we never run jest
 *     against a binary that can't load.
 */

const { copyFileSync } = require('fs');
const { spawnSync } = require('child_process');

function sleepSync(ms) {
  const end = Date.now() + ms;
  // eslint-disable-next-line no-empty
  while (Date.now() < end) {}
}

/**
 * Copy a file, retrying on EBUSY/EPERM (Windows file-lock contention).
 *
 * @param {string} src
 * @param {string} dst
 * @param {{attempts?: number, delayMs?: number}} [opts]
 * @throws {Error} after `attempts` failed retries — message names the
 *   destination and offers remediation.
 */
function copyFileWithRetry(src, dst, opts = {}) {
  const attempts = opts.attempts ?? 5;
  const delayMs = opts.delayMs ?? 300;
  let lastErr = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      copyFileSync(src, dst);
      return;
    } catch (err) {
      lastErr = err;
      // Only retry the transient lock errors. Anything else (ENOENT,
      // EACCES from permissions, EISDIR) won't get better with waiting.
      if (err.code !== 'EBUSY' && err.code !== 'EPERM') break;
      if (i < attempts) sleepSync(delayMs);
    }
  }
  const hint =
    lastErr && (lastErr.code === 'EBUSY' || lastErr.code === 'EPERM')
      ? ` After ${attempts} attempts. The destination file is locked, ` +
        `usually by a stale node/jest worker or a running Electron app. ` +
        `Close those and rerun.`
      : '';
  throw new Error(
    `copyFileWithRetry: failed to copy ${src} → ${dst}: ` +
      `${lastErr && lastErr.message ? lastErr.message : lastErr}${hint}`,
  );
}

/**
 * Spawn a child node process to `require()` the .node binary and report
 * whether it loads under the running Node's NODE_MODULE_VERSION.
 *
 * Returns `{ ok, actualAbi, expectedAbi, error }`:
 *   - ok true: binary loads cleanly under current Node
 *   - ok false: binary mismatches — `actualAbi`/`expectedAbi` are
 *     populated if the error was a clear NODE_MODULE_VERSION mismatch;
 *     otherwise `error` carries the raw message.
 *
 * Uses a child process (not a direct require in the script) so a bad
 * binary can't pollute the parent's module cache or crash the runner.
 *
 * @param {string} binaryPath  Absolute path to better_sqlite3.node
 * @returns {{ok: boolean, actualAbi: number|null, expectedAbi: number, error: string|null}}
 */
function verifyBinaryAbi(binaryPath) {
  const expectedAbi = Number(process.versions.modules);
  const probe = `
    try {
      process.dlopen({exports:{}}, ${JSON.stringify(binaryPath)});
      process.stdout.write('OK');
    } catch (e) {
      process.stdout.write('ERR:' + (e && e.message ? e.message : String(e)));
    }
  `;
  const result = spawnSync(process.execPath, ['-e', probe], {
    encoding: 'utf8',
  });
  const out = String(result.stdout || '');
  if (out === 'OK') {
    return { ok: true, actualAbi: expectedAbi, expectedAbi, error: null };
  }
  const errMsg = out.startsWith('ERR:') ? out.slice(4) : out || String(result.stderr || '');
  const abiMatch = errMsg.match(/NODE_MODULE_VERSION (\d+)/g);
  let actualAbi = null;
  if (abiMatch && abiMatch.length >= 1) {
    actualAbi = Number(abiMatch[0].split(' ').pop());
  }
  return { ok: false, actualAbi, expectedAbi, error: errMsg };
}

module.exports = {
  copyFileWithRetry,
  verifyBinaryAbi,
  // exported for tests
  _sleepSync: sleepSync,
};
