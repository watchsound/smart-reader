/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
CREATE TABLE "mood_board" (
  "id"  INTEGER PRIMARY KEY,
  "name"  TEXT,
  "description"  TEXT,
  "react_grid_layout"   TEXT,
  "react_diagram" TEXT,
  "pinned"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

gridLayout : {
  layout : {lg: []},
  configuration: {
    compactType: vertical|horizontal
    resizeHandles: []
  }
}

diagram {

}
 *
 */
import JSON5 from 'json5';
import db, { getUserIdFromToken, addUserIdCreatedAt, assertUpdateField } from './dbManager';

const MOOD_BOARD_UPDATABLE = new Set([
  'name', 'description', 'react_grid_layout', 'react_diagram', 'pinned',
]);

const recordToObject = (record) => {
  return {
      id : record.id,
      name:  record.name || '',
      description: record.description || '',
      gridLayout: JSON5.parse(record.react_grid_layout || ''),
      diagram:  JSON5.parse(record.react_diagram || ''),
      pinned: record.pinned? 1:0,
      createdAt: record.created_at || '',
      userId : record.user_id || -1,
  };
};

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getMoodBoardById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM mood_board WHERE id = ? and user_id = ?');
    const board = stmt.get(id, userId);
    if (board) return recordToObject(board);
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} board
 * @param {*} token
 * @returns board, if success, id field is added
 */
export const createMoodBoard= (board, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return board;
  }
  addUserIdCreatedAt(board, userId);

  try {
    const name = board.name || '';
    const description = board.description || '';
    const gridLayout = JSON.stringify(board.gridLayout || '');
    const diagram = JSON.stringify(board.diagram || '');
    const pinned = board.pinned ? 1 : 0;
    const { createdAt } = board;

    const stmt = db.prepare(
      'INSERT INTO mood_board (name, description, react_grid_layout, react_diagram, pinned, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, description, gridLayout, diagram, pinned, createdAt, userId);

    board.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return board;
};

const getAllMoodBoards = (page, limit, token) => {
  const boards = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };
  }

  const offset = (page - 1) * limit;
  const totalRecordsQuery = db.prepare('SELECT COUNT(*) AS total FROM mood_board WHERE user_id = ?');
  const totalRecords = totalRecordsQuery.get(userId).total;

  try {
    const sql = `
          SELECT *
          FROM mood_board
          WHERE user_id = ?
          ORDER BY pinned DESC, created_at DESC
          LIMIT ? OFFSET ?
      `;
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate(userId, limit, offset)) {
      const c = recordToObject(card);
      boards.push(c);
    }
    return {
      data: boards,
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
}
/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
export const getMoodBoardsByQuery = (query, page, limit, token) => {
  if (!query) return getAllMoodBoards(page, limit, token);
  const boards = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };
  }
  const q = `%${query}%`;
  const offset = (page - 1) * limit;
  const totalRecordsQuery = db.prepare(`
    SELECT count(*)
    FROM mood_board
    WHERE  ( name LIKE ? or description LIKE ? ) and user_id = ?
    `);
  const totalRecords = totalRecordsQuery.get(q, q, userId).total;
  try {
    const sql = `
          SELECT *
          FROM mood_board
          WHERE  ( name LIKE ? or description LIKE ? ) and user_id = ?
          ORDER BY  pinned DESC, created_at DESC
          LIMIT ? OFFSET ?
      `;
    console.log(sql)
    console.log(` q = ${q} userId = ${userId} limit = ${limit} offset = ${offset}`)
    const stmt = db.prepare(sql);

    for (const card of stmt.iterate(q, q, userId, limit, offset)) {
      const c = recordToObject(card);
      boards.push(c);
    }
    return {
      data: boards,
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
 * @param {*} id
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns if failed return null, otherwise return Moodboard object
 */
export function updateMoodBoard(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return null;
  }
  try {
    console.log(` updateMoodBoard: id = ${id} field = ${field} value = ${value} `);
    assertUpdateField('mood_board', MOOD_BOARD_UPDATABLE, field);
    const sql = `UPDATE mood_board SET ${field} = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run( [value, id, userId]);
    return getMoodBoardById(id, token);
  } catch (err) {
    console.error(err);
    return null;
  }
}

// export function updateMoodBoard2(id, description, configuration, layout, ids, pinned, token) {
//   const userId = getUserIdFromToken(token);
//   if( userId < 0) {
//     console.warn('session is invalid, userid not found')
//     return -1;
//   }
//   // Assuming the field is at the root of the JSON object.
//   const sql = `UPDATE mood_board SET description = ? AND configuration = ? AND layout = ? AND ids = ? AND pinned = ? WHERE id = ? AND user_id = ?`;
//   db.run(sql, [ description, JSON.stringify(configuration || ''), JSON.stringify(layout), ids.join(), pinned?1:0, userId]);
//   return 1;
// }

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteMoodBoardById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM mood_board
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
export function deleteAllMoodBoards(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM mood_board
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
