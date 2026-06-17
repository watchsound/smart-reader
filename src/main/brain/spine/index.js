// src/main/brain/spine/index.js
/**
 * Brain Spine — public surface used by Phase 0–8 services in later plans.
 */
module.exports = {
  brainCall: require('./brainCall'),
  meteredCall: require('./meteredCall'),
  meteredCallJson: require('./meteredCallJson'),
  intents: require('./intents'),
  tools: require('./tools'),
  BrainContext: require('./BrainContext'),
  costEstimator: require('./costEstimator'),
  // Side-effect imports to ensure all slices are registered when consumers
  // import the spine.
  _slices: [
    require('./slices/activeQuest'),
    require('./slices/currentBook'),
    require('./slices/recentEpisodes'),
    require('./slices/mastery'),
    require('./slices/recentComprehension'),
    require('./slices/acceptDismissPatterns'),
  ],
};
