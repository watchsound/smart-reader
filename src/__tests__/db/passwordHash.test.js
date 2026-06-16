/**
 * Pure unit tests for password hashing helpers. No DB, no IPC.
 *
 * @jest-environment node
 */

const {
  hashPassword,
  verifyPassword,
  isHashed,
  needsRehash,
} = require('../../main/db/passwordHash');

describe('passwordHash', () => {
  describe('hashPassword', () => {
    it('produces the scrypt$ self-describing format', () => {
      const out = hashPassword('correct horse battery staple');
      expect(out.startsWith('scrypt$')).toBe(true);
      // scrypt$<N>$<r>$<p>$<salt>$<hash> → 5 $-separated parts after prefix
      const parts = out.slice('scrypt$'.length).split('$');
      expect(parts).toHaveLength(5);
    });

    it('produces a different hash each call (random salt)', () => {
      const a = hashPassword('same-input');
      const b = hashPassword('same-input');
      expect(a).not.toEqual(b);
    });

    it('throws on empty or non-string input', () => {
      expect(() => hashPassword('')).toThrow();
      expect(() => hashPassword(null)).toThrow();
      expect(() => hashPassword(undefined)).toThrow();
      expect(() => hashPassword(123)).toThrow();
    });
  });

  describe('verifyPassword', () => {
    it('accepts the correct password against a hash', () => {
      const stored = hashPassword('s3cret');
      expect(verifyPassword('s3cret', stored)).toBe(true);
    });

    it('rejects a wrong password against a hash', () => {
      const stored = hashPassword('s3cret');
      expect(verifyPassword('S3cret', stored)).toBe(false);
      expect(verifyPassword('s3cre', stored)).toBe(false);
      expect(verifyPassword('', stored)).toBe(false);
    });

    it('accepts legacy plaintext when stored equals plain (migration path)', () => {
      expect(verifyPassword('hunter2', 'hunter2')).toBe(true);
    });

    it('rejects legacy plaintext when stored does not equal plain', () => {
      expect(verifyPassword('hunter2', 'hunter3')).toBe(false);
      expect(verifyPassword('hunter2', 'HUNTER2')).toBe(false);
      // Length mismatch must not throw
      expect(verifyPassword('hunter2', 'hunter22')).toBe(false);
    });

    it('returns false on malformed scrypt$ values rather than throwing', () => {
      expect(verifyPassword('x', 'scrypt$')).toBe(false);
      expect(verifyPassword('x', 'scrypt$junk')).toBe(false);
      expect(verifyPassword('x', 'scrypt$a$b$c$d$e')).toBe(false);
    });

    it('returns false on non-string inputs', () => {
      expect(verifyPassword(null, hashPassword('x'))).toBe(false);
      expect(verifyPassword('x', null)).toBe(false);
      expect(verifyPassword(undefined, undefined)).toBe(false);
    });
  });

  describe('isHashed', () => {
    it('returns true for scrypt$ values', () => {
      expect(isHashed(hashPassword('a'))).toBe(true);
    });

    it('returns false for plaintext and falsy values', () => {
      expect(isHashed('plaintext-password')).toBe(false);
      expect(isHashed('')).toBe(false);
      expect(isHashed(null)).toBe(false);
      expect(isHashed(undefined)).toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('returns true for legacy plaintext', () => {
      expect(needsRehash('plaintext')).toBe(true);
      expect(needsRehash('')).toBe(true);
    });

    it('returns false for a current-format hash', () => {
      expect(needsRehash(hashPassword('a'))).toBe(false);
    });

    it('returns true if cost parameters differ from current defaults', () => {
      // Hand-craft a stored value with N=1024 (below current default of 16384)
      const fakeOldFormat =
        'scrypt$1024$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAA';
      expect(needsRehash(fakeOldFormat)).toBe(true);
    });

    it('returns true on malformed scrypt$ values (treats as needing rehash)', () => {
      expect(needsRehash('scrypt$onlytwo$parts')).toBe(true);
    });
  });
});
