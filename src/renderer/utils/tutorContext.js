/**
 * tutorContext — assembles the data blocks injected into Tutor Mode chats.
 *
 * The chat already sees the page (articleStr, curBook, selectedText). Tutor
 * mode adds three blocks that describe the *learner*, so the chat stops being
 * a smart search and starts being a teacher who remembers you:
 *
 *   <LEARNER>          — global + domain profile from brainApi
 *   <KNOWLEDGE>        — weak concepts + recent mastery from graphApi/brainApi
 *   <RECENT_ACTIVITY>  — last-7-days episode summary
 *
 * The context is cached per-book/chapter so we don't re-fetch on every chat
 * turn within the same session. The cached prefix is the perfect target for
 * a future prompt-caching polyfill / native cache.
 *
 * Phase 9 alignment: this is the renderer-side companion to the spine
 * `tutor-context` Intent (see `src/main/brain/spine/seedIntents.js`).
 * When Director Mode (Phase 10) lands, this file's slice catalog should
 * be derived from `intents.resolve('tutor-context').contextSlices`
 * rather than duplicated here.
 */

import brainApi from '../api/brainApi';
import graphApi from '../api/graphApi';

const RECENT_EPISODE_LIMIT = 40;
const WEAK_CONCEPT_LIMIT = 8;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes — profile rarely shifts inside a study session

const cache = new Map();

function cacheKeyFor(bookId, chapterId) {
  return `${bookId || 'no-book'}::${chapterId || 'no-chapter'}`;
}

function isFresh(entry) {
  return entry && Date.now() - entry.builtAt < CACHE_TTL_MS;
}

function formatLearnerBlock(profile) {
  if (!profile) return null;
  const global = profile.global || profile;
  if (!global) return null;
  const lines = [];
  if (global.learningStyle)
    lines.push(`Learning style: ${global.learningStyle}`);
  if (global.preferredTimeOfDay)
    lines.push(`Preferred study time: ${global.preferredTimeOfDay}`);
  if (typeof global.optimalSessionLength === 'number')
    lines.push(
      `Typical session length: ${global.optimalSessionLength} minutes`,
    );
  if (global.pacePreference) lines.push(`Pace: ${global.pacePreference}`);
  if (typeof global.consistencyScore === 'number')
    lines.push(`Consistency score: ${global.consistencyScore}/100`);
  if (Array.isArray(global.aiInsights) && global.aiInsights.length) {
    lines.push('Recent AI-derived insights:');
    global.aiInsights.slice(0, 3).forEach((insight) => {
      lines.push(`  - ${insight}`);
    });
  }
  return lines.length ? lines.join('\n') : null;
}

function formatKnowledgeBlock(weakConcepts, mastery) {
  const lines = [];
  if (Array.isArray(weakConcepts) && weakConcepts.length) {
    lines.push('Concepts the learner is currently weak on:');
    weakConcepts.slice(0, WEAK_CONCEPT_LIMIT).forEach((c) => {
      const name = c.name || c.conceptName || c.label || c.id;
      const score = c.masteryScore ?? c.mastery ?? c.score;
      const scoreStr =
        typeof score === 'number'
          ? ` (mastery ${Math.round(score * 100) / 100})`
          : '';
      lines.push(`  - ${name}${scoreStr}`);
    });
  }
  if (mastery && (mastery.improvedCount || mastery.totalConcepts)) {
    lines.push(
      `Mastery progress (last 30 days): ` +
        `${mastery.improvedCount ?? '?'} improved out of ${mastery.totalConcepts ?? '?'} tracked concepts.`,
    );
  }
  return lines.length ? lines.join('\n') : null;
}

function formatRecentActivityBlock(episodes) {
  if (!Array.isArray(episodes) || episodes.length === 0) return null;
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = episodes.filter((e) => {
    const t = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    return t >= cutoff;
  });
  if (recent.length === 0) return null;

  const byType = {};
  let reviewsCorrect = 0;
  let reviewsTotal = 0;
  const struggledConcepts = new Set();

  recent.forEach((e) => {
    const t = e.eventType || 'UNKNOWN';
    byType[t] = (byType[t] || 0) + 1;
    if (t === 'REVIEW_COMPLETED') {
      reviewsTotal += 1;
      const rating = e.payload?.rating;
      if (rating && rating >= 3) reviewsCorrect += 1;
      if (rating && rating <= 2) {
        const name = e.payload?.conceptName;
        if (name) struggledConcepts.add(name);
      }
    }
  });

  const lines = [];
  lines.push(`Activity in the last 7 days: ${recent.length} learning events.`);
  if (reviewsTotal > 0) {
    const pct = Math.round((reviewsCorrect / reviewsTotal) * 100);
    lines.push(`Reviews: ${reviewsCorrect}/${reviewsTotal} correct (${pct}%).`);
  }
  if (struggledConcepts.size > 0) {
    lines.push(
      `Recently struggled with: ${[...struggledConcepts].slice(0, 5).join(', ')}.`,
    );
  }
  return lines.join('\n');
}

/**
 * Build the three context blocks for tutor mode. Falls back gracefully if
 * the Brain or graph backend isn't available — missing blocks become null,
 * the caller composes only what's present.
 *
 * @param {Object} args
 * @param {string|number} args.bookId — optional, scopes the cache
 * @param {string} args.chapterId — optional, scopes the cache
 * @param {string} args.token — optional auth token
 * @param {boolean} [args.force=false] — bypass cache
 * @returns {Promise<{ learner: ?string, knowledge: ?string, recent: ?string, builtAt: number }>}
 */
export async function buildTutorContext({
  bookId,
  chapterId,
  token,
  force = false,
} = {}) {
  const key = cacheKeyFor(bookId, chapterId);
  if (!force) {
    const cached = cache.get(key);
    if (isFresh(cached)) return cached;
  }

  // Fetch in parallel; each call is best-effort. Missing methods or failed
  // backends produce null entries rather than throwing the whole assembly.
  const safe = (fn) => {
    try {
      const p = fn();
      return p && typeof p.then === 'function'
        ? p.catch(() => null)
        : Promise.resolve(p);
    } catch (_) {
      return Promise.resolve(null);
    }
  };
  const [profile, weakConcepts, mastery, episodes] = await Promise.all([
    safe(() => brainApi.getLearnerProfile?.(token)),
    safe(() => graphApi.detectWeakConcepts?.(WEAK_CONCEPT_LIMIT, token)),
    safe(() => graphApi.getMasteryProgress?.(30, token)),
    safe(() => brainApi.getEpisodes?.({ limit: RECENT_EPISODE_LIMIT })),
  ]);

  const entry = {
    learner: formatLearnerBlock(profile),
    knowledge: formatKnowledgeBlock(weakConcepts, mastery),
    recent: formatRecentActivityBlock(episodes),
    builtAt: Date.now(),
  };
  cache.set(key, entry);
  return entry;
}

/**
 * Compose the assembled blocks into a single string for prompt injection.
 * Returns '' if no blocks are populated (caller can skip tutor-mode prefix).
 */
export function composeTutorContextString(ctx) {
  if (!ctx) return '';
  const parts = [];
  if (ctx.learner) parts.push(`<LEARNER>\n${ctx.learner}\n</LEARNER>`);
  if (ctx.knowledge) parts.push(`<KNOWLEDGE>\n${ctx.knowledge}\n</KNOWLEDGE>`);
  if (ctx.recent)
    parts.push(`<RECENT_ACTIVITY>\n${ctx.recent}\n</RECENT_ACTIVITY>`);
  return parts.join('\n\n');
}

/**
 * Clear cache — call when learner profile is known to have changed (e.g.,
 * after a Brain consolidation run or a manual profile update).
 */
export function invalidateTutorContext() {
  cache.clear();
}
