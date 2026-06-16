/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**

CREATE TABLE "history_group" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "group_name" TEXT NOT NULL,
  "created_at" TEXT,
  "user_id"  INTEGER
);

 *
 */
import db, { getUserIdFromToken, addUserIdCreatedAt , } from './dbManager';

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getHistoryGroupById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM history_group WHERE id = ? AND user_id = ?');
    const group = stmt.get(id, userId);
    if (group) return {
      id : group.id,
      groupName:  group.group_name || '',
      createdAt : group.created_at,
      userId: group.user_id,
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
 * @returns  if failed null.
 */
export const getHistoryGroupByName= (name, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM history_group WHERE group_name = ? AND user_id = ?');
    const group = stmt.get(name, userId);
    if (group) return {
      id : group.id,
      groupName:  group.group_name || '',
      createdAt : group.created_at,
      userId: group.user_id,
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
 * @returns { groupName: name, parentGroupId }; if success , add id field
 */
export const createHistoryGroup= ( name, token) => {
  const group = { groupName: name  };
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return group;
  }
  addUserIdCreatedAt(group, userId);
  const createdAt =  group.createdAt || '';
  try {
    const stmt = db.prepare(
      'INSERT INTO history_group (group_name,  created_at, user_id) VALUES (?, ?, ?)'
    );
    const result = stmt.run(name, createdAt, userId);
    group.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return group;
};

/**
 *
 * @param {*} token
 * @returns []
 */
export const getHistoryGroupByQuery = (query, page, limit, token) => {
  const historyGroups = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };;
  }
  try {
     const offset = (page - 1) * limit;
      // Query to get the total number of records
      const totalRecordsQuery = db.prepare('SELECT COUNT(*) AS total FROM history_group  WHERE user_id = ?');
      const totalRecords = totalRecordsQuery.get(userId).total;

    let stmt = null;
     if (query) {
       stmt = db.prepare(`SELECT * FROM history_group WHERE name LIKE ? AND user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
       stmt = stmt.iterate(`%${query}%`, userId, limit, offset);
    } else {
       stmt = db.prepare(`SELECT * FROM history_group WHERE user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
       stmt = stmt.iterate(userId, limit, offset);
    }

    for (const card of stmt) {
       historyGroups.push({
          id : card.id,
          groupName:  card.group_name || '',
          createdAt: card.created_at,
          userId: card.user_id,
       });
    }
    return {
      data: historyGroups,
      total: totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page
    };
  } catch (err) {
    console.error(err);
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };
  }
};



/**
 *
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteAllHistoryGroups(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM history_group
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

