/**
 * MindmapPersistenceService — persists mindmap nodes as learning points and
 * maintains the (mindmap_id, node_id) -> lp_id link table that backs reopen
 * hydration and idempotent re-save.
 *
 * Why a service + link table (not just sourceId='m1' on learning_point):
 *   - reopen needs O(1) node->lp lookup; without the link table we'd have
 *     to fetch every LP with sourceType='mindmap' & sourceId=mindmapId, then
 *     match by node-id heuristics. The link table makes the mapping
 *     explicit and stable across LP title edits.
 *   - re-save idempotency: same nodes saved twice MUST NOT create duplicate
 *     LPs. The link table is the dedup index.
 *
 * Why we pre-generate UUIDs and inject them as `point.id`:
 *   `LearningPointManager.createLearningPointsBatch` returns `{ created, errors }`
 *   with no `ids` array; it accepts `point.id` and uses it verbatim when present
 *   (LearningPointManager.js:380 — `point.id || uuidv4()`). Pre-generating ids
 *   client-side lets us write link rows without a fallback round-trip.
 *   (Investigation 2026-06-23: LearningPointService.createLearningPointsBatch
 *   silently no-ops on the SQLite adapter — SqliteAdapter lacks the method —
 *   so mindmapIpc injects LearningPointManager directly, whose function exports
 *   match the same interface but write to SQLite reliably.)
 */

const { randomUUID } = require('crypto');

const LIVE_WRITABLE_DOMAINS = [
  'vocabulary',
  'knowledge',
  'math',
  'reading',
  'language',
  'skill',
];

function coerceDomain(d) {
  if (d && LIVE_WRITABLE_DOMAINS.includes(d)) return d;
  return 'knowledge';
}

class MindmapPersistenceService {
  constructor({ db, learningPointService }) {
    this.db = db;
    this.lps = learningPointService;
  }

  async saveAsLearningPoints({ mindmapId, bookId, nodes, token }) {
    if (!nodes || nodes.length === 0) {
      return { lpIds: [], created: 0, linked: 0 };
    }

    const existing = this.db
      .prepare(
        'SELECT node_id, lp_id FROM mindmap_node_lp_link WHERE mindmap_id = ?',
      )
      .all(mindmapId);
    const existingByNode = new Map(existing.map((r) => [r.node_id, r.lp_id]));

    const toCreate = nodes.filter((n) => !existingByNode.has(n.id));

    if (toCreate.length === 0) {
      return {
        lpIds: nodes.map((n) => existingByNode.get(n.id)).filter(Boolean),
        created: 0,
        linked: 0,
      };
    }

    // Pre-generate ids so we don't depend on the batch call returning them.
    const newIds = toCreate.map(() => randomUUID());

    const points = toCreate.map((n, i) => ({
      id: newIds[i],
      title: n.data.text,
      front: n.data.text,
      back: n.data.detail || n.data.sourcePhrase || n.data.text,
      itemType: 'card',
      domainType: coerceDomain(n.data.domain),
      sourceType: 'mindmap',
      sourceId: mindmapId,
      bookId: bookId || null,
    }));

    const batchResult = await this.lps.createLearningPointsBatch(points, token);
    if (batchResult?.error) {
      return {
        lpIds: [],
        created: 0,
        linked: 0,
        error: batchResult.error,
      };
    }

    const insert = this.db.prepare(
      `INSERT INTO mindmap_node_lp_link (mindmap_id, node_id, lp_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    const linkTx = this.db.transaction((rows) => {
      rows.forEach((r) => insert.run(r.mindmap_id, r.node_id, r.lp_id, now));
    });

    const linkRows = toCreate.map((n, i) => ({
      mindmap_id: mindmapId,
      node_id: n.id,
      lp_id: newIds[i],
    }));
    if (linkRows.length > 0) linkTx(linkRows);

    const newIdByNodeId = new Map(toCreate.map((n, i) => [n.id, newIds[i]]));
    const allLpIds = nodes.map(
      (n) => existingByNode.get(n.id) || newIdByNodeId.get(n.id) || null,
    );

    return {
      lpIds: allLpIds,
      created: batchResult?.created ?? newIds.length,
      linked: linkRows.length,
    };
  }

  async getMasterySnapshot(lpIds, token) {
    if (!lpIds || lpIds.length === 0) return {};
    // Parallelize the per-id LP fetches. The repo's eslint config disallows
    // for-of + await-in-loop (no-restricted-syntax + no-await-in-loop), and
    // sequential fetches give us nothing here — each LP lookup is independent.
    const ids = lpIds.filter((id) => Boolean(id));
    const lps = await Promise.all(
      ids.map((id) => this.lps.getLearningPointById(id, token)),
    );
    const out = {};
    ids.forEach((id, i) => {
      const lp = lps[i];
      if (lp && typeof lp.masteryLevel === 'number') {
        out[id] = lp.masteryLevel;
      }
    });
    return out;
  }
}

module.exports = MindmapPersistenceService;
