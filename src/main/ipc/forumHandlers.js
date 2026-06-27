// src/main/ipc/forumHandlers.js
/**
 * Study Forum IPC layer.
 *
 * Three handlers:
 *   forum:get-or-create — dedup by anchor; on miss, seed via brainCall.
 *   forum:reply         — append user turn + persona turns from brainCall.
 *   forum:list-by-chapter — for in-book Forum Marker rendering.
 *
 * Cost data (seedCostUsd on discussion, cost_usd on user turn) is captured
 * inline from brainCall's return tuple — no second ledger query.
 */
const brainCall = require('../brain/spine/brainCall');
const buildSeedPrompt = require('../brain/prompts/forumSeed');
const buildReplyPrompt = require('../brain/prompts/forumReply');
const ForumDiscussionManager = require('../db/ForumDiscussionManager');

let _manager = null;

function manager() {
  if (!_manager) {
    throw new Error(
      'forumHandlers: manager not initialized — call init({ db }) first',
    );
  }
  return _manager;
}

function init({ db }) {
  _manager = new ForumDiscussionManager(db);
}

// Test-only seam.
function __setDeps({ manager: m }) {
  _manager = m;
}

// Lookup-only: returns the existing discussion at this anchor, or null.
// Use this when you want to confirm presence WITHOUT triggering an LLM seed —
// the floating Discuss button flow uses it to ask the user before spending.
async function find({ anchor }) {
  return manager().findByAnchor(anchor);
}

async function getOrCreate({ anchor, passageText, bookTitle, chapterTitle }) {
  const existing = manager().findByAnchor(anchor);
  if (existing) return existing;

  const prompt = buildSeedPrompt({
    bookTitle,
    chapterTitle,
    passage: passageText,
  });
  const { output, cost_usd } = await brainCall(
    'simulate-forum-seed',
    prompt,
    {},
  );
  const now = Date.now();
  const turns = output.turns.map((t) => ({ ...t, ts: now }));
  return manager().create(anchor, turns, cost_usd || 0);
}

async function reply({ discussionId, userContent, addressedTo }) {
  const discussion = manager().getById(discussionId);
  if (!discussion) {
    throw new Error(`forum_discussion ${discussionId} not found`);
  }

  const passage = discussion.selectionText || '';
  const prompt = buildReplyPrompt({
    passage,
    history: discussion.turns,
    userContent,
    addressedTo: addressedTo || null,
  });
  const { output, cost_usd } = await brainCall(
    'simulate-forum-reply',
    prompt,
    {},
  );
  const now = Date.now();
  const userTurn = {
    persona: 'user',
    content: userContent,
    ts: now,
    addressedTo: addressedTo || null,
    cost_usd: cost_usd || 0,
  };
  const personaTurns = output.turns.map((t) => ({ ...t, ts: now }));
  return manager().appendTurns(discussionId, [userTurn, ...personaTurns]);
}

async function listByChapter({ bookId, chapterId }) {
  return manager().listByBookChapter(bookId, chapterId);
}

module.exports = {
  init,
  __setDeps,
  find,
  getOrCreate,
  reply,
  listByChapter,
};
