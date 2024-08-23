/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
 CREATE TABLE "prompt" (
  "id"  INTEGER PRIMARY KEY,
  "title"  INTEGER,
  "content"  TEXT,
  "source" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
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
export const getPromptById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM prompt WHERE id = ? and user_id = ?');
    const prompt = stmt.get(id, userId);
    if (prompt) return {
      id : prompt.id,
      title:  prompt.title || '',
      content: prompt.content || '',
      source: prompt.source || '',
      createdAt: prompt.created_at || '',
      userId: prompt.user_id || 0,
    };
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} prompt
 * @param {*} token
 * @returns prompt
 */
export const createPrompt= (prompt, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return prompt;
  }
  addUserIdCreatedAt(prompt, userId);
  try {
  const title = escapeString(prompt.title || '');
  const content = escapeString(prompt.content || '');
  const source = prompt.source || '';
  const createdAt = prompt.createdAt || '';


    const stmt = db.prepare(
      'INSERT INTO prompt (title, content, source, created_at, user_id)' +
      ` VALUES ('${title}','${content}','${source}','${createdAt}', ${userId} ) `
    );
     const result = stmt.run();
    prompt.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return prompt;
};

/**
 *
 * @param {*} source
 * @param {*} token
 * @returns []
 */
export const getPromptsBySource = (source, token) => {
  const prompts = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return prompts;
  }
  try {
    const stmt = db.prepare('SELECT * FROM prompt WHERE source = ? and user_id = ?').bind(source, userId);
    for (const card of stmt.iterate()) {
       prompts.push({
          id : card.id,
          title:  card.title || '',
          content: card.content || '',
          source: card.source || '',
          createdAt: card.created_at || '',
          userId: card.user_id || 0,
       });
    }
    return prompts;
  } catch (err) {
    console.error(err);
    return prompts;
  }
};

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
export const getPromptsByQuery = (query, page, limit,  token) => {
  const prompts = [];
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
    const totalRecordsQuery = db.prepare('SELECT COUNT(*) AS total FROM prompt WHERE user_id = ?');
    const totalRecords = totalRecordsQuery.get(userId).total;

    let stmt = null;
    if ( query ){
      stmt = db.prepare(`SELECT * FROM  prompt  WHERE content LIKE ? AND user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
      stmt = stmt.iterate(`'%${query}%'`, userId, limit, offset);
    } else {
      stmt = db.prepare(`SELECT * FROM prompt WHERE  user_id = ?  ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
      stmt = stmt.iterate( userId, limit, offset);
    }
    for (const card of stmt) {
       prompts.push({
          id : card.id,
          title:  card.title || '',
          content: card.content || '',
          source: card.source || '',
          createdAt: card.created_at || '',
          userId: card.user_id || 0,
       });
    }
    return {
      data: prompts,
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
 * @returns 1 or -1
 */
export function updatePrompt(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE prompt SET ${field} = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run([value, id, userId]);
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
export function deletePromptById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM prompt
        WHERE id = ? AND user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [id, userId] );
    return 1;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 *
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteAllPrompt(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM prompt
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
