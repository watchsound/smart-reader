import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
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
      // : path.join(process.resourcesPath, './sqlite_tables.db');

      // copy database file to a writable place
      if (process.env.NODE_ENV !== 'development') {
        const originalDbPath = path.join(
          process.resourcesPath,
          'sqlite_tables.db',
        );
        const userDataDbPath = path.join(
          app.getPath('userData'),
          'sqlite_tables.db',
        );

        if (!fs.existsSync(userDataDbPath)) {
          fs.copyFileSync(originalDbPath, userDataDbPath);
        }
      }

      const database = new Database(dbPath);
      database.pragma('journal_mode = WAL');

      DatabaseSingleton.instance = database;
    }
    return DatabaseSingleton.instance;
  }
}
const db = new DatabaseSingleton();
Object.freeze(db); // Optional: makes the instance immutable

export default db;

export const getUserIdFromToken = (token) => {
  const userInfo = global.shared.store.get('session_info');
  // console.log(' get userInfo in store ' + JSON.stringify(userInfo));
  // console.log( token )
  if (userInfo && userInfo.token === token) return userInfo.id;
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
  if (typeof value === 'string')  return value.replace(/'/g, "''");
  if (typeof value === 'number')  return  value.toString();
  return value || '';  // Replace each single quote with two single quotes
};

export const getNextId = (tableName) => {
  const stmt = db.prepare(`SELECT MAX(id) as maxId FROM ${tableName}`);
  const row = stmt.get();
  return row.maxId + 1;
};
