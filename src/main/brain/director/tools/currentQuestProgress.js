// src/main/brain/director/tools/currentQuestProgress.js
const tools = require('../../spine/tools');
const QuestService = require('../../../utils/QuestService');
const Store = require('electron-store');

tools.register('currentQuestProgress', {
  description: 'Return the active Quest with its goal, books, and days active.',
  schema: { properties: {}, required: [] },
});

let questService = null;
function getQuestService() {
  if (!questService) questService = new QuestService(new Store());
  return questService;
}

tools.registerHandler('currentQuestProgress', async () => {
  const svc = getQuestService();
  const actives = svc.list({ userId: 1, status: 'active' });
  if (!actives.length) return { active: false };
  const q = actives[0];
  const daysActive = q.createdAt
    ? Math.floor((Date.now() - new Date(q.createdAt).getTime()) / (24 * 3600 * 1000))
    : 0;
  return {
    active: true,
    name: q.name,
    goal: q.goal,
    bookIds: q.bookIds || [],
    createdAt: q.createdAt,
    daysActive,
  };
});
