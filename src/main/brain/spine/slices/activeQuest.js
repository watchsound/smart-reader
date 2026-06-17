// src/main/brain/spine/slices/activeQuest.js
const BrainContext = require('../BrainContext');
const QuestService = require('../../../utils/QuestService');
const Store = require('electron-store');

// One store instance per process — electron-store reads/writes a JSON
// file, so multiple instances would share state but waste handles.
let questService = null;
function getQuestService() {
  if (!questService) {
    questService = new QuestService(new Store());
  }
  return questService;
}

BrainContext.registerSlice('activeQuest', async (userId) => {
  const svc = getQuestService();
  const actives = svc.list({ userId: userId || 1, status: 'active' });
  if (!actives.length) return { active: false };
  const q = actives[0];
  return {
    id: q.id,
    name: q.name,
    goal: q.goal,
    bookIds: q.bookIds || [],
    createdAt: q.createdAt,
  };
});
