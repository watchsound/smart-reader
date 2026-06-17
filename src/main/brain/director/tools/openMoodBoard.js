// src/main/brain/director/tools/openMoodBoard.js
/**
 * openMoodBoard — surface tool that opens a MoodBoard for organize-style review.
 *
 * Re-registers the Phase 9 skeleton with the full Director-aware declaration.
 *
 * Delegates to ctx.awaitUserResult which is provided by SessionRunner
 * (Task 12) in the context object. Returns { dwellMs, dismissed }.
 *
 * dwellMs: number (time spent viewing/interacting with MoodBoard)
 * dismissed: boolean (true if user dismissed without organizing)
 */
const tools = require('../../spine/tools');

tools.register('openMoodBoard', {
  description: 'Open a MoodBoard for organize-style review. Returns { dwellMs, dismissed }.',
  argsSchema: {
    properties: {
      boardId: { type: 'number' },
    },
    required: ['boardId'],
  },
  kind: 'surface',
});

tools.registerHandler('openMoodBoard', async (args, ctx) => {
  if (!ctx || !ctx.awaitUserResult) {
    throw new Error('openMoodBoard requires session ctx with awaitUserResult');
  }
  return ctx.awaitUserResult({ tool: 'openMoodBoard', args });
});
