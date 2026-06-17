// src/main/brain/director/tools/recentlyAcceptedMicroCards.js
const tools = require('../../spine/tools');
const { recentlyAccepted } = require('../../../db/LearningPointManager');

tools.register('recentlyAcceptedMicroCards', {
  description:
    'Last N Phase-4 micro-cards the user accepted, newest first. Use to see what was just added.',
  schema: {
    properties: {
      userId: { type: 'number' },
      n: { type: 'number' },
    },
    required: ['userId'],
  },
  kind: 'read',
});

tools.registerHandler('recentlyAcceptedMicroCards', async ({ userId, n = 10 }) => {
  return recentlyAccepted(userId, n);
});
