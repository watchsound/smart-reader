// src/main/utils/microCardProposerSingleton.js
/**
 * Singleton wrapper for MicroCardProposer.
 *
 * MicroCardProposer uses an ES-module default export and is an in-memory
 * singleton (first instantiation wins). Director tools import this module
 * rather than the class directly so that:
 *   1. Tests can mock `microCardProposerSingleton` cleanly without touching
 *      the ES-module default export (which Jest handles poorly with CJS require).
 *   2. The `commit` + `delete` surface matches the soft-write Director tool
 *      contract, which is narrower than MicroCardProposer's full API.
 *
 * commit({ userId, paragraphHash, draft, domain }) → { id }
 *   Stores the accepted draft as a learning_point row via direct SQL.
 *   `id` is the UUID of the created learning_point row (used as the undo handle).
 *
 * delete(id) → boolean
 *   Removes a previously committed card by its UUID. Returns true if a row
 *   was deleted, false if not found.
 */

const { randomUUID } = require('crypto');
// eslint-disable-next-line global-require
const dbManager = require('../db/dbManager');

// MicroCardProposer is an ES-module default export compiled via Babel/TS;
// CJS consumers must use .default.
let _proposer = null;

function getInstance() {
  if (!_proposer) {
    // eslint-disable-next-line global-require
    const mod = require('./MicroCardProposer');
    _proposer = mod.default || mod;
  }
  return _proposer;
}

/**
 * Serialise a draft field into a JSON string matching the learning_point
 * front/back column contract: { text: string }.
 * Handles the Phase-4 shape ({ front, back } on draft) as well as the
 * Director shape ({ title, content }).
 *
 * @param {string|object|undefined} value
 * @returns {string}  JSON string
 */
function toContentJson(value) {
  if (!value) return JSON.stringify({ text: '' });
  if (typeof value === 'string') return JSON.stringify({ text: value });
  // Already a structured object — re-serialise so the column is always TEXT.
  return JSON.stringify(value);
}

/**
 * Commit (accept) a micro-card draft. Writes a learning_point row so the
 * card persists and participates in the Leitner SR schedule.
 *
 * @param {{ userId: number, paragraphHash: string, draft: object, domain: string }} args
 *   draft may contain any of: title, headword, content, definition, front, back
 * @returns {{ id: string }}  UUID of the created row (undo handle)
 */
function commit({ userId, paragraphHash, draft, domain }) {
  const db = dbManager.getDb();
  const id = randomUUID();
  const now = new Date().toISOString();

  // Resolve title — Director uses draft.title; Phase-4 shape may use front.
  const title =
    (draft.title && String(draft.title).trim()) ||
    (draft.headword && String(draft.headword).trim()) ||
    (draft.front && typeof draft.front === 'string'
      ? draft.front.slice(0, 120)
      : '') ||
    '';

  // Resolve front/back JSON columns.
  const front = toContentJson(draft.front || draft.title || draft.headword || '');
  const back = toContentJson(draft.back || draft.content || draft.definition || '');

  // next_review defaults to tomorrow (box 1 interval = 1 day).
  const nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  db.prepare(`
    INSERT INTO learning_point (
      id, user_id, title, front, back,
      domain_type, source_type, source_id,
      box, next_review, mastery_level, ease_factor, interval_days,
      status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, 'book', ?,
      1, ?, 0, 2.5, 1,
      'active', ?, ?
    )
  `).run(
    id,
    userId,
    title,
    front,
    back,
    domain || 'knowledge',
    paragraphHash || null,
    nextReview,
    now,
    now,
  );

  // Touch chapter state so the hash is recorded for dedup gates.
  try {
    const proposer = getInstance();
    if (typeof proposer.getChapterState === 'function') {
      const state = proposer.getChapterState(userId, paragraphHash);
      if (state && state.seenHashes) {
        state.seenHashes.add(paragraphHash);
      }
    }
  } catch (_) {
    // MicroCardProposer unavailable in test/CLI context — safe to ignore.
  }

  return { id };
}

/**
 * Delete (undo) a previously committed micro-card by its learning_point UUID.
 *
 * @param {string} id — UUID returned by commit()
 * @returns {boolean}
 */
function deleteCard(id) {
  if (!id) return false;
  const db = dbManager.getDb();
  const result = db.prepare('DELETE FROM learning_point WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { commit, delete: deleteCard, getInstance };
