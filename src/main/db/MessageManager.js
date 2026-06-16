/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
 *
 * // type can be empty.  used by learn about view
CREATE TABLE "message" (
  "id"  INTEGER PRIMARY KEY,
  "chat_id"  INTEGER,
  "type", TEXT,
  "role"  TEXT,
  "content" TEXT,
  "created_at" TEXT
);

 *
 */
import db, { getUserIdFromToken, addUserIdCreatedAt, escapeString, assertUpdateField } from './dbManager';

const MESSAGE_UPDATABLE = new Set([
  'chat_id', 'type', 'role', 'content',
]);

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getMessageById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM message WHERE id = ?');
    const message = stmt.get(id);
    if (message) return {
      id : message.id,
      chatId:  message.chatId || '',
      role: message.role || '',
      type: message.type || '',
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
    console.warn('session is invalid, userid not found')
    return message;
  }
  console.log('in createMessage of db');
  addUserIdCreatedAt(message, userId);
  try {
  const chatId =    message.chatId || '';
  const role =     message.role || '';
  const type = message.type || '';
  const content =    escapeString(message.content || '');
  const createdAt =    message.createdAt || '';


    const stmt = db.prepare(
      `INSERT INTO message (chat_id, role, type, content, created_at, user_id) VALUES (?, ?, ?, ?, ?, ?) `
    );
     const result = stmt.run( chatId , role , type, content , createdAt , userId );
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
    console.warn('session is invalid, userid not found')
    return messages;
  }
  try {
    const stmt = db.prepare('SELECT * FROM message WHERE chat_id = ? and user_id = ? ').bind(chatId, userId);
    for (const card of stmt.iterate()) {
       messages.push({
         id: card.id,
         chatId: card.chat_id || 0,
         role: card.role || '',
         type: card.type || '',
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
    console.warn('session is invalid, userid not found')
    return prompts;
  }
  try {
    const stmt = db.prepare('SELECT * FROM message WHERE content LIKE ? and user_id = ?  ORDER BY created_at DESC');
    for (const card of stmt.iterate(`%${query}%`, userId)) {
       prompts.push({
         id: card.id,
         title: card.title || '',
         type: card.type || '',
         content: card.content || '',
         source: '',
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
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    assertUpdateField('message', MESSAGE_UPDATABLE, field);
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

export function deleteMessageByChatId(chatId, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
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

