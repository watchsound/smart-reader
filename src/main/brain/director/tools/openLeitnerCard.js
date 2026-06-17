// src/main/brain/director/tools/openLeitnerCard.js
/**
 * openLeitnerCard — surface tool that opens a Leitner-system card.
 *
 * Delegates to ctx.awaitUserResult which is provided by SessionRunner
 * (Task 12) in the context object. Returns { rating, durationMs }.
 *
 * rating: 'again' | 'hard' | 'good' | 'easy'
 */
const tools = require('../../spine/tools');

tools.register('openLeitnerCard', {
  description: 'Open a Leitner-system card for the user to rate. Returns { rating, durationMs }.',
  argsSchema: {
    properties: {
      learningPointId: { type: 'number' },
    },
    required: ['learningPointId'],
  },
  kind: 'surface',
});

tools.registerHandler('openLeitnerCard', async (args, ctx) => {
  if (!ctx || !ctx.awaitUserResult) {
    throw new Error('openLeitnerCard requires session ctx with awaitUserResult');
  }
  return ctx.awaitUserResult({ tool: 'openLeitnerCard', args });
});
