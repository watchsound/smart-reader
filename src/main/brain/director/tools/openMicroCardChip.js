// src/main/brain/director/tools/openMicroCardChip.js
/**
 * openMicroCardChip — surface tool that shows a Phase 4 micro-card chip.
 *
 * Delegates to ctx.awaitUserResult which is provided by SessionRunner
 * (Task 12) in the context object. Returns { accepted, durationMs }.
 *
 * accepted: boolean (true if user accepted the card)
 * durationMs: number (time user spent interacting with chip)
 */
const tools = require('../../spine/tools');

tools.register('openMicroCardChip', {
  description: 'Show a Phase 4 micro-card chip for a paragraph. Returns { accepted, durationMs }.',
  argsSchema: {
    properties: {
      paragraphHash: { type: 'string' },
      proposal: { type: 'object' },
    },
    required: ['paragraphHash', 'proposal'],
  },
  kind: 'surface',
});

tools.registerHandler('openMicroCardChip', async (args, ctx) => {
  if (!ctx || !ctx.awaitUserResult) {
    throw new Error('openMicroCardChip requires session ctx with awaitUserResult');
  }
  return ctx.awaitUserResult({ tool: 'openMicroCardChip', args });
});
