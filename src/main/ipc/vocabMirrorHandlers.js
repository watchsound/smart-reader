/**
 * vocabMirrorHandlers — IPC for the vocabulary → learning_point migration.
 *
 * Single channel: `vocab-ensure-backfilled` runs the backfill once per
 * user-per-process. Idempotent at the DB level (getBySource skips rows
 * that already have a mirror), but the in-memory dedup avoids the SELECT
 * on every chapter render after the first.
 */

const {
  backfillVocabularyToLearningPoints,
} = require('../db/VocabularyManager');
const { getUserIdFromToken } = require('../db/dbManager');

const registerVocabMirrorHandlers = (ipcMain) => {
  // Scoped to this registration call so each test (which re-registers)
  // and each app launch (single registration) gets a clean dedup Set.
  const backfilledUsers = new Set();

  ipcMain.handle('vocab-ensure-backfilled', async (_event, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return { scanned: 0, created: 0, skipped: 0, errors: 0 };
    }
    if (backfilledUsers.has(userId)) {
      return { scanned: 0, created: 0, skipped: 0, errors: 0, cached: true };
    }
    const result = await backfillVocabularyToLearningPoints(token);
    backfilledUsers.add(userId);
    return result;
  });
};

module.exports = { registerVocabMirrorHandlers };
