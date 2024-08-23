/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
CREATE TABLE "history" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "source_key"  TEXT,
  "source_type" TEXT,
  "description" TEXT,
  "favicon" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER,
  "group_id" INTEGER
);
 */
import { getImage } from './ImageManager';
import db, { getUserIdFromToken, addUserIdCreatedAt } from './dbManager';

const constructHistory =   (aRowFromDB) => {
  const imageData = aRowFromDB.favicon ? getImage(aRowFromDB.favicon) : '';
  return {
          id : aRowFromDB.id,
          sourceKey:  aRowFromDB.source_key || '',
          sourceType: aRowFromDB.source_type || '',
          description: aRowFromDB.description || '',
          favicon: imageData,
          createdAt: aRowFromDB.created_at,
          userId: aRowFromDB.user_id,
          groupId: aRowFromDB.group_id
       }
};
/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getHistoryById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM history WHERE id = ? AND user_id = ?');
    const history = stmt.get(id, userId);
    if (history) return constructHistory(history);
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};



/**
 *
 * @param {*} history
 * @param {*} token
 * @returns history. if success, add id field
 */
export const createHistory= (history, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return history;
  }
  addUserIdCreatedAt(history, userId);
  const sourceType =      history.sourceType || '';
  const sourceKey =    history.sourceKey || '';
  const description = history.description || '';
  const favicon = history.favicon || '';
  const createdAt =  history.createdAt || '';
  const groupId = typeof history.groupId === 'undefined' ? -1 : history.groupId;
  try {
    const s = 'INSERT INTO history (source_type, source_key, description, favicon, created_at, user_id, group_id) ' +
      `VALUES (?,?,?,?,?,?,?) `;
    console.log(s);
    const stmt = db.prepare(s);
    const result = stmt.run(sourceType, sourceKey, description, favicon, createdAt, userId, groupId);
    history.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return history;
};

export const getHistoryByQuery= (sourceType, query, page, limit, token) => {
  const histories = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };
  }
  try {
      const offset = (page - 1) * limit;
      // Query to get the total number of records
      const totalRecordsQuery = db.prepare('SELECT COUNT(*) AS total FROM history WHERE user_id = ?');
      const totalRecords = totalRecordsQuery.get(userId).total;

    let stmt = null;
    // Use concatenation in the parameters to handle the LIKE pattern
   // Make sure to declare the chats array if it's not already declared elsewhere
    if (query) {
      if (sourceType) {
        stmt = db.prepare(`SELECT * FROM history WHERE source_type = ? AND description LIKE ? AND user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
        stmt = stmt.iterate(sourceType, `%${query}%`, userId, limit, offset);
      } else {
        stmt = db.prepare(`SELECT * FROM history WHERE description LIKE ? AND user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
        stmt = stmt.iterate(`%${query}%`, userId, limit, offset);
      }
    } else if (sourceType) {
        stmt = db.prepare(`SELECT * FROM history WHERE source_type = ? AND user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
        stmt = stmt.iterate(sourceType,   userId, limit, offset);
      } else {
        stmt = db.prepare(`SELECT * FROM history WHERE  user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
        stmt = stmt.iterate( userId, limit, offset);
      }
    for (const card of stmt) {
       histories.push( constructHistory(card) );
    }
    return {
      data: histories,
      total: totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page
    };
  } catch (err) {
    console.error(err);
    return {
      data: histories,
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };
  }
};


/**
 *
 * @param {*} groupId
 * @param {*} token
 * @returns []
 */
export const getHistoriesByGroupId = (groupId, token) => {
  const histories = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return histories;
  }
  try {
    const sql = ` SELECT * FROM history WHERE group_id =  ${groupId}  and  user_id = ${userId}  ORDER BY created_at DESC `;
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate()) {
       histories.push( constructHistory(card) );
    }
    return histories;
  } catch (err) {
    console.error(err);
    return histories;
  }
};

export const getHistoryByGroupIdAndSourceKey = (groupId, sourceKey, token) => {
  const histories = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const sql = ` SELECT * FROM history WHERE group_id =  ${groupId} and source_key = ${sourceKey}  and  user_id = ${userId}  ORDER BY created_at DESC `;
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate()) {
       histories.push( constructHistory(card) );
    }
    return histories.length > 0 ? histories[0] : null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteAllHistories(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM history
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

export function updateHistory(id, description, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE history SET description = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run( [description, id, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}
