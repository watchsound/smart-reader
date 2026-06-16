/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
 *{
  id: string;
  sourceKey: string;
  sourceType: string;
  question: string;
  options: {
    optionA : string;
    optionB : string;
    optionC : string;
    optionD : string;
  },
  answer: string;
  myChoice: string;
  correct: INTEGER;
}



CREATE TABLE "quiz_problem" (
  "id"  INTEGER PRIMARY KEY,
  "data" TEXT,
  "created_at" TEXT,
  "user_id"  INTEGER
);

 */
import JSON5 from 'json5';
import db, { getUserIdFromToken, addUserIdCreatedAt } from './dbManager';

/**
 *
 * @param {*} quiz
 * @param {*} token
 * @returns null if failed
 */
export function createQuizProblem(quiz, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  addUserIdCreatedAt(quiz, userId);
  try {
    const data = JSON.stringify(quiz);
    const createdAt = quiz.createdAt || '';

    const sql = `INSERT INTO quiz_problem (data, created_at, user_id) VALUES (?, ?, ?)`;
    const query = db.prepare(sql);
    const result = query.run(data, createdAt, userId);
    quiz.id = result.lastInsertRowid;
    console.log(`A row has been inserted with rowid ${quiz.id}`);
    return quiz;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns
 */
export const getQuizProblemById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM quiz_problem WHERE id = ? and user_id = ?');
    const quiz = stmt.get(id, userId);
    if (quiz) {
      const obj = JSON5.parse(quiz.data);
      obj.id = id;
      return obj;
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} sourceKey
 * @param {*} sourceType
 * @param {*} token
 * @returns []
 */
export function getQuizProblemBySourceKeyAndSourceType(sourceKey, sourceType, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return [];
  }
  const quizProblems = [];
  // Prepare the SQL statement to select rows based on sourceKey and sourceType.
  // json_extract is used to access the values of the sourceKey and sourceType fields in the JSON data.
  try {
    const sql = `
        SELECT *
        FROM quiz_problem
        WHERE CAST(json_extract(data, '$.sourceKey') AS TEXT) = CAST(? AS TEXT)
              AND json_extract(data, '$.sourceType') = ? AND user_id = ?
         ORDER BY created_at DESC
    `;
    const stmt = db.prepare(sql).bind(String(sourceKey), sourceType, userId);
    for (const card of stmt.iterate()) {
      const data = JSON5.parse(card.data);
      data.id = card.id;
      quizProblems.push(data);
    }
    return quizProblems;
  } catch (err) {
    console.error(err);
    return [];
  }
}

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
export function getQuizProblemByQuery(query, page, limit, token) {
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
      const totalRecordsQuery = db.prepare(`SELECT COUNT(*) AS total FROM quiz_problem WHERE  user_id = ?`);
      const totalRecords = totalRecordsQuery.get(userId).total;

    let stmt = null;
    const quizProblems = [];
     if (query) {
       stmt = db.prepare(`SELECT *
        FROM quiz_problem
        WHERE json_extract(data, '$.question') LIKE ?
          AND user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
       stmt = stmt.iterate(`%${query}%`, userId, limit, offset);
    } else {
       stmt = db.prepare(`SELECT *
        FROM quiz_problem
        WHERE  user_id = ?
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
       stmt = stmt.iterate(userId, limit, offset);
    }

    for (const card of stmt) {
      const data = JSON5.parse(card.data);
      data.id = card.id;
      quizProblems.push(data);
    }
    return {
      data: quizProblems,
      total: totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      currentPage: page
    };
  } catch (err) {
    console.error(err);
    return  {
      data: [],
      total: 0,
      totalPages: Math.ceil(0 / limit),
      currentPage: page
    };
  }
}

/**
 *
 * @param {*} id
 * @param {*} note
 * @param {*} token
 * @returns 1 -1
 */
export function replaceQuizProblem(id, note, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const noteString = JSON.stringify(note);
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE quiz_problem SET data = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run( [noteString, id, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} id
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns
 */
export function updateQuizProblem(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `UPDATE quiz_problem SET data = json_set(data, ?, ?) WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run([`$.${field}`, value, id, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} sourceKey
 * @param {*} sourceType
 * @param {*} token
 * @returns
 */
export function deleteQuizProblemBySourceKeyAndSourceType(sourceKey, sourceType, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
      DELETE FROM quiz_problem
      WHERE CAST(json_extract(data, '$.sourceKey') AS TEXT) = CAST(? AS TEXT)
      AND json_extract(data, '$.sourceType') = ?
      AND user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [String(sourceKey), sourceType, userId] );
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
 * @returns 1  -1
 */
export function deleteQuizProblemById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM quiz_problem
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
 * @returns 1 -1
 */
export function deleteAllQuizProblem(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM quiz_problem
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
