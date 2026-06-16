/**
 * PersonManager pure-unit tests — mocks dbManager so the suite runs in
 * environments without a working C++ build chain (no better-sqlite3).
 *
 * The integration suite under src/__tests__/integration/PersonManager.integration.test.js
 * covers the same code paths against a real :memory: SQLite database.
 *
 * @jest-environment node
 */

// Fake prepared-statement factory: each `prepare(sql)` returns a stmt
// stub whose behavior the individual tests override via mockSqlBehavior.
let sqlBehavior;
const mockDb = {
  prepare: jest.fn((sql) => {
    if (sqlBehavior && sqlBehavior[sql]) return sqlBehavior[sql];
    // Default: get/run/all return empty / no-op
    return {
      get: jest.fn(() => undefined),
      run: jest.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
      all: jest.fn(() => []),
    };
  }),
  exec: jest.fn(),
  transaction: jest.fn((fn) => fn),
};

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: mockDb,
}));

const {
  login,
  register,
  ensureUserSchema,
  REGISTER_CODES,
} = require('../../main/db/PersonManager');
const { isHashed, hashPassword } = require('../../main/db/passwordHash');

beforeEach(() => {
  jest.clearAllMocks();
  sqlBehavior = null;
});

describe('PersonManager (unit, mocked db)', () => {
  describe('register input validation', () => {
    // Missing-or-non-string user/email fail first as INVALID_INPUT.
    // Empty password naturally falls through to WEAK_PASSWORD (covered
    // separately below) — empty IS weak; the more informative message wins.
    it.each([
      ['empty name', '', 'a@b.c', 'longenough'],
      ['empty email', 'alice', '', 'longenough'],
      ['whitespace name', '   ', 'a@b.c', 'longenough'],
      ['null name', null, 'a@b.c', 'longenough'],
      ['undefined email', 'alice', undefined, 'longenough'],
      ['number password', 'alice', 'a@b.c', 12345678],
    ])('rejects %s with INVALID_INPUT', (_label, u, e, p) => {
      const result = register(u, e, p);
      expect(result.ok).toBe(false);
      expect(result.code).toBe(REGISTER_CODES.INVALID_INPUT);
      // Validation failures must short-circuit before any DB work
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('rejects empty password with WEAK_PASSWORD (length 0 < 8)', () => {
      const result = register('alice', 'a@b.c', '');
      expect(result.ok).toBe(false);
      expect(result.code).toBe(REGISTER_CODES.WEAK_PASSWORD);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it.each([
      ['no @ sign', 'not-an-email'],
      ['missing local part', '@example.com'],
      ['missing domain', 'alice@'],
      ['missing TLD', 'alice@example'],
      ['internal whitespace', 'alice @example.com'],
      ['double @', 'alice@@example.com'],
    ])('rejects %s with INVALID_EMAIL', (_label, badEmail) => {
      const result = register('alice', badEmail, 'longpassword');
      expect(result.code).toBe(REGISTER_CODES.INVALID_EMAIL);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it.each([
      'alice@example.com',
      'a.b+tag@sub.example.co.uk',
      'x@y.z',
    ])('accepts valid email shape: %s', (goodEmail) => {
      sqlBehavior = {
        'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)':
          {
            run: jest.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
          },
      };
      const result = register('alice', goodEmail, 'longpassword');
      expect(result.ok).toBe(true);
    });

    it('rejects 7-char password with WEAK_PASSWORD', () => {
      const result = register('alice', 'a@b.c', '1234567');
      expect(result.code).toBe(REGISTER_CODES.WEAK_PASSWORD);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it('accepts 8-char password (boundary)', () => {
      sqlBehavior = {
        'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)':
          {
            run: jest.fn(() => ({ changes: 1, lastInsertRowid: 42 })),
          },
      };
      const result = register('alice', 'a@b.c', '12345678');
      expect(result.ok).toBe(true);
      expect(result.id).toBe(42);
    });
  });

  describe('register error mapping', () => {
    it('maps UNIQUE constraint failed to DUPLICATE_EMAIL', () => {
      sqlBehavior = {
        'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)':
          {
            run: jest.fn(() => {
              throw new Error(
                'UNIQUE constraint failed: user.email (SQLITE_CONSTRAINT_UNIQUE)',
              );
            }),
          },
      };
      const result = register('alice', 'dup@example.com', 'longpassword');
      expect(result).toEqual({
        ok: false,
        code: REGISTER_CODES.DUPLICATE_EMAIL,
      });
    });

    it('maps any other DB error to DB_ERROR', () => {
      sqlBehavior = {
        'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)':
          {
            run: jest.fn(() => {
              throw new Error('disk I/O error');
            }),
          },
      };
      const result = register('alice', 'a@b.c', 'longpassword');
      expect(result).toEqual({ ok: false, code: REGISTER_CODES.DB_ERROR });
    });

    it('stores a scrypt hash, not the plaintext, on success', () => {
      const runMock = jest.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
      sqlBehavior = {
        'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)':
          { run: runMock },
      };
      register('alice', 'a@b.c', 'opensesame');
      expect(runMock).toHaveBeenCalledTimes(1);
      const [, , storedHash] = runMock.mock.calls[0];
      expect(storedHash).not.toEqual('opensesame');
      expect(isHashed(storedHash)).toBe(true);
    });
  });

  describe('login', () => {
    it('returns id:-1 when SELECT finds no row', () => {
      sqlBehavior = {
        'SELECT id, username, password_hash FROM user WHERE email = ?': {
          get: jest.fn(() => undefined),
        },
      };
      expect(login('ghost@example.com', 'whatever')).toEqual({
        id: -1,
        username: '',
      });
    });

    it('returns id:-1 when password does not match', () => {
      const stored = hashPassword('correct');
      sqlBehavior = {
        'SELECT id, username, password_hash FROM user WHERE email = ?': {
          get: jest.fn(() => ({
            id: 7,
            username: 'alice',
            password_hash: stored,
          })),
        },
      };
      expect(login('alice@example.com', 'wrong')).toEqual({
        id: -1,
        username: '',
      });
    });

    it('returns the user on successful verify, no rehash if format is current', () => {
      const stored = hashPassword('correct');
      const updateRun = jest.fn();
      sqlBehavior = {
        'SELECT id, username, password_hash FROM user WHERE email = ?': {
          get: jest.fn(() => ({
            id: 7,
            username: 'alice',
            password_hash: stored,
          })),
        },
        'UPDATE user SET password_hash = ? WHERE id = ?': { run: updateRun },
      };
      const result = login('alice@example.com', 'correct');
      expect(result).toEqual({ id: 7, username: 'alice' });
      expect(updateRun).not.toHaveBeenCalled();
    });

    it('rehashes a legacy plaintext row in place on successful login', () => {
      const updateRun = jest.fn();
      sqlBehavior = {
        'SELECT id, username, password_hash FROM user WHERE email = ?': {
          get: jest.fn(() => ({
            id: 9,
            username: 'legacy',
            password_hash: 'oldpass', // plaintext == passed-in password
          })),
        },
        'UPDATE user SET password_hash = ? WHERE id = ?': { run: updateRun },
      };
      const result = login('legacy@example.com', 'oldpass');
      expect(result).toEqual({ id: 9, username: 'legacy' });
      expect(updateRun).toHaveBeenCalledTimes(1);
      const [newHash, id] = updateRun.mock.calls[0];
      expect(id).toBe(9);
      expect(isHashed(newHash)).toBe(true);
      expect(newHash).not.toEqual('oldpass');
    });

    it('still returns success if rehash UPDATE throws', () => {
      sqlBehavior = {
        'SELECT id, username, password_hash FROM user WHERE email = ?': {
          get: jest.fn(() => ({
            id: 9,
            username: 'legacy',
            password_hash: 'oldpass',
          })),
        },
        'UPDATE user SET password_hash = ? WHERE id = ?': {
          run: jest.fn(() => {
            throw new Error('disk full');
          }),
        },
      };
      const result = login('legacy@example.com', 'oldpass');
      expect(result).toEqual({ id: 9, username: 'legacy' });
    });
  });

  describe('ensureUserSchema', () => {
    it('issues the idempotent CREATE UNIQUE INDEX statement', () => {
      ensureUserSchema();
      expect(mockDb.exec).toHaveBeenCalledWith(
        expect.stringContaining(
          'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_unique',
        ),
      );
    });

    it('swallows db.exec errors (does not throw out of process)', () => {
      mockDb.exec.mockImplementationOnce(() => {
        throw new Error(
          'UNIQUE constraint failed: user.email — duplicates exist',
        );
      });
      expect(() => ensureUserSchema()).not.toThrow();
    });
  });
});
