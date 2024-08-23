/* eslint-disable prettier/prettier */
/**
 *
 */
import db from './dbManager';
// import { hashText } from '../utils/encrypt';

/**
 *
 * @param {*} email
 * @param {*} password
 * @returns { id: -1, username: '' } if failed
 */
export const login = (email, password) => {
  try {
    const passwordHash = password; // hashText(password);
    // console.log(`email = ${  email  } password = ${  password  } hash = ${  password_hash}`);
    const stmt = db.prepare('SELECT id, username FROM user WHERE email = ? AND password_hash = ?');
    const person = stmt.get(email, passwordHash);
    if (person) return {  id: person.id, username: person.username };
    return { id: -1, username: '' };
  } catch (err) {
    console.error(err);
    return { id: -1,  username: '' };
  }
};

/**
 *
 * @param {*} username
 * @param {*} email
 * @param {*} password
 * @returns 1 or -1
 */
export const register = (username, email, password) => {
  const password_hash = password;// hashText(password);
  const status = 1;
  try {
    const insertQuery = db.prepare(
      `INSERT INTO user (username, email, password_hash, status) VALUES ('${username}' , '${email}' , '${password_hash}' , ${status})`,
    );

    const transaction = db.transaction(() => {
      const info = insertQuery.run();
      console.log(
        `Inserted ${info.changes} rows with last ID
                 ${info.lastInsertRowid} into person`,
      );
    });
    transaction();
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
};
