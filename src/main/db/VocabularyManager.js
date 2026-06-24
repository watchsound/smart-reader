/**
 *CREATE TABLE "vocabulary" (
  "id"  INTEGER PRIMARY KEY AUTOINCREMENT,
  "word"  TEXT,
  "definition"  TEXT,
  "related_words"  TEXT,
  "example" TEXT,
  "set_id" INTEGER,
  "leitner_item_id"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);
 *
 */

import db, {
  getUserIdFromToken,
  addUserIdCreatedAt,
  assertUpdateField,
} from './dbManager';
import { dateToSQLiteString } from '../../commons/utils/SqliteHelper';
import {
  getLeitnerItemById,
  createLeitnerItem,
} from './LeitnerItemManager';
// Service layer routes to graphInterface → Kùzu (the read store for
// lp-get-all). Writing to LearningPointManager (SQLite) directly would
// be invisible to the renderer. Imported lazily-ish via require so unit
// tests that mock '../utils/LearningPointService' resolve correctly.
// eslint-disable-next-line global-require
const { learningPointService } = require('../utils/LearningPointService');

const buildMirrorPayload = (vocab) => ({
  title: String(vocab.word),
  front: { text: String(vocab.word) },
  back: { text: String(vocab.definition || '') },
  itemType: 'word',
  domainType: 'vocabulary',
  sourceType: 'vocabulary',
  sourceId: String(vocab.id),
  extras: {
    relatedWords: vocab.relatedWords || '',
    example: vocab.example || '',
  },
});

// Non-transactional + fire-and-forget: createVocabulary is synchronous,
// the mirror is async. A learning_point write failure (or pending promise
// at the moment vocab returns) must NOT block the user-facing action; the
// next backfill catches misses.
const mirrorVocabToLearningPoint = (vocab, token) => {
  try {
    const result = learningPointService.createLearningPoint(
      buildMirrorPayload(vocab),
      token,
    );
    if (result && typeof result.catch === 'function') {
      result.catch((err) => {
        console.warn(
          '[VocabularyManager] learning_point mirror promise rejected:',
          err && err.message ? err.message : err,
        );
      });
    }
  } catch (err) {
    console.warn(
      '[VocabularyManager] learning_point mirror failed:',
      err && err.message ? err.message : err,
    );
  }
};

const VOCABULARY_UPDATABLE = new Set([
  'word',
  'definition',
  'related_words',
  'example',
  'set_id',
  'leitner_item_id',
]);

const stmt2obj = (record) => {
  return {
    id: record.id,
    word: record.word || '',
    detail: record.definition || '',
    relatedWords: record.related_words || '',
    example: record.example || '',
    setId: record.set_id || 0,
    leitnerItemId: record.leitner_item_id || 0,
    createdAt: record.created_at || '',
    userId: record.user_id || 0,
  };
};
const stmt2objWithLeitnerItem = (row) => {
  return {
    id: row.vocab_id,
    word: row.word,
    definition: row.definition,
    relatedWords: row.relatedWords,
    example: row.example,
    userId: row.userId,
    createdAt: row.createdAt,
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
/**
 *
 * @param {*} id
 * @param {*} token
 * @returns null if failed
 */
export const getVocabularyById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return null;
  }
  try {
    const stmt = db.prepare(
      'SELECT * FROM vocabulary WHERE id = ? and user_id = ?',
    );
    const row = stmt.get(id, userId);
    if (!row) return null;
    const obj = stmt2obj(row);
    obj.leitnerItem = getLeitnerItemById(obj.leitnerItemId);
    return obj;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const getVocabularyByName = (name, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return null;
  }
  try {
    const stmt = db.prepare(
      'SELECT * FROM vocabulary WHERE word = ? and user_id = ?',
    );
    const row = stmt.get(name, userId);
    if (!row) return null;
    const obj = stmt2obj(row);
    obj.leitnerItem = getLeitnerItemById(obj.leitnerItemId);
    return obj;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} vocabulary
 * @param {*} token
 * @returns message. if success,  id field is added
 */
export const createVocabulary = (vocabulary, token) => {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return vocabulary;
  }
  addUserIdCreatedAt(vocabulary, userId);
  try {
    const setId = vocabulary.setId || 0;
    const word = vocabulary.word || '';
    const definition = vocabulary.definition || '';
    const relatedWords = vocabulary.relatedWords || '';
    const example = vocabulary.example || '';
    const createdAt = vocabulary.createdAt || '';
    let leitnerItemId = 0;
    const leitnerSeed = vocabulary.leitnerItem
      ? { ...vocabulary.leitnerItem, type: 0 }
      : {
          box: 1,
          type: 0,
          skips: 0,
          flips: 0,
          nextReview: '',
          fullyLearned: 0,
          score: 0,
        };
    const vc = createLeitnerItem(leitnerSeed);
    if (!vc) {
      // createLeitnerItem returns null only on DB error — surface a clear
      // diagnostic instead of letting `vc.id` throw a misleading TypeError
      // that the outer catch would then re-log as the wrong root cause.
      console.error('[createVocabulary] createLeitnerItem returned null');
      return null;
    }
    leitnerItemId = vc.id;

    const stmt = db
      .prepare(
        `INSERT INTO vocabulary (set_id, word, definition, related_words, example,
         leitner_item_id, created_at, user_id) VALUES (?,?,?,?, ?,?,?,?) `,
      )
      .bind(
        setId,
        word,
        definition,
        relatedWords,
        example,
        leitnerItemId,
        createdAt,
        userId,
      );
    const result = stmt.run();
    vocabulary.id = result.lastInsertRowid;
    const v = getVocabularyById(vocabulary.id, token);
    if (leitnerItemId) {
      v.leitnerItem = getLeitnerItemById(leitnerItemId);
    }
    // Pass the input vocabulary, not the post-fetch v: stmt2obj renames
    // `definition` → `detail`, so reading the mirror's back text off `v`
    // would silently produce empty back content.
    mirrorVocabToLearningPoint(vocabulary, token);
    return v;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const backfillVocabularyToLearningPoints = async (token) => {
  const result = { scanned: 0, created: 0, skipped: 0, errors: 0 };
  const userId = getUserIdFromToken(token);
  if (userId < 0) return result;
  const rows = db
    .prepare(
      'SELECT id, word, definition, related_words, example FROM vocabulary WHERE user_id = ?',
    )
    .all(userId);
  // Sequential awaits keep error-attribution straightforward and avoid
  // hammering the graph backend with N parallel writes on cold start.
  /* eslint-disable no-restricted-syntax, no-await-in-loop */
  for (const row of rows) {
    result.scanned += 1;
    const existing = await learningPointService.getBySource(
      'vocabulary',
      String(row.id),
      token,
    );
    if (existing && existing.length > 0) {
      result.skipped += 1;
    } else {
      try {
        const created = await learningPointService.createLearningPoint(
          buildMirrorPayload({
            id: row.id,
            word: row.word,
            definition: row.definition,
            relatedWords: row.related_words,
            example: row.example,
          }),
          token,
        );
        if (created && created.error) {
          result.errors += 1;
        } else {
          result.created += 1;
        }
      } catch (err) {
        console.warn(
          '[backfillVocabularyToLearningPoints] mirror failed for id',
          row.id,
          err && err.message ? err.message : err,
        );
        result.errors += 1;
      }
    }
  }
  /* eslint-enable no-restricted-syntax, no-await-in-loop */
  return result;
};

/**
 *
 * @param {*} vocabularySetId
 * @param {*} token
 * @returns []
 */
export const getVocabulariesBySetId = (vocabularySetId, token) => {
  const vs = [];
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return vs;
  }
  try {
    const stmt = db
      .prepare('SELECT * FROM vocabulary WHERE set_id = ? and user_id = ? ')
      .bind(vocabularySetId, userId);
    for (const row of stmt.iterate()) {
      const obj = stmt2obj(row);
      obj.leitnerItem = getLeitnerItemById(obj.leitnerItemId);
      vs.push(obj);
    }
    return vs;
  } catch (err) {
    console.error(err);
    return vs;
  }
};

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns []
 */
export const getVocabulariesByQuery = (query, page, limit, token) => {
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
      'SELECT COUNT(*) AS total FROM vocabulary WHERE  word LIKE ? and user_id = ?',
    );
    const totalRecords = totalRecordsQuery.get(`%${query}%`, userId).total;

    let stmt = null;
    if (query) {
      stmt =
        db.prepare(`SELECT * FROM vocabulary WHERE  word LIKE ? and user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
      stmt = stmt.iterate(`%${query}%`, userId, limit, offset);
    } else {
      stmt =
        db.prepare(`SELECT * FROM vocabulary WHERE  user_id = ?   ORDER BY created_at DESC
          LIMIT ? OFFSET ?`);
      stmt = stmt.iterate(userId, limit, offset);
    }
    for (const row of stmt) {
      const obj = stmt2obj(row);
      obj.leitnerItem = getLeitnerItemById(obj.leitnerItemId);
      vs.push(obj);
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

export const getVocabulariesByDueReview = (aTime, page, limit, token) => {
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
  const aTimeStr = dateToSQLiteString(aTime);

  try {
    const offset = (page - 1) * limit;
    // Query to get the total number of records
    const totalRecordsQuery = db.prepare(
      `SELECT COUNT(*) AS total
      FROM  vocabulary
      INNER JOIN  leitner_item
      ON  vocabulary.leitner_item_id = leitner_item.id
      WHERE vocabulary.user_id = ? AND leitner_item.fully_learned = 0 AND leitner_item.next_review < ? AND  leitner_item.type = 0`,
    );
    const totalRecords = totalRecordsQuery.get(userId, aTimeStr).total;

    const stmt = db.prepare(`
      select
      vocabulary.id AS vocab_id,
      vocabulary.word,
      vocabulary.definition,
      vocabulary.related_words AS relatedWords,
      vocabulary.example,
       vocabulary.created_at as createdAt,
       vocabulary.user_id as userId,
      leitner_item.id AS leitner_id,
      leitner_item.type,
      leitner_item.box,
      leitner_item.skips,
      leitner_item.flips,
      leitner_item.next_review AS nextReview,
      leitner_item.fully_learned AS fullLearned,
      leitner_item.score
         FROM  vocabulary
         INNER JOIN  leitner_item
         ON  vocabulary.leitner_item_id = leitner_item.id
        WHERE vocabulary.user_id = ? AND leitner_item.fully_learned = 0 AND  leitner_item.next_review < ? and leitner_item.type = 0
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
      totalPages: Math.ceil(0 / limit),
      currentPage: page,
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
export function updateVocabulary(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return -1;
  }
  try {
    assertUpdateField('vocabulary', VOCABULARY_UPDATABLE, field);
    const sql = `UPDATE vocabulary SET ${field} = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run([value, id, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

export function addVocabularyToSet(id, setId, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) {
    console.warn('session is invalid, userid not found');
    return -1;
  }
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE vocabulary SET set_id = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run([setId, id, userId]);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

