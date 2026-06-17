// src/main/brain/director/configs/deterministicPullFallback.js
/**
 * Deterministic fallback for the Pull-Suggestion Director.
 * Accepts an optional array of active Quest objects so the Quest-aware
 * branch can still be exercised when called from LearningBrainAgent.
 * Returns { title, body, navigate, source: 'deterministic-fallback' }.
 */
module.exports = function deterministicPullFallback({ activeQuests = [] } = {}) {
  if (activeQuests.length > 0) {
    const q = activeQuests[0];
    const firstBook = q.bookIds && q.bookIds.length > 0 ? q.bookIds[0] : null;
    return {
      title: `Continue your quest: ${q.name}`,
      body: q.goal,
      navigate: firstBook ? `reading/${firstBook}` : null,
      source: 'deterministic-fallback',
    };
  }
  return {
    title: "You're caught up",
    body: 'No pending proposals and no active quests. Pick a book to keep going.',
    navigate: 'bookshelf',
    source: 'deterministic-fallback',
  };
};
