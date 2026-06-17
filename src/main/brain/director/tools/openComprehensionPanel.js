// src/main/brain/director/tools/openComprehensionPanel.js
/**
 * openComprehensionPanel — surface tool that opens chapter-end comprehension check.
 *
 * Delegates to ctx.awaitUserResult which is provided by SessionRunner
 * (Task 12) in the context object. Returns { score, answer }.
 *
 * score: number 0-100 (user's comprehension rating)
 * answer: string (user's free-text response to comprehension question)
 */
const tools = require('../../spine/tools');

tools.register('openComprehensionPanel', {
  description: 'Open the chapter-end comprehension panel. Returns { score, answer }.',
  argsSchema: {
    properties: {
      bookId: { type: 'number' },
      chapterId: { type: 'string' },
    },
    required: ['bookId', 'chapterId'],
  },
  kind: 'surface',
});

tools.registerHandler('openComprehensionPanel', async (args, ctx) => {
  if (!ctx || !ctx.awaitUserResult) {
    throw new Error('openComprehensionPanel requires session ctx with awaitUserResult');
  }
  return ctx.awaitUserResult({ tool: 'openComprehensionPanel', args });
});
