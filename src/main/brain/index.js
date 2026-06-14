/**
 * Learning Brain Module
 *
 * Provides the AI Learning Brain functionality including:
 * - Background service management
 * - Hybrid fallback scheduling
 * - Episode collection
 * - Pattern analysis
 * - Notifications
 *
 * Usage:
 *   const { initializeLearningBrain, getLearningBrain } = require('./brain');
 *
 *   // Initialize on app start
 *   await initializeLearningBrain(services);
 *
 *   // Get brain instance anywhere
 *   const brain = getLearningBrain();
 *   await brain.triggerHeartbeat();
 */

const LearningBrainAgent = require('./LearningBrainAgent');
const HybridScheduler = require('./HybridScheduler');
const ServiceClient = require('./ServiceClient');
const EpisodeCollector = require('./EpisodeCollector');

let brainInstance = null;

/**
 * Initialize the Learning Brain system
 * @param {Object} services - Service dependencies
 * @param {Object} services.store - electron-store instance
 * @param {Object} services.aiProvider - AI provider manager
 * @param {Object} services.adaptiveLearningSkill - Existing adaptive learning skill
 * @param {Object} services.learningGraphSkill - Existing learning graph skill
 * @param {Object} services.notificationManager - For sending notifications
 * @returns {Promise<Object>}
 */
async function initializeLearningBrain(services = {}) {
  if (brainInstance) {
    console.log('[LearningBrain] Already initialized');
    return brainInstance;
  }

  console.log('[LearningBrain] Initializing...');

  // Check if brain is enabled
  const store = services.store;
  const brainConfig = store?.get('learningBrain', {});

  if (brainConfig.enabled === false) {
    console.log('[LearningBrain] Brain is disabled in settings');
    return null;
  }

  // Create the brain agent
  const brainAgent = new LearningBrainAgent(services);

  // Create the hybrid scheduler (handles service/fallback)
  const scheduler = new HybridScheduler(brainAgent, services);

  // Create episode collector
  const episodeCollector = new EpisodeCollector(services);

  // Initialize scheduler
  const schedulerResult = await scheduler.initialize();

  // Store instance
  brainInstance = {
    agent: brainAgent,
    scheduler,
    episodeCollector,
    mode: schedulerResult.mode,
    // Brain-driven shell: surface the emitter so Phase 4-8 services
    // (MicroCardProposer et al.) can reach it from their main.ts wiring.
    triggerEmitter: brainAgent.triggerEmitter,

    // High-level API
    async triggerHeartbeat() {
      return scheduler.triggerNow();
    },

    async getStatus() {
      return scheduler.getStatus();
    },

    async getInsights() {
      return brainAgent.getInsights();
    },

    recordEpisode(event) {
      return episodeCollector.record(event);
    },

    // Brain-driven shell IPC surface (consumed by triggerBusHandlers.js).
    async recordProposalEvent(event) {
      return brainAgent.recordProposalEvent(event);
    },

    async synthesizePullSuggestion() {
      return brainAgent.synthesizePullSuggestion();
    },

    getTriggerTelemetry() {
      return brainAgent.getTriggerTelemetry();
    },

    async stop() {
      scheduler.stop();
      await episodeCollector.flush();
    },
  };

  console.log('[LearningBrain] Initialized in', schedulerResult.mode, 'mode');

  return brainInstance;
}

/**
 * Get the Learning Brain instance
 * @returns {Object|null}
 */
function getLearningBrain() {
  return brainInstance;
}

/**
 * Check if Learning Brain is initialized
 * @returns {boolean}
 */
function isLearningBrainInitialized() {
  return brainInstance !== null;
}

/**
 * Shutdown the Learning Brain
 */
async function shutdownLearningBrain() {
  if (brainInstance) {
    await brainInstance.stop();
    brainInstance = null;
    console.log('[LearningBrain] Shutdown complete');
  }
}

module.exports = {
  initializeLearningBrain,
  getLearningBrain,
  isLearningBrainInitialized,
  shutdownLearningBrain,
  // Export classes for direct use
  LearningBrainAgent,
  HybridScheduler,
  ServiceClient,
  EpisodeCollector,
};
