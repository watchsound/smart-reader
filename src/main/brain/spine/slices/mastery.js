const BrainContext = require('../BrainContext');
const { topNByMastery } = require('../../../db/LearningPointManager');

BrainContext.registerSlice('mastery', async (userId) => {
  const rows = topNByMastery(userId || 1, 15);
  return (rows || []).map((r) => ({ c: r.concept, m: r.mastery_level }));
});
