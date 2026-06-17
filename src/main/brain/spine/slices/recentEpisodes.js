// src/main/brain/spine/slices/recentEpisodes.js
const BrainContext = require('../BrainContext');
const { getLearningBrain } = require('../../');

BrainContext.registerSlice('recentEpisodes', async (userId) => {
  const brain = getLearningBrain();
  if (!brain || !brain.episodeCollector) return [];
  const eps = await brain.episodeCollector.getRecentEpisodes(20);
  return (eps || [])
    .filter((e) => (e.userId || 1) === userId)
    .map((e) => ({
      t: e.eventType,
      b: e.sourceContext && e.sourceContext.documentId,
      ts: e.timestamp,
    }));
});
