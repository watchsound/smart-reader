// src/main/brain/director/tools/recentEpisodeSummary.js
const tools = require('../../spine/tools');
const { getLearningBrain } = require('../..');

tools.register('recentEpisodeSummary', {
  description: 'One-paragraph summary of the learner\'s recent reading activity in the past N days.',
  schema: {
    properties: { days: { type: 'number' } },
    required: [],
  },
});

tools.registerHandler('recentEpisodeSummary', async ({ days = 7 } = {}) => {
  const brain = getLearningBrain();
  if (!brain || !brain.episodeCollector) return { summary: 'No brain initialized.' };
  const eps = await brain.episodeCollector.getRecentEpisodes(200);
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const recent = (eps || []).filter((e) => {
    const ts = e.timestamp ? new Date(e.timestamp).getTime() : 0;
    return ts >= cutoff;
  });
  if (recent.length === 0) return { summary: `No episodes in the past ${days} days.` };
  const byType = {};
  for (const e of recent) { byType[e.eventType] = (byType[e.eventType] || 0) + 1; }
  const parts = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, n]) => `${n}× ${t}`);
  return { summary: `In the past ${days} days: ${parts.join(', ')}.`, count: recent.length };
});
