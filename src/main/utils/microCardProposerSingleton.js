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
 *   Stores the accepted draft as a learning_point row via the proposer.
 *   In Phase 4 the renderer sends the accepted draft after user confirms;
 *   here we expose the same path for the Director's auto-accept flow.
 *   Returns { id } where id is the proposalId (used as the undo handle).
 *
 * delete(id) → boolean
 *   Removes a previously committed card. The underlying implementation
 *   is thin for Phase 10b-1 (stub that returns true); full DB DELETE
 *   will be wired in Phase 10b-3 when the Director can access the DB
 *   manager directly.
 */

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
 * Commit (accept) a micro-card draft. The Director has already decided
 * this paragraph warrants a card; this writes it to the store.
 *
 * @param {{ userId: number, paragraphHash: string, draft: object, domain: string }} args
 * @returns {{ id: string }}
 */
function commit({ userId, paragraphHash, draft, domain }) {
  // Phase 10b-1: MicroCardProposer.proposeFromParagraph is the LLM path;
  // direct commit of an already-drafted card is not yet wired to the DB
  // writer (that lives in the acceptProposal IPC handler, which needs the
  // full Electron context). We record the commit in the proposer's
  // chapter-state so dedup gates stay consistent, and return a stable id
  // derived from the hash so the undo registry can reference it.
  //
  // Full implementation (writing learning_point row) tracked as a
  // Discovered Issue — non-trivial without DB manager access here.
  const proposer = getInstance();
  // Touch chapter state so the hash is recorded (side-effect only).
  if (typeof proposer.getChapterState === 'function') {
    const state = proposer.getChapterState(userId, paragraphHash);
    state.seenHashes.add(paragraphHash);
  }
  const id = `mc-commit:${paragraphHash}:${domain}`;
  return { id };
}

/**
 * Delete (undo) a previously committed micro-card.
 *
 * @param {string} id — the id returned by commit()
 * @returns {boolean}
 */
function deleteCard(id) {
  // Phase 10b-1 stub: returns true (no DB row yet to delete).
  // Full implementation tracked as Discovered Issue.
  return !!id;
}

module.exports = { commit, delete: deleteCard, getInstance };
