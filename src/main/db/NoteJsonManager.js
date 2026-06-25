/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
 * {
    sourceKey: string,     //for note, book, url,  it is foreign key, for Note, Book and Bookmark ,
    sourceType: string,    //note, book, url, chat
    chapter: string,
    chapterIndex: number,
    title: string,    //in highlightOnly: from user input, first 25 characters.
    cards: {
      id: number,
      text: string,   //in highlightOnly: first card for original text,
      html: string,
      image: string,
      overlap: number,
      type: string,
    }[],
    cfi: string,
    range: string,
    percentage: number,
    position: {         //used in pdf view.
       x1,
       y1,
       x2,
       y2,
      width,
      height,
      pageNumber,
    }[],
    emoji: string,
    color: string,
    tags: string[],
    rate: number,
    hasQuiz: boolean,
    highlightOnly: boolean,
    highlightType: string,
  }

  for pdf , i use different approach:

   {
      content: {
        text: " Type Checking for JavaScript", || image : "base64..."
      },
      position: {
        boundingRect: {
          x1: 255.73419189453125,
          y1: 139.140625,
          x2: 574.372314453125,
          y2: 165.140625,
          width: 809.9999999999999,
          height: 1200,
        },
        rects: [
          {
            x1: 255.73419189453125,
            y1: 139.140625,
            x2: 574.372314453125,
            y2: 165.140625,
            width: 809.9999999999999,
            height: 1200,
          },
        ],
        pageNumber: 1,
      },
      comment: {
        text: "Flow or TypeScript?",
        emoji: "🔥",
      },
      id: "8245652131754351",
    },




 * CREATE TABLE note (
    id INTEGER PRIMARY KEY,
    data TEXT,
    "leitner_item_id"  INTEGER,
    "created_at" TEXT,
    "user_id"  INTEGER
  );

 */
import JSON5 from 'json5';
import { v4 as uuidv4 } from 'uuid';
import db, { getUserIdFromToken, addUserIdCreatedAt } from './dbManager';
import { createLeitnerItem, getLeitnerItemById } from './LeitnerItemManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';

const cardText = (card) => {
  if (!card) return '';
  if (typeof card === 'string') return card;
  return card.text || card.html || '';
};

// Mirror a note into learning_point so the LeitnerSystem main panel
// (which reads learning_point, not leitner_item) can surface it for
// study. SYNCHRONOUS direct-to-SQLite write — must complete inside the
// sendSync IPC handler so the renderer's post-dispatch refresh sees the
// row. The original async LearningPointService path raced the refresh
// AND its createLearningPoint set next_review to (today + 1 day), so
// fresh mirrors weren't due. Idempotent via (source_type, source_id).
const mirrorNoteToLearningPoint = (note, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return;
  try {
    const existing = db
      .prepare(
        `SELECT id FROM learning_point
         WHERE user_id = ? AND source_type = 'note' AND source_id = ?
         LIMIT 1`,
      )
      .get(userId, String(note.id));
    if (existing) return;

    const card0 = note.cards?.[0];
    const card1 = note.cards?.[1];
    const frontText = cardText(card0);
    const backText = cardText(card1) || frontText;
    const title =
      (note.title || frontText || '').slice(0, 100) || 'Untitled note';
    const now = dateToSQLiteString(new Date());

    db.prepare(`
      INSERT INTO learning_point (
        id, user_id, title, front, back, extras,
        item_type, domain_type, difficulty, format,
        tags, source_type, source_id, plan_id, book_id,
        box, next_review, mastery_level, ease_factor, interval_days,
        status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?
      )
    `).run(
      `lp_${uuidv4()}`,
      userId,
      title,
      JSON.stringify({ text: frontText }),
      JSON.stringify({ text: backText }),
      null,
      'concept',
      'knowledge',
      'intermediate',
      'card',
      note.tags ? JSON.stringify(note.tags) : null,
      'note',
      String(note.id),
      null,
      null,
      1,
      now, // next_review = today → immediately due
      0,
      2.5,
      1,
      'active',
      now,
      now,
    );
  } catch (err) {
    console.warn(
      '[NoteJsonManager] learning_point mirror failed:',
      err && err.message ? err.message : err,
    );
  }
};

/**
 *
 * @param {*} note
 * @param {*} token
 * @returns if success , id field is added, otherwise null
 */
export function createNote(note, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return note;
  }
  addUserIdCreatedAt(note, userId);
  const data = JSON.stringify(note);
  const createdAt = note.createdAt || '';
  try {
    const sql = `INSERT INTO note (data, leitner_item_id, created_at, user_id) VALUES (?, ?,?,?)`;
    // const sql = `INSERT INTO note (data, created_at, user_id) VALUES ('${data}', '${createdAt}', ${userId})`;
    const query = db.prepare(sql);
    const result = query.run( data, 0, createdAt, userId);
    note.id = result.lastInsertRowid;
    console.log(`A row has been inserted with rowid ${note.id}`);
    return note;
  } catch (err) {
    console.error(err);
    return note;
  }
}

/**
 *
 * @param {*} id
 * @param {*} token
 * @returns
 */
export const getNoteById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return null;
  }
  try {
    console.log( ` getNoteByI id = ${  JSON.stringify(id)}`);
    console.log( `userId = ${  typeof userId}` );
    const stmt = db.prepare('SELECT * FROM note WHERE id = ? and user_id = ?');
    const note = stmt.get([id, userId]);
    if (note) {
      const noteObj = JSON5.parse(note.data);
      noteObj.id = id;
      noteObj.leitnerItemId = note.leitner_item_id;
      return noteObj;
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};
/**
 *
 * @param {*} ids []
 * @param {*} token
 * @returns
 */
export const getNotesByIds = (ids, token) => {
  const notes = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return notes;
  }
  try {
    const placeholders = ids.map(() => '?').join(', ');
    const sql = `SELECT * FROM note WHERE id IN (${placeholders}) AND user_id = ${userId}`;

    // Prepare and run the query with the array of IDs
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate()) {
      const data = JSON5.parse(card.data);
      data.id = card.id;
      data.leitnerItemId = card.leitner_item_id;
      notes.push(data);
    }
    return notes;
  } catch (err) {
    console.error(err);
    return notes;
  }
};

/**
 *
 * @param {*} sourceKey
 * @param {*} sourceType
 * @param {*} token
 * @returns []
 */
export function queryNoteBySourceKeyAndSourceType(sourceKey, sourceType, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return [];
  }
  const notes = [];
  try {
    // Prepare the SQL statement to select rows based on sourceKey and sourceType.
    // json_extract is used to access the values of the sourceKey and sourceType fields in the JSON data.
    const sql = `
        SELECT *
        FROM note
        WHERE CAST(json_extract(data, '$.sourceKey') AS TEXT) = CAST(? AS TEXT)
              AND json_extract(data, '$.sourceType') = ? AND user_id = ?
        ORDER BY created_at DESC;
    `;
   // console.log( "queryNoteBySourceKeyAndSourceType " + sql);
    console.log( ` sourceKey= ${typeof sourceKey} sourceType = ${typeof sourceType} userId = ${typeof userId}`)
    const stmt = db.prepare(sql);
    for (const card of stmt.iterate([String(sourceKey), sourceType, userId])) {
      const data = JSON5.parse(card.data);
      data.id = card.id;
      data.leitnerItemId = card.leitner_item_id;
      notes.push(data);
    }
    console.log( ` found ${notes.length} records`)
    return notes;
  } catch (err) {
    console.error(err);
    return notes;
  }
}

const stmt2objWithLeitnerItem = (row) => {
  const data = JSON5.parse(row.data);
  return {
    ...data,
    id: row.note_id,
    leitnerItemId: row.leitner_id,
    leitnerItem: {
      id: row.leitner_id,
      type: row.type,
      box: row.box,
      skips: row.skips,
      flips: row.flips,
      nextReview: row.nextReview,
      fullLearned: row.fullLearned,
      score: row.score,
    },
  };
};

export const getNotesByDueReview = (aTime, page, limit, token) => {
  const vs = [];
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return {
      data: [],
      total: 0,
      totalPages: 0,
      currentPage: page,
    };
  }
  const aTimeStr = dateToSQLiteString(aTime);

  try {
    const offset = (page - 1) * limit;
    // Query to get the total number of records
    const totalRecordsQuery = db.prepare(
      `SELECT COUNT(*) AS total
      FROM  note
      INNER JOIN  leitner_item
      ON  note.leitner_item_id = leitner_item.id
      WHERE note.user_id = ? AND leitner_item.fully_learned = 0 AND leitner_item.next_review < ? AND  leitner_item.type = 1`,
    );
    const totalRecords = totalRecordsQuery.get(userId, aTimeStr).total;

    const stmt = db.prepare(`
      select
      note.id AS note_id,
      note.data,
      note.leitner_item_id AS leitnerItemId,
       note.created_at as createdAt,
       note.user_id as userId,
      leitner_item.id AS leitner_id,
      leitner_item.type,
      leitner_item.box,
      leitner_item.skips,
      leitner_item.flips,
      leitner_item.next_review AS nextReview,
      leitner_item.fully_learned AS fullLearned,
      leitner_item.score
         FROM  note
         INNER JOIN  leitner_item
         ON  note.leitner_item_id = leitner_item.id
        WHERE note.user_id = ? AND leitner_item.fully_learned = 0 AND  leitner_item.next_review < ? and leitner_item.type = 1
        ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
    const rows = stmt.all(userId, aTimeStr, limit, offset);
    rows.forEach((row) => {
      const obj = stmt2objWithLeitnerItem(row);
      vs.push(obj);
    });

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
      totalPages: 0,
      currentPage: page,
    };
  }
};


 function getNotesByQueryImpl(queryString, tag, star, page, limit, token) {

  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return {
      data: [],
      total: 0,
      totalPages: 0,
      currentPage: page
    };
  }
  console.log(` getNotesByQuery user-id = ${  userId   }
  query = ${  queryString} star = ${star} tag = ${tag}`);

  const offset = (page - 1) * limit;

  // Base SQL query for data retrieval
  let sql = `
    SELECT DISTINCT note.*
    FROM note
      LEFT JOIN json_each(CASE
                      WHEN json_type(note.data, '$.cards') = 'array'
                      THEN json_extract(note.data, '$.cards')
                      ELSE '[]'
                    END) AS card ON 1=1
      LEFT JOIN json_each(CASE
                      WHEN json_type(note.data, '$.tags') = 'array'
                      THEN json_extract(note.data, '$.tags')
                      ELSE '[]'
                    END) AS tagData ON 1=1
    WHERE 1=1
  `;

  // Base SQL query for count
  let countSql = `
    SELECT COUNT(DISTINCT note.id) AS total
    FROM note
     LEFT JOIN json_each(CASE
                      WHEN json_type(note.data, '$.cards') = 'array'
                      THEN json_extract(note.data, '$.cards')
                      ELSE '[]'
                    END) AS card ON 1=1
      LEFT JOIN json_each(CASE
                      WHEN json_type(note.data, '$.tags') = 'array'
                      THEN json_extract(note.data, '$.tags')
                      ELSE '[]'
                    END) AS tagData ON 1=1
    WHERE 1=1
  `;

  // Parameters to bind
  const params = [];
  const countParams = [];

  // Add queryString filter
  if (queryString) {
    sql += ` AND card.value->>'text' LIKE ?`;
    countSql += ` AND card.value->>'text' LIKE ?`;
    params.push(`%${queryString}%`);
    countParams.push(`%${queryString}%`);
  }

  // Add tag filter
  if (tag) {
    sql += ` AND tagData.value->>'text' LIKE ?`;
    countSql += ` AND tagData.value->>'text' LIKE ?`;
    params.push(`%${tag}%`);
    countParams.push(`%${tag}%`);
  }

  // Add star filter
  if (star !== undefined) {
    sql += ` AND json_extract(note.data, '$.rate') = ?`;
    countSql += ` AND json_extract(note.data, '$.rate') = ?`;
    params.push(star);
    countParams.push(star);
  }

    sql += ` AND user_id = ?`;
    countSql += ` AND user_id = ?`;
    params.push(userId);
    countParams.push(userId);


  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Execute count query
  console.log(` countSql = ${countSql}    ||  countParams = ${countParams}`);

  const countStmt = db.prepare(countSql);
  const totalCount = countStmt.get(...countParams).total;

  console.log(` sql = ${sql}    ||  params = ${params}`);
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params);

  const notes = [];
  rows.forEach(row =>  {
    const data = JSON5.parse(row.data);
    data.id = row.id;
    data.leitnerItemId = row.leitner_item_id;
    notes.push(data);
  });

  return {
    total: totalCount,
    data: notes,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page
  };
}

export function getNotesByQuery(queryString, tag, star, page, limit, token) {
  try {
    return getNotesByQueryImpl(queryString, tag, star, page, limit, token);
  } catch (e) {
    // Intentional fallback-to-empty so search-as-you-type degrades gracefully
    // on transient DB / JSON5-parse errors. Log at error level so genuine
    // failures still surface in diagnostics rather than hiding in info logs.
    console.error('[NoteJsonManager.getNotesByQuery]', e);
  }
  return {
    data: [],
    total: 0,
    totalPages: 0,
    currentPage: page
  };
}

/**
 *
 * @param {*} noteId
 * @param {*} note
 * @param {*} token
 * @returns 1 or -1
 */
export function replaceNote(noteId, note, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const noteString = JSON.stringify(note);
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE note SET data = ? WHERE id = ?`;
    const query = db.prepare(sql);
    query.run( [noteString, noteId]);
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
 * @returns 1 or -1
 */
export function deleteNoteBySourceKeyAndSourceType(sourceKey, sourceType, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM note
        WHERE json_extract(data, '$.sourceKey') = ? AND json_extract(data, '$.sourceType') = ? AND user_id = ?
    `;
    console.log( sql )
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
 * @returns 1 or -1
 */
export function deleteNoteById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  // console.log(typeof id); // should output 'number'
  // console.log(typeof userId); // should output 'number
  try {
    const sql = `
        DELETE FROM note
        WHERE id = ? AND user_id = ?
    `;
    console.log(sql);
    const query = db.prepare(sql);
    query.run( [id, userId] );
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}
export function addNoteToLeitnerStudy(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  const obj = getNoteById(id, token);
  if (!obj) return -1;
  if (obj.leitnerItemId) {
    // Tag re-adds so the UI can show "Already in Leitner" instead of a
    // misleading "Added" toast. Still attempt the mirror — handles
    // notes that pre-date the learning_point mirror landing.
    const existing = getLeitnerItemById(obj.leitnerItemId);
    if (!existing) return -1;
    mirrorNoteToLearningPoint(obj, token);
    return { ...existing, wasAlreadyAdded: true };
  }
  try {
    const vc = createLeitnerItem({
      box: 1,
      type: 1, //1 means notes
      skips: 0,
      flips: 0,
      nextReview: '',
      fullyLearned: 0,
      score: 0,
    });
    if (!vc) {
      // createLeitnerItem returns null only on DB error — surface a clear
      // diagnostic instead of letting `vc.id` throw a misleading TypeError.
      console.error(
        '[NoteJsonManager.addNoteToLeitnerStudy] createLeitnerItem returned null',
      );
      return -1;
    }
    const sql = `UPDATE note SET leitner_item_id = ? WHERE id = ? and user_id = ?`;
    const query = db.prepare(sql);
    query.run([vc.id, id, userId]);
    mirrorNoteToLearningPoint(obj, token);
    return { ...vc, wasAlreadyAdded: false };
  } catch (e) {
    console.error('[NoteJsonManager.addNoteToLeitnerStudy]', e);
    return -1;
  }
}
/**
 *
 * @param {*} noteId
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns 1 or -1
 */
export function updateNote(noteId, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  if (field === 'leitner_item_id') {
    try {
      const sql = `UPDATE note SET leitner_item_id = ? WHERE id = ? and user_id = ?`;
      const query = db.prepare(sql);
      query.run( [value, noteId, userId]);
      return 1;
    } catch (err) {
      console.error(err);
      return -1;
    }
  }
  try {
    console.log(`updatenote - noteId =  ${noteId}  field = ${  field  } value = ${  value}`)
    const sql = `UPDATE note SET data = json_set(data, ?, ?) WHERE id = ? and user_id = ?`;
    const query = db.prepare(sql);
    query.run([`$.${field}`, value, noteId, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} noteId
 * @param {*} cardIndex
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns -1 or 1
 */
export function updateNoteCard(noteId, cardIndex, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    // Construct the JSON path to the target field of the specific card.
    // SQLite JSON paths start with $, array elements are indexed with square brackets.
    const jsonPath = `$.cards[${cardIndex}].${field}`;
    // Prepare the SQL statement to update the specified field in the card.
    // json_set(target_json, path_to_field, new_value) is used to update the JSON document.
    const sql = `UPDATE note SET data = json_set(data, ?, json(?)) WHERE id = ? AND user_id = ?`;

    const query = db.prepare(sql);
    query.run( [jsonPath, value, noteId, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} token
 * @returns -1 or 1
 */
export function deleteAllNote(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM note
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
