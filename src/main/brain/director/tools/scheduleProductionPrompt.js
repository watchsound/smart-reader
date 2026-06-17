// src/main/brain/director/tools/scheduleProductionPrompt.js
/**
 * scheduleProductionPrompt — soft-write Director tool.
 *
 * Calls meteredCallJson to get a ledger row (tagged
 * session-soft-write:scheduleProductionPrompt), then schedules a
 * production-style prompt for a high-mastery concept via
 * productionPromptSingleton. Returns { callId, promptId, userId, learningPointId }
 * so that SessionRunner can merge userId + learningPointId into the Undo payload,
 * allowing UndoRegistry.run('scheduleProductionPrompt', { userId, learningPointId })
 * to forward both to productionPromptSingleton.unschedule.
 *
 * Why productionPromptSingleton: ProductionPromptService requires an
 * electron-store injection for dedup persistence. The singleton wrapper
 * exposes the narrow schedulePrompt/unschedule surface and is mockable
 * in Jest without touching the real store or Electron context.
 */
const tools = require('../../spine/tools');
const meteredCallJson = require('../../spine/meteredCallJson');
const ProductionPromptService = require('../../productionPromptSingleton');
const UndoRegistry = require('../UndoRegistry');

tools.register('scheduleProductionPrompt', {
  description: 'Schedule a production-style prompt for a high-mastery concept. Reversible.',
  argsSchema: {
    properties: {
      userId:          { type: 'number' },
      learningPointId: { type: 'number' },
      prompt:          { type: 'string' },
    },
    required: ['userId', 'learningPointId', 'prompt'],
  },
  kind: 'soft-write',
});

tools.registerHandler('scheduleProductionPrompt', async (args, ctx = {}) => {
  const {
    userId = 1,
    learningPointId,
    prompt = '',
  } = args;

  const { callId } = await meteredCallJson(
    `Schedule production prompt for LP ${learningPointId}: ${prompt}`,
    null,
    { legacyLabel: 'session-soft-write:scheduleProductionPrompt', traceId: ctx.traceId },
  );

  const { id: promptId } = await ProductionPromptService.schedulePrompt({
    userId, learningPointId, prompt,
  });

  return { callId, promptId, userId, learningPointId };
});

UndoRegistry.register('scheduleProductionPrompt', async ({ userId, learningPointId }) => {
  const undone = ProductionPromptService.unschedule({ userId, learningPointId });
  return { undone: !!undone };
});
