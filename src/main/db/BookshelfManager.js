/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**

CREATE TABLE "bookshelf" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "created_at" TEXT,
  "user_id"  INTEGER
);

);


 *
 */
import db, { getUserIdFromToken, addUserIdCreatedAt, escapeString } from './dbManager';

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getBookshelfById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM bookshelf WHERE id = ? AND user_id = ?');
    const bookshelf = stmt.get(id, userId);
    if (bookshelf) return {
      id : bookshelf.id,
      name:  bookshelf.name || '',
      createdAt : bookshelf.created_at,
      userId: bookshelf.user_id,
    };
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} name
 * @param {*} token
 * @returns if success, id field is added
 */
export const createBookshelf= (name, token) => {
  const bookshelf = { name };
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return bookshelf;
  }
  addUserIdCreatedAt(bookshelf, userId);
  const createdAt =  bookshelf.createdAt || '';
  const name2 = escapeString(name);
  try {
    const stmt = db.prepare(
      'INSERT INTO bookshelf (name, created_at, user_id) ' +
      `VALUES ( '${name2}','${createdAt}','${userId}') `
    );
    const result = stmt.run();
    bookshelf.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return bookshelf;
};

/**
 *
 * @param {*} id
 * @param {*} name
 * @param {*} token
 * @returns new bookshelf or null
 */
export function renameBookshelf(id, name, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const name2 = escapeString(name);
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE bookshelf SET name  = '${name2}' WHERE id = ${id} AND user_id = ${userId}`;
    console.log(sql);
    const query = db.prepare(sql);
    query.run();
    return getBookshelfById(id);
  } catch (err) {
    console.error(err);
    return null;
  }
}
/**
 *
 * @param {*} token
 * @returns []
 */
export const getAllBookshelf = (token) => {
  const bookshelfs = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return bookshelfs;
  }
  try {
    const stmt = db.prepare('SELECT * FROM bookshelf WHERE user_id = ?')
                   .bind(userId);
    for (const card of stmt.iterate()) {
       bookshelfs.push({
          id : card.id,
          name:  card.name || '',
          sourceType: card.source_type || '',
          createdAt: card.created_at,
          userId: card.user_id,
       });
    }
    return bookshelfs;
  } catch (err) {
    console.error(err);
    return bookshelfs;
  }
};

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteBookshelfById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM bookshelf
        WHERE id = ? AND user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [id, userId] );
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteAllBookshelf(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM bookshelf
        WHERE  user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [userId] );
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}
