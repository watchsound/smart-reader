import db from './dbManager';

/**
CREATE TABLE "leitner_item" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
    "type" INTEGER,   // type == 0 : vocabulary   type == 1 : note
  "box" INTEGER,
  "skips" INTEGER,
  "flips" INTEGER,
  "next_review" TEXT,
  "fully_learned" INTEGER,
  "set_id" INTEGER,
  "score"  INTEGER,
);
 *
 */

export const sqlStmt2LeitnerItem = (record) => {
  return {
    id: record.id,
    type: record.type || 0,
    box: record.box || 1,
    skips: record.skips || 0,
    flips: record.skips || 0,
    nextReview: record.next_review || '',
    fullyLearned: record.fully_learned || 0,
    score: record.score || 0,
  };
};
/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getLeitnerItemById = (id) => {
  try {
    const stmt = db.prepare('SELECT * FROM leitner_item WHERE id = ? ');
    const row = stmt.get(id);
    if (row) return sqlStmt2LeitnerItem(row);
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} leitnerItem
 * @param {*} token
 * @returns message. if success,  id field is added
 */
export const createLeitnerItem = (leitnerItem) => {
  try {
    const score = leitnerItem.score || 0;
    const type = leitnerItem.type || 0;
    const box = leitnerItem.box || 1;
    const skips = leitnerItem.skips || 0;
    const flips = leitnerItem.flips || 0;
    const nextReview = leitnerItem.nextReview || '';
    const fullyLearned = leitnerItem.fullyLearned || 0;

    const stmt = db
      .prepare(
        `INSERT INTO leitner_item ( box, type, skips, flips, next_review, fully_learned, score ) VALUES (?,?, ?, ?,?, ?,? ) `,
      )
      .bind(box, type, skips, flips, nextReview, fullyLearned, score);
    const result = stmt.run();
    leitnerItem.id = result.lastInsertRowid;
    return getLeitnerItemById(leitnerItem.id);
  } catch (err) {
    console.error(err);
    return null;
  }
};

export function updateLeitnerItem(id, field, value) {
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE leitner_item SET ${field} = ? WHERE id = ?  `;
    const query = db.prepare(sql);
    query.run([value, id]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
};

export function deleteLeitnerItemById(id) {
  try {
    const sql = `
        DELETE FROM leitner_item WHERE id = ?
    `;
    const query = db.prepare(sql);
    query.run([id]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}
