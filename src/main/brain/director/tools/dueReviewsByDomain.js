// src/main/brain/director/tools/dueReviewsByDomain.js
const tools = require('../../spine/tools');
const { dueByDomain } = require('../../../db/LearningPointManager');

tools.register('dueReviewsByDomain', {
  description:
    'Get due-review counts bucketed by domain (vocabulary, concept, code, math). Use to pick which domain to focus on.',
  schema: {
    properties: { userId: { type: 'number' } },
    required: ['userId'],
  },
  kind: 'read',
});

tools.registerHandler('dueReviewsByDomain', async ({ userId }) => {
  return dueByDomain(userId);
});
