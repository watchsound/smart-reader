/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
CREATE TABLE "chat" (
  "id"  INTEGER PRIMARY KEY,
  "description"  TEXT,
  "total_tokens"  INTEGER,
  "learn_about"  INTEGER,
  "created_at" TEXT,
  "pinned" INTEGER,
  "auto_delete" INTEGER,
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
export const getChatById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM chat WHERE id = ? and user_id = ?');
    const chat = stmt.get(id, userId);
    if (chat) return {
      id : chat.id,
      description:  chat.description || '',
      totalTokens: chat.totalTokens || 0,
      learnAbout: chat.learn_about > 0,
      pinned: chat.pinned > 0,
      autoDelete: chat.auto_delete > 0,
      createdAt: chat.created_at || '',
      userId : chat.user_id || -1,
    };
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} chat
 * @param {*} token
 * @returns if success, id field is added
 */
export const createChat= (chat, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return chat;
  }
  addUserIdCreatedAt(chat, userId);
 try {
  const description = escapeString(chat.description !== undefined ? chat.description : '');
  const totalTokens = chat.totalTokens !== undefined ? chat.totalTokens : 0;
  const pinned = chat.pinned !== undefined && chat.pinned ? 1 : 0;
  const autoDelete = chat.autoDelete !== undefined && chat.autoDelete  ? 1 : 0;
  const createdAt =    chat.createdAt !== undefined ? chat.createdAt : '';
  const learnAbout = chat.learnAbout !== undefined && chat.learnAbout ? 1 : 0;
 // const userId =    chat.userId !== undefined ? chat.userId : -1;

    const stmt = db.prepare(
       `INSERT INTO chat (description, total_tokens, pinned, auto_delete, learn_about, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(description, totalTokens, pinned, autoDelete, learnAbout, createdAt, userId);
    // Execute the INSERT statement
    console.log("Inserted chat with ID:", result.lastInsertRowid);
    chat.id = result.lastInsertRowid;  // Assuming 'chat' is an object where you want to store the ID
  } catch (err) {
      console.error(err);
  }
  return chat;
};

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
const getChatsOrLearnAboutByQuery = (isChart, query, page, limit, token) => {
  const chats = [];
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
     const conditionStr = isChart ? 'learn_about = 0' : 'learn_about > 0';
     const offset = (page - 1) * limit;
      const statementStr =  `SELECT COUNT(*) AS total FROM chat WHERE ${conditionStr} AND user_id = ?`;
      const totalRecordsQuery = db.prepare(statementStr);
      const totalRecords = totalRecordsQuery.get(userId).total;

    let stmt = null;
    // Use concatenation in the parameters to handle the LIKE pattern
   // Make sure to declare the chats array if it's not already declared elsewhere
    if (query) {
       stmt = db.prepare(`SELECT * FROM chat WHERE description LIKE ? AND  ${conditionStr} AND pinned = 0 AND user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
       stmt = stmt.iterate(`%${query}%`, userId, limit, offset);
    } else {
       stmt = db.prepare(`SELECT * FROM chat WHERE user_id = ? AND ${conditionStr} AND pinned = 0  ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
       stmt = stmt.iterate(userId, limit, offset);
    }
    for (const chat of stmt) {
        chats.push({
            id: chat.id,
            description: chat.description || '',
            totalTokens: chat.total_tokens || '', // Corrected property name from 'content' to 'total_tokens'
            pinned: chat.pinned > 0,
            learnAbout: chat.learn_about > 0,
            autoDelete: chat.auto_delete > 0,
            createdAt: chat.created_at || '',
            userId: chat.user_id || 0,
        });
    }
    return {
      data: chats,
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

export const getChatsByQuery = (query, page, limit, token) => {
  return getChatsOrLearnAboutByQuery(true, query, page, limit, token);
}
export const getLearnAboutByQuery = (query, page, limit, token) => {
  return getChatsOrLearnAboutByQuery(false, query, page, limit, token);
}


const getPinnedChatsOrLearnAbout = (isChart, token) => {
  const chats = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return chats;
  }
 try {

    let stmt = db.prepare(`SELECT * FROM chat WHERE user_id = ?  AND pinned > 0  ORDER BY created_at DESC `);
    stmt = stmt.iterate(userId );

    for (const chat of stmt) {
      if ((isChart && chat.learn_about===0) || (!isChart && chat.learn_about>0))
        chats.push({
          id: chat.id,
          description: chat.description || '',
          totalTokens: chat.total_tokens || '', // Corrected property name from 'content' to 'total_tokens'
          pinned: chat.pinned > 0,
          learnAbout: chat.learn_about > 0,
          autoDelete: chat.auto_delete > 0,
          createdAt: chat.created_at || '',
          userId: chat.user_id || 0,
        });
    }
    return chats;
  } catch (err) {
    console.error(err);
    return [];
  }
};

export const getPinnedChats = (token) => {
  return getPinnedChatsOrLearnAbout(true, token);
};
export const getPinnedLearnAbout = (token) => {
  return getPinnedChatsOrLearnAbout(false, token);
};

/**
 *
 * @param {*} id
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns 1 or -1
 */
export function updateChat(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `UPDATE chat SET ${field} = ? WHERE id = ? AND user_id = ?`;
    console.log( `sql`);
    console.log(`value = ${value} id = ${id} userId = ${userId}`)
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
export function deleteChatById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM chat
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
 * @param {*} token
 * @returns 1 or -1
 */
export function deleteAllChat(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM chat
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
