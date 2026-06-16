/**
 * PersonManager integration tests — run against a real `:memory:` SQLite
 * database so we exercise the actual SQL paths, not stubbed query objects.
 *
 * Mirrors the Phase 8 pattern: probe better-sqlite3 first (it may fail to
 * load when the binary is compiled against Electron's ABI). If it loads,
 * inject the in-memory DB into dbManager; otherwise short-circuit.
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test-userData') },
  ipcMain: { handle: jest.fn() },
}));

let testDB = null;
let sqliteLoadError = null;
try {
  // eslint-disable-next-line global-require
  const Database = require('better-sqlite3');
  testDB = new Database(':memory:');
  testDB.exec(`
    CREATE TABLE "user" (
      "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
      "username"  TEXT,
      "email"  TEXT,
      "password_hash" TEXT,
      "status"  INTEGER
    );
  `);
} catch (err) {
  sqliteLoadError = err;
}

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: testDB || { prepare: () => ({}), exec: () => {} },
  getUserIdFromToken: jest.fn(() => -1),
  addUserIdCreatedAt: (obj) => obj,
  escapeString: (v) => v,
}));

const describeIfSqlite = testDB ? describe : describe.skip;

describeIfSqlite('PersonManager (real :memory: SQLite)', () => {
  // eslint-disable-next-line global-require
  const {
    login,
    register,
    ensureUserSchema,
    REGISTER_CODES,
  } = require('../../main/db/PersonManager');
  // eslint-disable-next-line global-require
  const { isHashed } = require('../../main/db/passwordHash');

  beforeAll(() => {
    // Mirror app boot: run the UNIQUE-email migration once so register
    // tests below see the same constraint a real install would.
    ensureUserSchema();
  });

  beforeEach(() => {
    testDB.exec('DELETE FROM "user";');
  });

  if (sqliteLoadError) {
    // eslint-disable-next-line no-console
    console.warn('PersonManager.test skipped:', sqliteLoadError.message);
  }

  describe('register', () => {
    it('stores password as a scrypt hash, NOT plaintext', () => {
      const result = register('alice', 'alice@example.com', 'opensesame');
      expect(result.ok).toBe(true);
      expect(result.code).toBe(REGISTER_CODES.OK);
      expect(typeof result.id).toBe('number');
      const row = testDB
        .prepare('SELECT password_hash FROM user WHERE email = ?')
        .get('alice@example.com');
      expect(row).toBeTruthy();
      expect(row.password_hash).not.toEqual('opensesame');
      expect(isHashed(row.password_hash)).toBe(true);
    });

    it('rejects empty / non-string input with INVALID_INPUT code', () => {
      expect(register('', '', '')).toEqual({
        ok: false,
        code: REGISTER_CODES.INVALID_INPUT,
      });
      expect(register('   ', 'a@b.c', 'longenough')).toEqual({
        ok: false,
        code: REGISTER_CODES.INVALID_INPUT,
      });
      expect(register(null, 'a@b.c', 'longenough')).toEqual({
        ok: false,
        code: REGISTER_CODES.INVALID_INPUT,
      });
      expect(register('alice', undefined, 'longenough')).toEqual({
        ok: false,
        code: REGISTER_CODES.INVALID_INPUT,
      });
    });

    it('rejects passwords shorter than 8 chars with WEAK_PASSWORD code', () => {
      expect(register('alice', 'alice@example.com', 'short')).toEqual({
        ok: false,
        code: REGISTER_CODES.WEAK_PASSWORD,
      });
      // Boundary: 7 chars fails, 8 chars succeeds.
      expect(register('a', 'seven@example.com', '1234567').code).toBe(
        REGISTER_CODES.WEAK_PASSWORD,
      );
      expect(register('a', 'eight@example.com', '12345678').ok).toBe(true);
    });

    it('rejects duplicate emails with DUPLICATE_EMAIL code', () => {
      const first = register('alice', 'dup@example.com', 'longpassword');
      expect(first.ok).toBe(true);
      const second = register('alice2', 'dup@example.com', 'differentpw');
      expect(second).toEqual({
        ok: false,
        code: REGISTER_CODES.DUPLICATE_EMAIL,
      });
      // Verify only one row exists
      const row = testDB
        .prepare('SELECT COUNT(*) AS n FROM user WHERE email = ?')
        .get('dup@example.com');
      expect(row.n).toBe(1);
    });
  });

  describe('login', () => {
    it('succeeds with the correct password just used to register', () => {
      register('bob', 'bob@example.com', 'pa55word');
      const result = login('bob@example.com', 'pa55word');
      expect(result.username).toBe('bob');
      expect(result.id).toBeGreaterThan(0);
    });

    it('fails with the wrong password', () => {
      register('bob', 'bob@example.com', 'pa55word');
      expect(login('bob@example.com', 'WRONGpwd')).toEqual({
        id: -1,
        username: '',
      });
    });

    it('fails with an unknown email', () => {
      expect(login('nobody@example.com', 'whatever')).toEqual({
        id: -1,
        username: '',
      });
    });

    it('succeeds for a legacy plaintext row AND rehashes it in place', () => {
      // Seed a legacy row exactly as the old buggy register() would have.
      // Bypasses register() so we can use a short pre-policy password.
      testDB
        .prepare(
          'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)',
        )
        .run('legacy', 'legacy@example.com', 'oldpass', 1);

      const before = testDB
        .prepare('SELECT password_hash FROM user WHERE email = ?')
        .get('legacy@example.com');
      expect(before.password_hash).toBe('oldpass');
      expect(isHashed(before.password_hash)).toBe(false);

      const result = login('legacy@example.com', 'oldpass');
      expect(result.username).toBe('legacy');
      expect(result.id).toBeGreaterThan(0);

      const after = testDB
        .prepare('SELECT password_hash FROM user WHERE email = ?')
        .get('legacy@example.com');
      expect(after.password_hash).not.toBe('oldpass');
      expect(isHashed(after.password_hash)).toBe(true);

      // Subsequent login still succeeds against the new hash
      const second = login('legacy@example.com', 'oldpass');
      expect(second.username).toBe('legacy');
    });

    it('does not leak whether email is unknown vs password is wrong (same shape)', () => {
      register('charlie', 'charlie@example.com', 'longpassword');
      const wrongPw = login('charlie@example.com', 'nopenope');
      const unknownEmail = login('ghost@example.com', 'nopenope');
      expect(wrongPw).toEqual(unknownEmail);
    });

    it('is not susceptible to SQL-injection via email argument', () => {
      register('dave', 'dave@example.com', 'longpassword');
      const inject = login("dave@example.com' OR '1'='1", 'longpassword');
      expect(inject).toEqual({ id: -1, username: '' });
    });
  });

  describe('ensureUserSchema', () => {
    it('is idempotent (calling twice does not throw)', () => {
      expect(() => {
        ensureUserSchema();
        ensureUserSchema();
      }).not.toThrow();
    });

    it('does not abort startup when pre-existing duplicate emails are present', () => {
      // Simulate a legacy install: drop the index, seed duplicates, then
      // call the migration. It must log and continue, NOT throw.
      testDB.exec('DROP INDEX IF EXISTS idx_user_email_unique;');
      testDB
        .prepare('INSERT INTO user (username, email, status) VALUES (?, ?, ?)')
        .run('a', 'dup@example.com', 1);
      testDB
        .prepare('INSERT INTO user (username, email, status) VALUES (?, ?, ?)')
        .run('b', 'dup@example.com', 1);

      expect(() => ensureUserSchema()).not.toThrow();

      // Restore suite invariants: clear table and re-add the index so
      // later tests in any ordering still see a clean state.
      testDB.exec('DELETE FROM "user";');
      ensureUserSchema();
    });
  });
});
