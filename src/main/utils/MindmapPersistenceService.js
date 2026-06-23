/**
 * MindmapPersistenceService — persists mindmap nodes as learning points and
 * maintains the (mindmap_id, node_id) -> lp_id link table that backs reopen
 * hydration and idempotent re-save.
 *
 * Why a service + link table (not just sourceId='m1' on learning_point):
 *   - reopen needs O(1) node->lp lookup; without the link table we'd have
 *     to fetch every LP with sourceType='mindmap' & sourceId=mindmapId, then
 *     match by node-id heuristics (title? extras?). The link table makes the
 *     mapping explicit and stable across LP title edits.
 *   - re-save idempotency: same nodes saved twice MUST NOT create duplicate
 *     LPs. The link table is the dedup index.
 *
 * Contract with learningPointService.createLearningPointsBatch:
 *   The plan's reference template assumed the batch call returns `{ ids }`.
 *   In this codebase that is NOT guaranteed — graphInterface's SQLite path
 *   returns `{ created: 0, errors: [...] }` (the adapter lacks the method;
 *   the legacy LearningPointManager.createLearningPointsBatch returns no
 *   ids either). So we ALWAYS fall back to getBySource after the batch
 *   insert to recover ids, then match created LPs back to the input nodes
 *   by deterministic order (the batch was inserted in `toCreate` order, so
 *   the N most-recent mindmap LPs for this mindmapId are ours).
 */

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

    const points = toCreate.map((n) => ({
      front: n.data.text,
      back: n.data.detail || n.data.sourcePhrase || n.data.text,
      itemType: 'card',
      domainType: coerceDomain(n.data.domain),
      sourceType: 'mindmap',
      sourceId: mindmapId,
      tags: bookId ? [`book:${bookId}`] : [],
    }));

    const batchResult = await this.lps.createLearningPointsBatch(points, token);

    // Recover the created ids. Preferred path: batch returned them
    // explicitly (mock-driven test; future when GraphInterface impl lands).
    // Fallback path: getBySource('mindmap', mindmapId) and take the rows
    // matching this batch by insertion order. The fallback is what
    // production currently needs — see service-level comment.
    let createdIds = Array.isArray(batchResult?.ids) ? batchResult.ids : null;
    if (!createdIds || createdIds.length !== toCreate.length) {
      const fromSource = await this.lps.getBySource(
        'mindmap',
        mindmapId,
        token,
      );
      // getBySource is expected to return newest-first or insertion-order
      // dependent on adapter; rather than guess, take ALL rows for this
      // mindmapId that are not already linked, and assume their order
      // matches toCreate. If counts disagree we still write what we can.
      const linkedSet = new Set(existingByNode.values());
      const unlinked = (fromSource || [])
        .map((lp) => lp.id)
        .filter((id) => id && !linkedSet.has(id));
      createdIds = unlinked.slice(0, toCreate.length);
    }

    const insert = this.db.prepare(
      `INSERT INTO mindmap_node_lp_link (mindmap_id, node_id, lp_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    const now = Date.now();
    const linkTx = this.db.transaction((rows) => {
      rows.forEach((r) => insert.run(r.mindmap_id, r.node_id, r.lp_id, now));
    });

    const linkRows = [];
    for (let i = 0; i < toCreate.length; i += 1) {
      const lpId = createdIds[i];
      if (lpId) {
        linkRows.push({
          mindmap_id: mindmapId,
          node_id: toCreate[i].id,
          lp_id: lpId,
        });
      }
    }
    if (linkRows.length > 0) linkTx(linkRows);

    const allLpIds = nodes.map(
      (n) =>
        existingByNode.get(n.id) || createdIds[toCreate.indexOf(n)] || null,
    );

    return {
      lpIds: allLpIds,
      created: linkRows.length,
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
