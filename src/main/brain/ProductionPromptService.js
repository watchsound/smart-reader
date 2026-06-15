/**
 * ProductionPromptService — Phase 8 production loop (Slice 1).
 *
 * Runs inside the Brain heartbeat. Picks ONE learning point the reader
 * has demonstrated recognition for (passed SRS, mastery ≥ 60) and asks
 * them to explain it in their own words via a notification. The actual
 * answer panel + grading is Slice 2 — for now the notification carries
 * `actionUrl: /knowledge?produce=<learningPointId>` and the front-end
 * builds the UI off that param.
 *
 * Why a separate loop from SRS:
 *   SRS asks "do you recognize the answer?" — recognition.
 *   Production asks "can you generate the explanation?" — much higher
 *   bar that catches passive knowledge dressed up as active.
 *
 * Candidate criteria (intentionally conservative):
 *   - status = 'active'
 *   - mastery_level >= 60  (passed the recognition threshold)
 *   - review_count >= 3    (we have data on it)
 *   - source_type IN ('book','note','chat')
 *   - back.text exists and is non-trivial (explanation worth eliciting)
 *   - not prompted in the dedup table within PRODUCTION_DEDUP_DAYS
 *
 * Pacing: at most 1 prompt per heartbeat per user. Production is
 * effortful — don't pile up. The dedup table is keyed by
 * (userId, learningPointId) and stored in electron-store under
 * `productionLoop.recentPrompts`.
 */

const {
  createNotification,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
} = require('../db/NotificationManager');
// Production candidate selection used to read raw FROM learning_point in
// SQLite. After the LearningPointService → graph migration, the SQLite
// table is no longer written to in production, so that path silently
// returned 0 candidates for any post-migration user. Now we fetch via
// the service (graph-backed) and filter in JS. N is small per user.
const learningPointService =
  require('../utils/LearningPointService').default ||
  require('../utils/LearningPointService');

const STORE_KEY = 'productionLoop.recentPrompts';
const PRODUCTION_DEDUP_DAYS = 21;
const MIN_MASTERY = 60;
const MIN_REVIEWS = 3;
const MIN_BACK_TEXT_CHARS = 30;
const MAX_PROMPTS_PER_HEARTBEAT = 1;

function getActiveSessionToken() {
  const sessionInfo = global?.shared?.store?.get?.('session_info');
  return sessionInfo?.token || null;
}

// When sourceType === 'book', the graph stores sourceId as the
// stringified bookId. Phase 8 services consume `bookId` directly, so
// project it out here.
function deriveBookId(item) {
  if (!item || item.sourceType !== 'book') return null;
  const n = Number(item.sourceId);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick eligible learning points ordered so the BEST production candidate
 * comes first. Best = highest mastery (so we test passive-vs-active gap
 * on the strongest material) with newest last_reviewed_at as a tiebreak
 * (recency = still warm enough that a failed explanation is real, not
 * just forgotten).
 *
 * `back` is JSON; we only need to know it has substantive text. We
 * parse on the client side rather than in SQL so we don't depend on
 * SQLite JSON functions being available.
 */
async function queryCandidates(_userId, token, limit = 5) {
  // graphInterface.getAllLearningPoints filters to active (validTo IS NULL)
  // already, scoped to the token's userId. We pull a big page and filter
  // the rest in JS — a heartbeat user has at most a few hundred active
  // points and the heartbeat runs minutes apart.
  const result = await learningPointService.getAll(token, { pageSize: 5000 });
  const items = Array.isArray(result?.items) ? result.items : [];
  const eligible = items.filter(
    (it) =>
      it &&
      typeof it.masteryLevel === 'number' &&
      it.masteryLevel >= MIN_MASTERY &&
      typeof it.reviewCount === 'number' &&
      it.reviewCount >= MIN_REVIEWS &&
      (it.sourceType === 'book' ||
        it.sourceType === 'note' ||
        it.sourceType === 'chat'),
  );
  // Same ORDER BY: mastery DESC, lastReviewedAt DESC.
  eligible.sort((a, b) => {
    if (b.masteryLevel !== a.masteryLevel) {
      return b.masteryLevel - a.masteryLevel;
    }
    const aT = a.lastReviewedAt ? Date.parse(a.lastReviewedAt) : 0;
    const bT = b.lastReviewedAt ? Date.parse(b.lastReviewedAt) : 0;
    return bT - aT;
  });
  // Match the old `LIMIT ?*4` overscan — the dedup filter further down
  // may drop entries, so we want a buffer.
  return eligible.slice(0, limit * 4).map((it) => ({
    id: it.id,
    title: it.title,
    back: it.back,
    masteryLevel: it.masteryLevel,
    reviewCount: it.reviewCount,
    lastReviewedAt: it.lastReviewedAt,
    sourceType: it.sourceType,
    bookId: deriveBookId(it),
    domainType: it.domainType,
  }));
}

function backHasSubstantiveText(backJson) {
  if (!backJson) return false;
  try {
    const parsed =
      typeof backJson === 'string' ? JSON.parse(backJson) : backJson;
    const text = (parsed?.text || '').trim();
    return text.length >= MIN_BACK_TEXT_CHARS;
  } catch (_) {
    // Treat malformed JSON as a plain string and length-check it.
    return (
      typeof backJson === 'string' && backJson.length >= MIN_BACK_TEXT_CHARS
    );
  }
}

class ProductionPromptService {
  constructor(services = {}) {
    this.store = services.store || null;
    this.episodeCollector = services.episodeCollector || null;
    // Brain-driven shell: surface production prompts via the Orb in
    // addition to the existing notification. Optional.
    this.triggerEmitter = services.triggerEmitter || null;
  }

  readDedup() {
    if (!this.store) return {};
    const raw = this.store.get(STORE_KEY, {});
    return raw && typeof raw === 'object' ? raw : {};
  }

  writeDedup(map) {
    if (this.store) this.store.set(STORE_KEY, map);
  }

  /**
   * Return up to `limit` eligible learning points that aren't currently
   * deduplicated. Pure read — never writes the dedup table.
   *
   * @param {number} userId
   * @param {number} [limit]
   * @returns {Array}
   */
  async selectCandidates(userId, token, limit = MAX_PROMPTS_PER_HEARTBEAT) {
    const dedup = this.readDedup();
    const userKey = String(userId);
    const userDedup = dedup[userKey] || {};
    const cutoff = Date.now() - PRODUCTION_DEDUP_DAYS * 86400000;

    const rows = await queryCandidates(userId, token, limit);
    const eligible = [];
    rows.forEach((row) => {
      if (eligible.length >= limit) return;
      if (!backHasSubstantiveText(row.back)) return;
      const dedupAt = userDedup[row.id]?.promptedAt;
      if (dedupAt && new Date(dedupAt).getTime() > cutoff) return;
      eligible.push(row);
    });
    return eligible;
  }

  /**
   * Pick the top eligible candidate and emit a "explain in your own
   * words" notification. Records the dedup entry on success so the
   * same point isn't asked again for PRODUCTION_DEDUP_DAYS.
   *
   * @param {number} userId
   * @param {string} token
   * @returns {{ created: number, skipped: number, candidates: Array, reason?: string }}
   */
  async schedulePrompt(userId, token) {
    const effectiveToken = getActiveSessionToken() || token;
    if (!effectiveToken) {
      return { created: 0, skipped: 0, candidates: [], reason: 'no session' };
    }

    const candidates = await this.selectCandidates(
      userId,
      effectiveToken,
      MAX_PROMPTS_PER_HEARTBEAT,
    );
    if (candidates.length === 0) {
      return {
        created: 0,
        skipped: 0,
        candidates: [],
        reason: 'no candidates',
      };
    }

    const dedup = this.readDedup();
    const userKey = String(userId);
    if (!dedup[userKey]) dedup[userKey] = {};

    let created = 0;
    candidates.forEach((candidate) => {
      try {
        const notification = createNotification(
          {
            type: NOTIFICATION_TYPES.PROGRESS,
            priority: NOTIFICATION_PRIORITIES.NORMAL,
            title: `Explain "${candidate.title}" in your own words`,
            message:
              `You've passed recognition on this. Can you produce the ` +
              `explanation cold? A 2-minute check tells us if it's really stuck.`,
            actionUrl: `/knowledge?produce=${encodeURIComponent(candidate.id)}`,
            actionLabel: 'Try it',
            persistent: false,
            dismissible: true,
          },
          effectiveToken,
        );

        dedup[userKey][candidate.id] = {
          notificationId: notification?.id || null,
          promptedAt: new Date().toISOString(),
          masteryAtPrompt: candidate.masteryLevel,
        };
        created += 1;

        // Brain-driven shell: also surface via the Orb.
        if (this.triggerEmitter) {
          this.triggerEmitter.emit({
            id: `phase8c:${candidate.id}`,
            source: 'phase-8c-production',
            unit: 'atomic-chip',
            surfaceTarget: { kind: 'global' },
            priority: 'normal',
            freshness: 2 * 24 * 60 * 60 * 1000, // 2 days
            payload: {
              title: `Explain "${candidate.title}" cold`,
              body:
                'You passed recognition. A 2-minute production check ' +
                'tells us if the explanation is really stuck.',
              actions: [
                {
                  label: 'Try it',
                  navigate: `knowledge?produce=${encodeURIComponent(candidate.id)}`,
                  primary: true,
                },
              ],
              learningPointId: candidate.id,
              masteryLevel: candidate.masteryLevel,
            },
          });
        }

        // Brain episode so analytics can compute prompt → submit conversion.
        if (this.episodeCollector) {
          try {
            this.episodeCollector.record({
              userId,
              eventType: 'PRODUCTION_PROMPTED',
              payload: {
                learningPointId: candidate.id,
                title: candidate.title,
                masteryLevel: candidate.masteryLevel,
                reviewCount: candidate.reviewCount,
                sourceType: candidate.sourceType,
                bookId: candidate.bookId,
                domainType: candidate.domainType,
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
          '[ProductionPromptService] createNotification failed:',
          err?.message || err,
        );
      }
    });

    this.writeDedup(dedup);
    return { created, skipped: candidates.length - created, candidates };
  }

  /**
   * Clear the dedup record for a learning point so the next heartbeat
   * can re-prompt. Intended for the renderer to call after the user
   * has actually answered the production prompt (so we can re-test on
   * the next cycle if mastery decays) or after they explicitly skip.
   *
   * @param {number} userId
   * @param {string} learningPointId
   * @returns {boolean}
   */
  clearPrompt(userId, learningPointId) {
    const dedup = this.readDedup();
    const userKey = String(userId);
    if (!dedup[userKey] || !dedup[userKey][learningPointId]) return false;
    delete dedup[userKey][learningPointId];
    this.writeDedup(dedup);
    return true;
  }
}

module.exports = ProductionPromptService;
module.exports.default = ProductionPromptService;
