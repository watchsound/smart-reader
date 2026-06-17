// src/main/brain/spine/slices/acceptDismissPatterns.js
const BrainContext = require('../BrainContext');
const { getLearningBrain } = require('../../');

BrainContext.registerSlice('acceptDismissPatterns', async () => {
  const brain = getLearningBrain();
  if (!brain || typeof brain.getTriggerTelemetry !== 'function') return {};

  const tel = brain.getTriggerTelemetry();
  const out = {};

  for (const [src, t] of Object.entries(tel?.bySource || {})) {
    const total = (t.accepted || 0) + (t.dismissed || 0);
    out[src] = {
      accepted: t.accepted || 0,
      dismissed: t.dismissed || 0,
      acceptRate: total > 0 ? t.accepted / total : 0,
    };
  }

  return out;
});
