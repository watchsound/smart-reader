/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
CREATE TABLE "message" (
  "id"  INTEGER PRIMARY KEY,
  "chat_id"  INTEGER,
  "role"  TEXT,
  "content" TEXT,
  "created_at" TEXT
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
export const getMessageById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM message WHERE id = ?');
    const message = stmt.get(id);
    if (message) return {
      id : message.id,
      chatId:  message.chatId || '',
      role: message.role || '',
      content: message.content || '',
      createdAt: message.created_at || '',
    };
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} message
 * @param {*} token
 * @returns message. if success,  id field is added
 */
export const createMessage= (message, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return message;
  }
  addUserIdCreatedAt(message, userId);
  try {
  const chatId =    message.chatId || '';
  const role =     message.role || '';
  const content =    escapeString(message.content || '');
  const createdAt =    message.createdAt || '';


    const stmt = db.prepare(
      `INSERT INTO message (chat_id, role, content, created_at, user_id) VALUES (?, ?, ?, ?, ?) `
    );
     const result = stmt.run( chatId , role , content , createdAt , userId );
    message.id = result.lastInsertRowid;
  } catch (err) {
    console.error(err);
  }
  return message;
};

/**
 *
 * @param {*} chatId
 * @param {*} token
 * @returns []
 */
export const getMessagesByChatId = (chatId, token) => {
  const messages = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return messages;
  }
  try {
    const stmt = db.prepare('SELECT * FROM message WHERE chat_id = ? and user_id = ? ').bind(chatId, userId);
    for (const card of stmt.iterate()) {
       messages.push({
          id : card.id,
          chatId:  card.chat_id || 0,
          role: card.role || '',
          content: card.content || '',
          createdAt: card.created_at || '',
       });
    }
    return messages;
  } catch (err) {
    console.error(err);
    return messages;
  }
};

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
export const getMessageByQuery = (query, token) => {
  const prompts = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return prompts;
  }
  try {
    const stmt = db.prepare('SELECT * FROM message WHERE content LIKE ? and user_id = ?  ORDER BY created_at DESC').bind(`'%${query}%'`, userId);
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
 * @param {*} id
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns 1 or -1
 */
export function updateMessage(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `UPDATE message SET ${field} = ? WHERE id = ? AND user_id = ?`;
    console.log(`sql  :: id =${id} value=${value} user_id = ${userId}  `);
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
 * @returns
 */
export function deleteMessageById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM message
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

export function deleteMessageByChatId(chatId, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM message
        WHERE chat_id = ? AND user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [chatId, userId] );
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
export function deleteAllMessage(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM message
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
