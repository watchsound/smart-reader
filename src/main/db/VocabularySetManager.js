/* eslint-disable prettier/prettier */
/**
 * CREATE TABLE "vocabulary_set" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "name"  TEXT,
  "score"  INTEGER,
  "last_time_at" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);
 */

import db, {
  getUserIdFromToken,
  addUserIdCreatedAt,
  escapeString,
} from './dbManager';

/**
 *
 * @param {*} vocabularySet
 * @param {*} token
 * @returns if success, id field is added
 */
export const createVocabularySet = (vocabularySet, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return vocabularySet;
  }
  addUserIdCreatedAt(vocabularySet, userId);
  try {
    const name = escapeString(
      vocabularySet.name !== undefined ? vocabularySet.name : '',
    );
    const score = vocabularySet.score !== undefined ? vocabularySet.score : 0;
    const lastTimeAt = vocabularySet.lastTimeAt !== undefined ? vocabularySet.lastTimeAt : '';
    const createdAt = vocabularySet.createdAt !== undefined ? vocabularySet.createdAt : '';
    // const userId =    chat.userId !== undefined ? chat.userId : -1;

    const stmt = db.prepare(
      `INSERT INTO vocabulary_set (name, score, last_time_at,  created_at, user_id) VALUES (?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      name,
      score,
      lastTimeAt,
      createdAt,
      userId,
    );
    // Execute the INSERT statement
    console.log('Inserted chat with ID:', result.lastInsertRowid);
    vocabularySet.id = result.lastInsertRowid; // Assuming 'chat' is an object where you want to store the ID
  } catch (err) {
    console.error(err);
  }
  return vocabularySet;
};

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
export const getVocabularySetByQuery = (query, page, limit, token) => {
  const vs = [];
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page,
    };
  }
  try {
    const offset = (page - 1) * limit;
    // Query to get the total number of records
    const totalRecordsQuery = db.prepare(
      'SELECT COUNT(*) AS total FROM vocabulary_set WHERE user_id = ?',
    );
    const totalRecords = totalRecordsQuery.get(userId).total;

    let stmt = null;
    // Use concatenation in the parameters to handle the LIKE pattern
    // Make sure to declare the chats array if it's not already declared elsewhere
    if (query) {
      stmt =
        db.prepare(`SELECT * FROM vocabulary_set WHERE name LIKE ? AND user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
      stmt = stmt.iterate(`%${query}%`, userId, limit, offset);
    } else {
      stmt = db.prepare(`SELECT * FROM vocabulary_set WHERE user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
      stmt = stmt.iterate(userId, limit, offset);
    }
    for (const chat of stmt) {
      vs.push({
        id: chat.id,
        name: chat.name,
        score: chat.score || 0,
        lastTimeAt: chat.last_time_at || '',
        createdAt: chat.created_at || '',
        userId: chat.user_id || 0,
      });
    }
    return {
      data: vs,
      total: totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page,
    };
  } catch (err) {
    console.error(err);
    return {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page,
    };
  }
};


