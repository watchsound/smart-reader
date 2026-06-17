// src/main/brain/director/tools/endSession.js
/**
 * endSession — control tool that terminates a study session.
 *
 * Control tools are terminal actions. When the Director picks endSession,
 * SessionRunner (Task 12) interprets it as the signal to stop the session
 * and report the reason to the caller.
 *
 * reason: string — One of 'goal-satisfied', 'no-useful-action', or similar
 *   terminal status explaining why the session ended.
 */
const tools = require('../../spine/tools');

tools.register('endSession', {
  description: 'End the session. Call when the goal is satisfied or no useful next action remains.',
  argsSchema: {
    properties: {
      reason: { type: 'string' },
    },
    required: ['reason'],
  },
  kind: 'control',
});

tools.registerHandler('endSession', async ({ reason }) => ({ reason }));
