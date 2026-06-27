// src/main/db/ForumDiscussionManager.js
/**
 * Persistence for Forum Discussions — simulated multi-persona study forum threads
 * anchored to a position in a book (selection cfi range, or whole-page hash).
 *
 * Turns are append-only and stored as a JSON blob; the design defers per-turn
 * normalization until search/reaction features prove worth the schema change.
 *
 * Lookup key: (book_id, chapter_id, cfi_range) when cfi_range non-null;
 * (book_id, chapter_id, page_text_hash) when cfi_range is null (whole-page).
 */
class ForumDiscussionManager {
  constructor(db) {
    this.db = db;
  }

  _row2discussion(row) {
    if (!row) return null;
    return {
      id: row.id,
      bookId: row.book_id,
      chapterId: row.chapter_id,
      cfiRange: row.cfi_range,
      pageTextHash: row.page_text_hash,
      selectionText: row.selection_text,
      turns: JSON.parse(row.turns_json),
      seedCostUsd: row.seed_cost_usd,
      createdAt: row.created_at,
      lastReplyAt: row.last_reply_at,
    };
  }

  findByAnchor(anchor) {
    let row;
    if (anchor.cfiRange) {
      row = this.db
        .prepare(
          `SELECT * FROM forum_discussion
           WHERE book_id = ? AND chapter_id IS ? AND cfi_range = ?`,
        )
        .get(anchor.bookId, anchor.chapterId, anchor.cfiRange);
    } else {
      row = this.db
        .prepare(
          `SELECT * FROM forum_discussion
           WHERE book_id = ? AND chapter_id IS ? AND cfi_range IS NULL AND page_text_hash = ?`,
        )
        .get(anchor.bookId, anchor.chapterId, anchor.pageTextHash);
    }

    // Chapter backfill: if the user clicked Discuss before chapter context
    // arrived, the discussion was stored with chapter_id = NULL. When the
    // same passage is revisited with chapter context now known, the exact-
    // match query above misses. Fall back to a chapter-agnostic match on
    // (book, cfi_or_hash) where stored chapter_id IS NULL, then patch the
    // row so subsequent listByBookChapter calls surface it.
    if (!row && anchor.chapterId) {
      if (anchor.cfiRange) {
        row = this.db
          .prepare(
            `SELECT * FROM forum_discussion
             WHERE book_id = ? AND chapter_id IS NULL AND cfi_range = ?`,
          )
          .get(anchor.bookId, anchor.cfiRange);
      } else {
        row = this.db
          .prepare(
            `SELECT * FROM forum_discussion
             WHERE book_id = ? AND chapter_id IS NULL
                   AND cfi_range IS NULL AND page_text_hash = ?`,
          )
          .get(anchor.bookId, anchor.pageTextHash);
      }
      if (row) {
        this.db
          .prepare(`UPDATE forum_discussion SET chapter_id = ? WHERE id = ?`)
          .run(anchor.chapterId, row.id);
        row.chapter_id = anchor.chapterId;
      }
    }

    return this._row2discussion(row);
  }

  create(anchor, seedTurns, seedCostUsd) {
    const now = Date.now();
    const turnsJson = JSON.stringify(seedTurns);
    const info = this.db
      .prepare(
        `INSERT INTO forum_discussion
           (book_id, chapter_id, cfi_range, page_text_hash, selection_text,
            turns_json, seed_cost_usd, created_at, last_reply_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        anchor.bookId,
        anchor.chapterId,
        anchor.cfiRange,
        anchor.pageTextHash,
        anchor.selectionText,
        turnsJson,
        seedCostUsd,
        now,
        now,
      );
    return this.getById(info.lastInsertRowid);
  }

  appendTurns(id, newTurns) {
    const current = this.getById(id);
    if (!current) throw new Error(`forum_discussion ${id} not found`);
    const merged = [...current.turns, ...newTurns];
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE forum_discussion SET turns_json = ?, last_reply_at = ? WHERE id = ?`,
      )
      .run(JSON.stringify(merged), now, id);
    return this.getById(id);
  }

  getById(id) {
    const row = this.db
      .prepare(`SELECT * FROM forum_discussion WHERE id = ?`)
      .get(id);
    return this._row2discussion(row);
  }

  listByBookChapter(bookId, chapterId) {
    const rows = this.db
      .prepare(
        `SELECT * FROM forum_discussion WHERE book_id = ? AND chapter_id IS ?
         ORDER BY created_at ASC`,
      )
      .all(bookId, chapterId);
    return rows.map((r) => this._row2discussion(r));
  }
}

module.exports = ForumDiscussionManager;
