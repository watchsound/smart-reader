/**
 * MoodBoardOrganizerService — Phase 8 organize loop.
 *
 * Runs inside the Brain heartbeat. Detects clusters of recently-added
 * learning points (same book + same domain, last N days, ≥ minClusterSize)
 * and creates a single notification per cluster suggesting that the reader
 * "organize what you just learned" in a MoodBoard.
 *
 * Dedup: one nudge per (bookId, domainType). Persisted in electron-store
 * under `moodBoard.organizeSuggestions` so we don't re-notify on every tick.
 * A separate slice (Slice 2) will let the user clear/reset the dedup record
 * after they actually organize the cluster.
 *
 * Notification payload uses `actionUrl: '/moodboard'` so clicking it opens
 * the MoodBoard list view. Pre-population of a board from cluster contents
 * is Slice 2.
 */

const { default: db } = require('../db/dbManager');
const {
  createNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} = require('../db/NotificationManager');

/**
 * The brain's heartbeat passes a synthetic token. NotificationManager
 * resolves tokens via `global.shared.store.session_info.token`, so we look
 * the real session token up directly. Returns null if no user is signed in
 * (in which case the heartbeat should skip notification creation).
 */
function getActiveSessionToken() {
  const sessionInfo = global?.shared?.store?.get?.('session_info');
  return sessionInfo?.token || null;
}

const STORE_KEY = 'moodBoard.organizeSuggestions';
const DEFAULT_DAYS = 7;
const DEFAULT_MIN_CLUSTER = 5;
const MAX_TITLES_PREVIEW = 3;

/**
 * Module-level so it can be stubbed in tests; doesn't need `this`.
 * Returns clusters matching the (book, domain, recency, size) criteria.
 */
function queryClusters(userId, options = {}) {
  const days = options.days || DEFAULT_DAYS;
  const minClusterSize = options.minClusterSize || DEFAULT_MIN_CLUSTER;
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  const aggStmt = db.prepare(`
    SELECT
      lp.book_id          AS bookId,
      lp.domain_type      AS domainType,
      COUNT(*)            AS pointCount,
      MIN(lp.created_at)  AS oldestAt,
      MAX(lp.created_at)  AS newestAt
    FROM learning_point lp
    WHERE lp.user_id = ?
      AND lp.book_id IS NOT NULL
      AND lp.status = 'active'
      AND lp.created_at >= ?
    GROUP BY lp.book_id, lp.domain_type
    HAVING COUNT(*) >= ?
  `);
  const aggRows = aggStmt.all(userId, sinceIso, minClusterSize);
  if (aggRows.length === 0) return [];

  const detailStmt = db.prepare(`
    SELECT id, title
    FROM learning_point
    WHERE user_id = ? AND book_id = ? AND domain_type = ?
      AND status = 'active' AND created_at >= ?
    ORDER BY created_at DESC
  `);
  const bookStmt = db.prepare(`SELECT name FROM book WHERE id = ?`);

  return aggRows.map((row) => {
    const points = detailStmt.all(userId, row.bookId, row.domainType, sinceIso);
    const bookRow = bookStmt.get(row.bookId);
    return {
      bookId: row.bookId,
      bookTitle: bookRow ? bookRow.name : `Book #${row.bookId}`,
      domainType: row.domainType || 'knowledge',
      pointIds: points.map((p) => p.id),
      conceptTitles: points.slice(0, MAX_TITLES_PREVIEW).map((p) => p.title),
      pointCount: row.pointCount,
      oldestAt: row.oldestAt,
      newestAt: row.newestAt,
    };
  });
}

class MoodBoardOrganizerService {
  constructor(services = {}) {
    this.store = services.store || null;
    this.episodeCollector = services.episodeCollector || null;
  }

  readSuggestions() {
    if (!this.store) return {};
    const raw = this.store.get(STORE_KEY, {});
    return raw && typeof raw === 'object' ? raw : {};
  }

  writeSuggestions(map) {
    if (this.store) this.store.set(STORE_KEY, map);
  }

  /**
   * Detect organize-worthy clusters of recently-added learning points.
   * Thin wrapper over `queryClusters` so subclasses/tests can override.
   *
   * @param {number} userId
   * @param {Object} [options]
   * @param {number} [options.days]
   * @param {number} [options.minClusterSize]
   * @returns {Array}
   */
  // eslint-disable-next-line class-methods-use-this
  detectClusters(userId, options = {}) {
    return queryClusters(userId, options);
  }

  /**
   * Detect clusters and emit a notification for each NEW one. Idempotent
   * per (bookId, domainType): once a suggestion has been recorded for a
   * cluster, it won't fire again until the dedup record is cleared.
   *
   * @param {number} userId
   * @param {string} token
   * @param {Object} [options]
   * @returns {{ created: number, skipped: number, clusters: Array }}
   */
  suggestOrganize(userId, token, options = {}) {
    // Heartbeat token is synthetic — resolve the real session token so the
    // notification gets the correct user_id. If nobody is signed in, skip.
    const effectiveToken = getActiveSessionToken() || token;
    if (!effectiveToken) {
      return { created: 0, skipped: 0, clusters: [], reason: 'no session' };
    }

    const clusters = this.detectClusters(userId, options);
    if (clusters.length === 0) {
      return { created: 0, skipped: 0, clusters: [] };
    }

    const suggestions = this.readSuggestions();
    const userKey = String(userId);
    if (!suggestions[userKey]) suggestions[userKey] = {};

    let created = 0;
    let skipped = 0;

    clusters.forEach((cluster) => {
      const dedupKey = `${cluster.bookId}:${cluster.domainType}`;
      if (suggestions[userKey][dedupKey]) {
        skipped += 1;
        return;
      }

      const titlePreview = cluster.conceptTitles.join(', ');
      const moreCount = cluster.pointCount - cluster.conceptTitles.length;
      const previewWithSuffix =
        moreCount > 0 ? `${titlePreview}, +${moreCount} more` : titlePreview;

      try {
        const notification = createNotification(
          {
            type: NOTIFICATION_TYPES.PROGRESS,
            priority: NOTIFICATION_PRIORITIES.NORMAL,
            title: `Organize ${cluster.pointCount} new ${cluster.domainType} concepts`,
            message: `From "${cluster.bookTitle}": ${previewWithSuffix}. A MoodBoard can help these stick.`,
            actionUrl: `/moodBoard?organize=${encodeURIComponent(
              `${cluster.bookId}:${cluster.domainType}`,
            )}`,
            actionLabel: 'Open MoodBoard',
            persistent: false,
            dismissible: true,
          },
          effectiveToken,
        );

        suggestions[userKey][dedupKey] = {
          notificationId: notification?.id || null,
          pointIds: cluster.pointIds,
          pointCount: cluster.pointCount,
          createdAt: new Date().toISOString(),
        };
        created += 1;

        // Brain episode so analytics can compute suggest → accept
        // conversion (paired with ORGANIZE_ACCEPTED / ORGANIZE_DISMISSED
        // emitted by MoodBoardView on user response).
        if (this.episodeCollector) {
          try {
            this.episodeCollector.record({
              userId,
              eventType: 'ORGANIZE_SUGGESTED',
              payload: {
                dedupKey,
                bookId: cluster.bookId,
                bookTitle: cluster.bookTitle,
                domainType: cluster.domainType,
                pointCount: cluster.pointCount,
                notificationId: notification?.id || null,
              },
              sourceContext: { view: 'brain-heartbeat' },
            });
          } catch (_) {
            // best-effort
          }
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
          '[MoodBoardOrganizerService] createNotification failed:',
          err?.message || err,
        );
      }
    });

    this.writeSuggestions(suggestions);
    return { created, skipped, clusters };
  }

  /**
   * Fetch the persisted suggestion for a (userId, dedupKey) so the renderer
   * can render an organize banner without re-running cluster detection.
   * Re-runs the SQL detail query so concept titles reflect the current
   * learning_point state (titles may have been edited since the nudge fired).
   *
   * @param {number} userId
   * @param {string} dedupKey  — "bookId:domainType"
   * @returns {Object|null}
   */
  getSuggestion(userId, dedupKey) {
    const suggestions = this.readSuggestions();
    const record = suggestions[String(userId)]?.[dedupKey];
    if (!record) return null;

    const [bookIdStr, domainType] = dedupKey.split(':');
    const bookId = Number(bookIdStr);
    if (!bookId || !domainType) return null;

    const titleStmt = db.prepare(`
      SELECT id, title
      FROM learning_point
      WHERE user_id = ? AND book_id = ? AND domain_type = ? AND status = 'active'
      ORDER BY created_at DESC
    `);
    const points = titleStmt.all(userId, bookId, domainType);
    const bookRow = db
      .prepare(`SELECT name FROM book WHERE id = ?`)
      .get(bookId);

    return {
      dedupKey,
      bookId,
      bookTitle: bookRow ? bookRow.name : `Book #${bookId}`,
      domainType,
      pointIds: points.map((p) => p.id),
      conceptTitles: points.map((p) => p.title),
      pointCount: points.length,
      createdAt: record.createdAt,
    };
  }

  /**
   * Clear the dedup record for a (bookId, domainType) so the next heartbeat
   * can re-suggest. Intended for the renderer to call after the user has
   * organized the cluster (or explicitly asked "remind me again later").
   *
   * @param {number} userId
   * @param {number} bookId
   * @param {string} domainType
   * @returns {boolean}
   */
  clearSuggestion(userId, bookId, domainType) {
    const suggestions = this.readSuggestions();
    const userKey = String(userId);
    const dedupKey = `${bookId}:${domainType}`;
    if (!suggestions[userKey] || !suggestions[userKey][dedupKey]) return false;
    delete suggestions[userKey][dedupKey];
    this.writeSuggestions(suggestions);
    return true;
  }
}

module.exports = MoodBoardOrganizerService;
module.exports.default = MoodBoardOrganizerService;
