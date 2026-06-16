/* eslint-disable prettier/prettier */
/**
 * Password hashing helpers built on Node's built-in scrypt.
 *
 * Storage format: `scrypt$<N>$<r>$<p>$<base64-salt>$<base64-hash>`
 *
 * Why this format:
 *  - Self-describing — params travel with the hash so we can change them
 *    later without a migration column.
 *  - Distinguishable from legacy plaintext rows (no `scrypt$` prefix),
 *    enabling lazy rehash on first successful login.
 *
 * Why scrypt: built-in (no new deps), memory-hard, considered safe at the
 * default parameters below. ~50–100ms per call on modern desktop CPU,
 * acceptable cost for an interactive login on the main process.
 */
import crypto from 'crypto';

const SCRYPT_PREFIX = 'scrypt$';
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

const toB64 = (buf) => buf.toString('base64');
const fromB64 = (str) => Buffer.from(str, 'base64');

/**
 * Hash a plaintext password.
 * @param {string} plain
 * @returns {string} encoded scrypt hash
 */
export const hashPassword = (plain) => {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('hashPassword: password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.scryptSync(plain, salt, KEYLEN, { N, r: R, p: P });
  return `${SCRYPT_PREFIX}${N}$${R}$${P}$${toB64(salt)}$${toB64(hash)}`;
};

/**
 * Whether `stored` is in our scrypt-encoded format. Anything else (including
 * empty strings, null, plaintext) returns false.
 * @param {*} stored
 * @returns {boolean}
 */
export const isHashed = (stored) =>
  typeof stored === 'string' && stored.startsWith(SCRYPT_PREFIX);

/**
 * Constant-time comparison for two strings. Falls back to false on
 * length mismatch (timingSafeEqual throws on unequal lengths).
 */
const constantTimeEquals = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

/**
 * Verify a plaintext password against a stored value.
 *
 * Accepts both formats:
 *  - scrypt-encoded → recompute with embedded params, timing-safe compare
 *  - legacy plaintext → timing-safe direct compare (lets pre-hash users
 *    still log in; caller is expected to rehash on success)
 *
 * @param {string} plain
 * @param {string} stored
 * @returns {boolean}
 */
export const verifyPassword = (plain, stored) => {
  if (typeof plain !== 'string' || typeof stored !== 'string') return false;
  if (!isHashed(stored)) {
    return constantTimeEquals(plain, stored);
  }
  try {
    const parts = stored.slice(SCRYPT_PREFIX.length).split('$');
    if (parts.length !== 5) return false;
    const [nStr, rStr, pStr, saltB64, hashB64] = parts;
    const n = Number.parseInt(nStr, 10);
    const r = Number.parseInt(rStr, 10);
    const p = Number.parseInt(pStr, 10);
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
      return false;
    }
    const salt = fromB64(saltB64);
    const expected = fromB64(hashB64);
    const actual = crypto.scryptSync(plain, salt, expected.length, {
      N: n,
      r,
      p,
    });
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
};

/**
 * True if `stored` should be rewritten with the current hashPassword
 * defaults — used after a successful login to migrate legacy plaintext
 * (and, later, to upgrade hashes when params change).
 */
export const needsRehash = (stored) => {
  if (!isHashed(stored)) return true;
  const parts = stored.slice(SCRYPT_PREFIX.length).split('$');
  if (parts.length !== 5) return true;
  const [nStr, rStr, pStr] = parts;
  return (
    Number.parseInt(nStr, 10) !== N ||
    Number.parseInt(rStr, 10) !== R ||
    Number.parseInt(pStr, 10) !== P
  );
};
