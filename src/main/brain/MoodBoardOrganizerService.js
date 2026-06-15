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
const { createNote } = require('../db/NoteJsonManager');
const { createMoodBoard } = require('../db/MoodBoardJsonManager');
const { NoteType } = require('../../commons/model/Note');
// Cluster detection used to read raw FROM learning_point in SQLite. After
// the LearningPointService → graph migration, the SQLite table is no
// longer written to in production. We now fetch via the service
// (graph-backed) and group in JS. SQLite is still used for the SECONDARY
// reads (book name lookup) and for the slice-3 note/board creation
// transaction — those tables remain SQLite-owned.
const learningPointService =
  require('../utils/LearningPointService').default ||
  require('../utils/LearningPointService');

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

// When sourceType === 'book', the graph stores sourceId as the
// stringified bookId.
function deriveBookId(item) {
  if (!item || item.sourceType !== 'book') return null;
  const n = Number(item.sourceId);
  return Number.isFinite(n) ? n : null;
}

function lookupBookTitle(bookId) {
  if (!bookId) return null;
  try {
    const row = db.prepare(`SELECT name FROM book WHERE id = ?`).get(bookId);
    return row ? row.name : null;
  } catch (_) {
    return null;
  }
}

async function fetchUserActivePoints(token) {
  const result = await learningPointService.getAll(token, { pageSize: 5000 });
  return Array.isArray(result?.items) ? result.items : [];
}

/**
 * Module-level so it can be stubbed in tests; doesn't need `this`.
 * Returns clusters matching the (book, domain, recency, size) criteria.
 */
async function queryClusters(_userId, token, options = {}) {
  const days = options.days || DEFAULT_DAYS;
  const minClusterSize = options.minClusterSize || DEFAULT_MIN_CLUSTER;
  const sinceMs = Date.now() - days * 86400000;
  const sinceIso = new Date(sinceMs).toISOString();

  const items = await fetchUserActivePoints(token);

  // Filter: has bookId (sourceType === 'book'), createdAt within window.
  const inWindow = items.filter((it) => {
    if (!it) return false;
    const bid = deriveBookId(it);
    if (!bid) return false;
    const created = it.createdAt ? Date.parse(it.createdAt) : 0;
    return created >= sinceMs;
  });

  // Group by (bookId, domainType).
  const groups = new Map(); // key → { bookId, domainType, points: [] }
  inWindow.forEach((it) => {
    const bid = deriveBookId(it);
    const dom = it.domainType || 'knowledge';
    const key = `${bid}::${dom}`;
    if (!groups.has(key)) {
      groups.set(key, { bookId: bid, domainType: dom, points: [] });
    }
    groups.get(key).points.push(it);
  });

  const clusters = [];
  groups.forEach((g) => {
    if (g.points.length < minClusterSize) return;
    // Sort by createdAt DESC for preview titles.
    g.points.sort(
      (a, b) =>
        (b.createdAt ? Date.parse(b.createdAt) : 0) -
        (a.createdAt ? Date.parse(a.createdAt) : 0),
    );
    const dates = g.points.map((p) =>
      p.createdAt ? Date.parse(p.createdAt) : 0,
    );
    clusters.push({
      bookId: g.bookId,
      bookTitle: lookupBookTitle(g.bookId) || `Book #${g.bookId}`,
      domainType: g.domainType,
      pointIds: g.points.map((p) => p.id),
      conceptTitles: g.points.slice(0, MAX_TITLES_PREVIEW).map((p) => p.title),
      pointCount: g.points.length,
      oldestAt: new Date(Math.min(...dates)).toISOString(),
      newestAt: new Date(Math.max(...dates)).toISOString(),
      // sinceIso retained for backward compat with callers that logged it
      _sinceIso: sinceIso,
    });
  });

  return clusters;
}

class MoodBoardOrganizerService {
  constructor(services = {}) {
    this.store = services.store || null;
    this.episodeCollector = services.episodeCollector || null;
    // Brain-driven shell: emit an atomic-chip Trigger alongside the
    // existing notification so the Orb surfaces organize suggestions
    // cross-surface. Optional — handler-context instances don't need it.
    this.triggerEmitter = services.triggerEmitter || null;
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
  async detectClusters(userId, token, options = {}) {
    return queryClusters(userId, token, options);
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
  async suggestOrganize(userId, token, options = {}) {
    // Heartbeat token is synthetic — resolve the real session token so the
    // notification gets the correct user_id. If nobody is signed in, skip.
    const effectiveToken = getActiveSessionToken() || token;
    if (!effectiveToken) {
      return { created: 0, skipped: 0, clusters: [], reason: 'no session' };
    }

    const clusters = await this.detectClusters(userId, effectiveToken, options);
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

        // Brain-driven shell: surface the same suggestion via the Orb.
        if (this.triggerEmitter) {
          this.triggerEmitter.emit({
            id: `phase8b:${cluster.bookId}:${cluster.domainType}`,
            source: 'phase-8b-organize',
            unit: 'atomic-chip',
            surfaceTarget: { kind: 'global' },
            priority: 'normal',
            freshness: 3 * 24 * 60 * 60 * 1000, // 3 days
            payload: {
              title: `Organize ${cluster.pointCount} ${cluster.domainType} concepts`,
              body: `From "${cluster.bookTitle}": ${previewWithSuffix}`,
              actions: [
                {
                  label: 'Open MoodBoard',
                  navigate: `moodBoard?organize=${encodeURIComponent(dedupKey)}`,
                  primary: true,
                },
              ],
              dedupKey,
              bookId: cluster.bookId,
              domainType: cluster.domainType,
            },
          });
        }

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
  async getSuggestion(userId, dedupKey, token) {
    const suggestions = this.readSuggestions();
    const record = suggestions[String(userId)]?.[dedupKey];
    if (!record) return null;

    const [bookIdStr, domainType] = dedupKey.split(':');
    const bookId = Number(bookIdStr);
    if (!bookId || !domainType) return null;

    const effectiveToken = getActiveSessionToken() || token;
    if (!effectiveToken) return null;

    const items = await fetchUserActivePoints(effectiveToken);
    const points = items
      .filter(
        (it) =>
          deriveBookId(it) === bookId &&
          (it.domainType || 'knowledge') === domainType,
      )
      .sort(
        (a, b) =>
          (b.createdAt ? Date.parse(b.createdAt) : 0) -
          (a.createdAt ? Date.parse(a.createdAt) : 0),
      );

    return {
      dedupKey,
      bookId,
      bookTitle: lookupBookTitle(bookId) || `Book #${bookId}`,
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

  /**
   * Phase 8 Slice 3 — create a MoodBoard pre-populated with notes derived
   * from the cluster's learning points. Replaces the renderer's previous
   * "empty board with description" flow.
   *
   * For each active learning point in (book, domain), creates a note whose
   * `content` is the front/back rendered as markdown, then assembles a
   * gridLayout with one tile per note. Clears the dedup record so the
   * organize banner stops surfacing. Emits ORGANIZE_BOARD_CREATED so
   * analytics can distinguish "accepted-but-empty" from
   * "accepted-and-populated".
   *
   * Wrapped in a single SQLite transaction so a partial failure (note
   * created, board create throws) doesn't leave orphan notes.
   *
   * @param {number} userId
   * @param {number} bookId
   * @param {string} domainType
   * @param {string} token  — real session token (NOT the heartbeat synthetic)
   * @returns {{ board: Object, noteIds: Array<number> } | { error: string }}
   */
  async createBoardFromCluster(userId, bookId, domainType, token) {
    if (!token) return { error: 'No session token.' };

    // Re-query for fresh title/front/back via the graph backend (the
    // SQLite learning_point table is no longer populated). We still use
    // SQLite for the note/board creation transaction below — those
    // tables are SQLite-owned.
    const items = await fetchUserActivePoints(token);
    const points = items
      .filter(
        (it) =>
          deriveBookId(it) === bookId &&
          (it.domainType || 'knowledge') === domainType,
      )
      .sort(
        (a, b) =>
          (b.createdAt ? Date.parse(b.createdAt) : 0) -
          (a.createdAt ? Date.parse(a.createdAt) : 0),
      );

    if (points.length === 0) {
      return { error: 'No active learning points found for this cluster.' };
    }

    const bookTitle = lookupBookTitle(bookId) || `Book #${bookId}`;
    const prettyDomain = domainType
      ? domainType.charAt(0).toUpperCase() + domainType.slice(1)
      : 'Knowledge';

    // Transaction: notes + board creation must succeed or fail together.
    // better-sqlite3's transaction() returns a wrapper we invoke synchronously.
    const run = db.transaction(() => {
      const noteIds = [];
      points.forEach((lp) => {
        const noteContent = buildNoteContent(lp);
        const note = createNote(
          {
            sourceType: NoteType.LearningPoint,
            sourceKey: lp.id,
            content: noteContent,
            imageData: '',
            cfi: '',
            url: '',
            emoji: '🧠',
            color: '#673ab7',
            highlightType: 'concept',
          },
          token,
        );
        if (note && note.id) noteIds.push(note.id);
      });

      if (noteIds.length === 0) {
        throw new Error('Failed to create any notes for the cluster.');
      }

      // Lay out 2-wide tiles in a grid: x in {0,2,4,6,8,10}, y stepped.
      const COLS_PER_ROW = 6;
      const TILE_W = 2;
      const TILE_H = 4;
      // Match the existing addNewNote convention: `i` is the integer
      // rowid, NOT a string. SQLite coerces either way, but boards added
      // through the existing renderer path use integers and downstream
      // strict-equality checks (selectedNote.id === N) need uniform typing.
      const layoutItems = noteIds.map((noteId, idx) => ({
        x: (idx % COLS_PER_ROW) * TILE_W,
        y: Math.floor(idx / COLS_PER_ROW) * TILE_H,
        w: TILE_W,
        h: TILE_H,
        i: noteId,
      }));

      const board = createMoodBoard(
        {
          name: `${prettyDomain} from ${bookTitle}`,
          description: `Brain-suggested cluster of ${
            points.length
          } ${domainType} concepts from "${bookTitle}".`,
          gridLayout: { layout: { lg: layoutItems } },
          diagram: {},
          pinned: false,
        },
        token,
      );

      if (!board || !board.id) {
        throw new Error('createMoodBoard returned no id.');
      }

      return { board, noteIds };
    });

    let result;
    try {
      result = run();
    } catch (err) {
      return { error: err?.message || 'Failed to create board from cluster.' };
    }

    // Clear dedup AFTER the transaction commits — if the board create
    // rolled back, we want the suggestion to remain so the user can retry.
    // Renderer emits ORGANIZE_ACCEPTED with the noteCount from the returned
    // result, so we don't double-fire an analytics event here.
    this.clearSuggestion(userId, bookId, domainType);

    return result;
  }
}

/**
 * Build the note `content` string from a learning point. The back field
 * is JSON ({ text } or { text, examples }); fall back to the raw string
 * if it isn't valid JSON (older rows). Front is included as a question
 * line so the note is self-contained on the MoodBoard.
 */
function extractText(field) {
  if (!field) return '';
  // SQLite path returned a JSON string; graph backend returns an
  // already-parsed object (front/back are {text, html?, …}). Tolerate
  // both.
  if (typeof field === 'object') {
    return typeof field.text === 'string' ? field.text : '';
  }
  if (typeof field !== 'string') return String(field);
  try {
    const parsed = JSON.parse(field);
    return typeof parsed?.text === 'string' ? parsed.text : field;
  } catch (_) {
    return field;
  }
}

function buildNoteContent(lp) {
  const backText = extractText(lp.back);
  const front = extractText(lp.front).trim();
  const title = (lp.title || '').trim();
  return [`# ${title}`, front ? `*${front}*` : '', '', backText.trim()]
    .filter((s) => s !== '')
    .join('\n');
}

module.exports = MoodBoardOrganizerService;
module.exports.default = MoodBoardOrganizerService;
