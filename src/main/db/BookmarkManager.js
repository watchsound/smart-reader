/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
 * CREATE TABLE "bookmark" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "source_key"  TEXT,
  "source_type" TEXT,
  "cfi"  TEXT,
  "title" TEXT,
  "description" TEXT,
  "percentage" INTEGER ,
  "used_times" INTEGER ,
  "star" INTEGER ,
  "created_at" TEXT,
  "user_id"  INTEGER,
  "group_id" INTEGER,
  FOREIGN KEY ("group_id") REFERENCES "bookmark_group"("id")
);


 *
 */
import db, { getUserIdFromToken, addUserIdCreatedAt, assertUpdateField } from './dbManager';

const BOOKMARK_UPDATABLE = new Set([
  'source_key', 'source_type', 'cfi', 'title', 'description',
  'percentage', 'used_times', 'star', 'image', 'group_id',
]);

const constructBookmark = (aRowFromDB) => {
  return {
          id : aRowFromDB.id,
          sourceKey:  aRowFromDB.source_key || '',
          sourceType: aRowFromDB.source_type || '',
          cfi: aRowFromDB.cfi || '',
          title: aRowFromDB.title || '',
          description: aRowFromDB.description || '',
          percentage: aRowFromDB.percentage || 0,
          usedTimes: aRowFromDB.used_times || 0,
          star: aRowFromDB.star || 0,
          image: aRowFromDB.image || '',
          createdAt: aRowFromDB.created_at,
          userId: aRowFromDB.user_id,
          groupId: aRowFromDB.group_id
       }
};
/**
 *
 * @param {*} bookmark
 * @param {*} token
 * @returns bookmark. if success, add id field
 */
export const createBookmark= (bookmark, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return bookmark;
  }
  addUserIdCreatedAt(bookmark, userId);
  const sourceType = bookmark.sourceType || '';
  const sourceKey = bookmark.sourceKey || '';
  const cfi = bookmark.cfi || '';
  const title = bookmark.title || '';
  const percentage = bookmark.percentage || 0;
  const usedTimes = bookmark.usedTimes || 0;
  const star = bookmark.star || 0;
  const image = bookmark.image || '';
  const createdAt = bookmark.createdAt || '';
  const groupId = typeof bookmark.groupId === 'undefined' ? -1 : bookmark.groupId;
  const description = bookmark.description || '';
  try {
    const stmt = db
      .prepare(
        'INSERT INTO bookmark (source_type, source_key, cfi, title, description, percentage, used_times, star, image, created_at, user_id, group_id) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        sourceType,
        sourceKey,
        cfi,
        title,
        description,
        percentage,
        usedTimes,
        star,
        image,
        createdAt,
        userId,
        groupId,
      );
    const result = stmt.run();
    bookmark.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return bookmark;
};

export const getBookmarkByQuery= (query, token) => {
  const bookmarks = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return bookmarks;
  }
  try {
    const sql = 'SELECT * FROM bookmark WHERE ( title LIKE ? OR description LIKE ? ) AND user_id = ?';
    const stmt = db.prepare(sql);
    const pattern = `%${query}%`;
    for (const card of stmt.iterate(pattern, pattern, userId)) {
       bookmarks.push( constructBookmark(card) );
    }
    return bookmarks;
  } catch (err) {
    console.error(err);
    return bookmarks;
  }
};

/**
 *
 * @param {*} sourceKey
 * @param {*} sourceType
 * @param {*} token
 * @returns []
 */
export const getBookmarksBySourceKey = (sourceKey, sourceType, token) => {
  const bookmarks = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return bookmarks;
  }
  try {
    const sql = 'SELECT * FROM bookmark WHERE source_key = ? and source_type = ? and user_id = ? ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate(sourceKey, sourceType, userId)) {
       bookmarks.push( constructBookmark(card) );
    }
    return bookmarks;
  } catch (err) {
    console.error(err);
    return bookmarks;
  }
};

/**
 *
 * @param {*} groupId
 * @param {*} token
 * @returns []
 */
export const getBookmarksByGroupId = (groupId, token) => {
  const bookmarks = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return bookmarks;
  }
  try {
    const sql = 'SELECT * FROM bookmark WHERE group_id = ? and user_id = ? ORDER BY created_at DESC';
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate(groupId, userId)) {
       bookmarks.push( constructBookmark(card) );
    }
    return bookmarks;
  } catch (err) {
    console.error(err);
    return bookmarks;
  }
};

/**
 *
 * @param {*} groupId
 * @param {*} token
 * @returns []
 */
export const getBookmarksRecursiveByGroupId = (groupId,  token) => {
  const bookmarks = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return bookmarks;
  }
   try {
    const sql = `
        WITH RECURSIVE GroupHierarchy AS (
          SELECT id
          FROM bookmark_group
          WHERE id = ?
          UNION ALL
          SELECT g.id
          FROM bookmark_group g
          JOIN GroupHierarchy gh ON g.parent_group_id = gh.id
          )
        SELECT b.id, b.source_key, b.source_type, b.cfi, b.title, b.description, b.percentage, b.used_times, b.star, b.image, b.created_at, b.user_id, b.group_id
        FROM Bookmark b
        JOIN GroupHierarchy gh ON b.group_id = gh.id
    `;
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate(groupId)) {
       bookmarks.push( constructBookmark(card) );
    }
    return bookmarks;
  } catch (err) {
    console.error(err);
    return bookmarks;
  }
};

/**
 *
 * @param {*} id
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns 1  or -1
 */
export function updateBookmark(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    assertUpdateField('bookmark', BOOKMARK_UPDATABLE, field);
    const sql = `UPDATE bookmark SET ${field} = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run( [value, id, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteBookmarkById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM bookmark
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

