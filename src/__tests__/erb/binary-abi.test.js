/**
 * binary-abi.test.js
 *
 * Unit tests for the .erb/scripts/lib/binary-abi.js helpers.
 *
 * These defend the two real bugs we hit during the 2026-06-25
 * integration-test session:
 *   1. copyFileSync threw EBUSY mid-run and aborted the whole script.
 *   2. When the binary ABI didn't match the runner's Node, every
 *      integration test silently self-skipped — the run looked green.
 *
 * @jest-environment node
 */

const fs = require('fs');
const childProcess = require('child_process');

const MODULE_PATH = '../../../.erb/scripts/lib/binary-abi';

describe('copyFileWithRetry', () => {
  let copyFileSyncSpy;
  let binaryAbi;

  beforeEach(() => {
    jest.resetModules();
    copyFileSyncSpy = jest.spyOn(fs, 'copyFileSync');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    binaryAbi = require(MODULE_PATH);
  });

  afterEach(() => {
    copyFileSyncSpy.mockRestore();
  });

  it('succeeds on the first try when copyFileSync succeeds', () => {
    copyFileSyncSpy.mockImplementation(() => {});
    binaryAbi.copyFileWithRetry('a', 'b', { attempts: 5, delayMs: 0 });
    expect(copyFileSyncSpy).toHaveBeenCalledTimes(1);
  });

  it('retries on EBUSY and eventually succeeds', () => {
    let calls = 0;
    copyFileSyncSpy.mockImplementation(() => {
      calls += 1;
      if (calls < 3) {
        const err = new Error('EBUSY: resource busy or locked');
        err.code = 'EBUSY';
        throw err;
      }
    });
    binaryAbi.copyFileWithRetry('a', 'b', { attempts: 5, delayMs: 0 });
    expect(copyFileSyncSpy).toHaveBeenCalledTimes(3);
  });

  it('retries on EPERM (alternate Windows lock error)', () => {
    let calls = 0;
    copyFileSyncSpy.mockImplementation(() => {
      calls += 1;
      if (calls < 2) {
        const err = new Error('EPERM: operation not permitted');
        err.code = 'EPERM';
        throw err;
      }
    });
    binaryAbi.copyFileWithRetry('a', 'b', { attempts: 5, delayMs: 0 });
    expect(copyFileSyncSpy).toHaveBeenCalledTimes(2);
  });

  it('throws with a helpful diagnostic after exhausting retries on EBUSY', () => {
    copyFileSyncSpy.mockImplementation(() => {
      const err = new Error('EBUSY: resource busy or locked');
      err.code = 'EBUSY';
      throw err;
    });
    expect(() =>
      binaryAbi.copyFileWithRetry('a', 'b', { attempts: 3, delayMs: 0 }),
    ).toThrow(/After 3 attempts.*locked.*stale node\/jest worker/s);
    expect(copyFileSyncSpy).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on non-transient errors (e.g. ENOENT)', () => {
    copyFileSyncSpy.mockImplementation(() => {
      const err = new Error('ENOENT: no such file or directory');
      err.code = 'ENOENT';
      throw err;
    });
    expect(() =>
      binaryAbi.copyFileWithRetry('a', 'b', { attempts: 5, delayMs: 0 }),
    ).toThrow(/ENOENT/);
    expect(copyFileSyncSpy).toHaveBeenCalledTimes(1);
  });
});

describe('verifyBinaryAbi', () => {
  let spawnSyncSpy;
  let binaryAbi;

  beforeEach(() => {
    jest.resetModules();
    spawnSyncSpy = jest.spyOn(childProcess, 'spawnSync');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    binaryAbi = require(MODULE_PATH);
  });

  afterEach(() => {
    spawnSyncSpy.mockRestore();
  });

  it('returns ok=true when the child process reports OK', () => {
    spawnSyncSpy.mockReturnValue({ stdout: 'OK', stderr: '' });
    const r = binaryAbi.verifyBinaryAbi('/some/path.node');
    expect(r.ok).toBe(true);
    expect(r.expectedAbi).toBe(Number(process.versions.modules));
    expect(r.error).toBeNull();
  });

  it('parses NODE_MODULE_VERSION mismatch into actualAbi', () => {
    spawnSyncSpy.mockReturnValue({
      stdout:
        'ERR:The module ... was compiled against a different Node.js version ' +
        'using NODE_MODULE_VERSION 116. This version of Node.js requires ' +
        'NODE_MODULE_VERSION 127. Please try re-compiling',
      stderr: '',
    });
    const r = binaryAbi.verifyBinaryAbi('/some/path.node');
    expect(r.ok).toBe(false);
    expect(r.actualAbi).toBe(116);
    expect(r.expectedAbi).toBe(Number(process.versions.modules));
    expect(r.error).toMatch(/NODE_MODULE_VERSION 116/);
  });

  it('returns ok=false with raw error when the message has no ABI numbers', () => {
    spawnSyncSpy.mockReturnValue({
      stdout: 'ERR:not a valid binary',
      stderr: '',
    });
    const r = binaryAbi.verifyBinaryAbi('/some/path.node');
    expect(r.ok).toBe(false);
    expect(r.actualAbi).toBeNull();
    expect(r.error).toBe('not a valid binary');
  });

  it('invokes node with the binary path passed safely (no shell injection)', () => {
    spawnSyncSpy.mockReturnValue({ stdout: 'OK', stderr: '' });
    binaryAbi.verifyBinaryAbi('/path with spaces/foo.node');
    const [, args] = spawnSyncSpy.mock.calls[0];
    expect(args[0]).toBe('-e');
    // The path should be JSON.stringified into the probe script so
    // spaces / special chars can't break the require call.
    expect(args[1]).toContain('"/path with spaces/foo.node"');
  });
});
