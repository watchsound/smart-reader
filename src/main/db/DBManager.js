import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

/**
 * -> In Development: When running in development mode,
 *  you might use a local path relative to your source files. (__dirname)
   -> In Production: When the app is packaged, process.resourcesPath
   will point to the directory where resources are located,
   and you can access the resource files accordingly.
 */
class DatabaseSingleton {
  constructor() {
    if (!DatabaseSingleton.instance) {
      const dbPath =
        process.env.NODE_ENV === 'development'
          ? './sqlite_tables.db'
          : path.join(app.getPath('userData'), 'sqlite_tables.db');

      // Phase 13 cleanup (P4): no seed-copy step. better-sqlite3 creates
      // the file if it doesn't exist; SchemaMigrator (called below) populates
      // the schema from db.sql; DatabaseInitializer (called later, after user
      // login) seeds reference data (bookmark groups, bookshelves). Production
      // builds bundle db.sql via electron-builder's `extraResources`.
      // Result: sqlite_tables.db is no longer a binary tracked in git; it's
      // pure user data, created and grown on each install.
      const database = new Database(dbPath);
      database.pragma('journal_mode = WAL');

      // Apply any tables/indices that exist in db.sql but not yet in this
      // DB file. Idempotent — every CREATE in db.sql uses IF NOT EXISTS.
      // Without this, new phases that add tables crash IPC handlers on
      // boot with `no such table: X` until the dev hand-runs the missing
      // CREATEs. See SchemaMigrator for scope + limitations (no ALTER yet).
      try {
        // eslint-disable-next-line global-require
        const { migrate } = require('./SchemaMigrator');
        migrate(database);
      } catch (e) {
        // Never let migration crash the app — fall through and let the
        // missing-table errors surface in their actual IPC paths.
        console.warn('[dbManager] SchemaMigrator threw:', e && e.message);
      }

      DatabaseSingleton.instance = database;
    }
    return DatabaseSingleton.instance;
  }
}
const db = new DatabaseSingleton();
Object.freeze(db); // Optional: makes the instance immutable

export default db;

// Named-export accessor used by Brain Spine modules (Phase 9+).
// Returns the same live database instance as `export default db`.
// The accessor form is preferred by test mocks that swap the DB per
// test via `jest.mock('./dbManager', () => ({ getDb: () => testDb }))`.
export const getDb = () => db;

export const getUserIdFromToken = (token) => {
  if (!global.shared || !global.shared.store) {
    console.log('global.shared.store not initialized yet');
    return -1;
  }
  const userInfo = global.shared.store.get('session_info');
  // Debug: log token comparison
  console.log(`getUserIdFromToken - passed token: ${token}`);
  console.log(
    `getUserIdFromToken - stored session: ${JSON.stringify(userInfo)}`,
  );
  if (userInfo && userInfo.token === token) return userInfo.id;
  console.warn('session is invalid, userid not found');
  return -1;
};

export const addUserIdCreatedAt = (obj, userId) => {
  // console.log(`addUserIdCreatedAt = ${JSON.stringify(obj)}`);
  if (!obj.userId) {
    obj.userId = userId;
  }
  // if (!obj.createdAt) {
  obj.createdAt = dateToSQLiteString(new Date());
  // }
  return obj;
};
export const escapeString = (value) => {
  if (typeof value === 'string') return value.replace(/'/g, "''");
  if (typeof value === 'number') return value.toString();
  return value || ''; // Replace each single quote with two single quotes
};

// Single-field UPDATE helpers across managers interpolate the column name
// directly into SQL (the value is parameterized; the column name cannot be).
// Each manager passes its writable-column allowlist here so an unknown field
// throws before reaching SQL — turning silent SQL-syntax failures into a
// clear rejection and closing the SQL-injection-shaped pattern.
export const assertUpdateField = (table, allowed, field) => {
  if (typeof field !== 'string' || !allowed.has(field)) {
    throw new Error(`Invalid update field "${field}" for table "${table}"`);
  }
};
