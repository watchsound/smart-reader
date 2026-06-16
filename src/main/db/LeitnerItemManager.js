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
    flips: record.flips || 0,
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
 * @returns the inserted leitner_item row (with id), or null on failure
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
    return getLeitnerItemById(result.lastInsertRowid);
  } catch (err) {
    console.error(err);
    return null;
  }
};

