/* eslint-disable prettier/prettier */
/**
 * User authentication: register, login, and the schema migration that
 * adds a UNIQUE index on user.email for existing installs.
 */
import db from './dbManager';
import { hashPassword, verifyPassword, needsRehash } from './passwordHash';

export const REGISTER_CODES = Object.freeze({
  OK: 'ok',
  INVALID_INPUT: 'invalid-input',
  INVALID_EMAIL: 'invalid-email',
  WEAK_PASSWORD: 'weak-password',
  DUPLICATE_EMAIL: 'duplicate-email',
  DB_ERROR: 'db-error',
});

const MIN_PASSWORD_LENGTH = 8;

// Pragmatic email-shape check (not full RFC 5322). Catches typical typos
// ("not-an-email", "foo@", "@bar.com", "foo@bar") without rejecting the
// long tail of unusual-but-valid addresses. The DB column has no CHECK
// constraint so this is the only line of defense against garbage emails.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Add a UNIQUE index on user.email so duplicate registrations fail loudly.
 *
 * Fresh installs already get this via db.sql (table-level UNIQUE column).
 * Existing installs ship with a non-unique schema — this idempotent
 * `CREATE UNIQUE INDEX IF NOT EXISTS` closes the gap. If pre-existing
 * duplicates exist, the index creation fails; we log and continue so the
 * app still boots, and operators can clean up manually.
 *
 * Must be called once at app boot before the register IPC handler is
 * exposed to the renderer.
 */
export const ensureUserSchema = () => {
  try {
    db.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_unique ON user(email)',
    );
  } catch (err) {
    console.warn(
      '[PersonManager] could not add UNIQUE index on user.email — ' +
        'likely duplicate rows already exist. Skipping migration. ' +
        `Reason: ${err.message || err}`,
    );
  }
};

/**
 * @param {*} email
 * @param {*} password
 * @returns { id: -1, username: '' } on any failure (intentionally opaque
 *   so callers cannot distinguish unknown-email from wrong-password)
 */
export const login = (email, password) => {
  try {
    const stmt = db.prepare(
      'SELECT id, username, password_hash FROM user WHERE email = ?',
    );
    const person = stmt.get(email);
    if (!person) return { id: -1, username: '' };
    if (!verifyPassword(password, person.password_hash)) {
      return { id: -1, username: '' };
    }
    if (needsRehash(person.password_hash)) {
      try {
        const updateStmt = db.prepare(
          'UPDATE user SET password_hash = ? WHERE id = ?',
        );
        updateStmt.run(hashPassword(password), person.id);
      } catch (rehashErr) {
        console.warn('password rehash failed:', rehashErr.message || rehashErr);
      }
    }
    return { id: person.id, username: person.username };
  } catch (err) {
    console.error(err);
    return { id: -1, username: '' };
  }
};

/**
 * @param {*} username
 * @param {*} email
 * @param {*} password
 * @returns {{ ok: boolean, code: string, id?: number }}
 *   code is one of REGISTER_CODES. id is set on success.
 */
export const register = (username, email, password) => {
  if (
    typeof username !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !email.trim()
  ) {
    return { ok: false, code: REGISTER_CODES.INVALID_INPUT };
  }
  if (!EMAIL_RE.test(email.trim())) {
    return { ok: false, code: REGISTER_CODES.INVALID_EMAIL };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: REGISTER_CODES.WEAK_PASSWORD };
  }
  try {
    const password_hash = hashPassword(password);
    const insertQuery = db.prepare(
      'INSERT INTO user (username, email, password_hash, status) VALUES (?, ?, ?, ?)',
    );
    const transaction = db.transaction(() => {
      const info = insertQuery.run(username, email, password_hash, 1);
      return info.lastInsertRowid;
    });
    const id = transaction();
    return { ok: true, code: REGISTER_CODES.OK, id };
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // better-sqlite3 surfaces UNIQUE-violations as "UNIQUE constraint failed"
    if (msg.includes('UNIQUE constraint failed')) {
      return { ok: false, code: REGISTER_CODES.DUPLICATE_EMAIL };
    }
    console.error('[PersonManager.register]', err);
    return { ok: false, code: REGISTER_CODES.DB_ERROR };
  }
};
