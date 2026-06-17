// src/main/brain/director/tools/topUnmasteredConcepts.js
const tools = require('../../spine/tools');
const { topNByMastery } = require('../../../db/LearningPointManager');

tools.register('topUnmasteredConcepts', {
  description: 'Return the top concepts the learner has NOT yet mastered (mastery_level < 60).',
  schema: {
    properties: { limit: { type: 'number' } },
    required: [],
  },
});

tools.registerHandler('topUnmasteredConcepts', async ({ limit = 5 } = {}) => {
  const rows = topNByMastery(1, Math.max(limit, 15));
  const weak = (rows || [])
    .filter((r) => (r.mastery_level || 0) < 60)
    .slice(0, limit)
    .map((r) => r.concept);
  return { concepts: weak };
});
