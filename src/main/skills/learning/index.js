/**
 * Learning Skills Module
 *
 * AI skills for the Learning Companion framework.
 * These skills handle domain detection, learning plan creation,
 * progress tracking, session management, and content generation.
 */

const DomainDetectionSkill = require('./DomainDetectionSkill');
const LearningPlanCreateSkill = require('./LearningPlanCreateSkill');
const LearningPlanProgressSkill = require('./LearningPlanProgressSkill');
const LearningSessionSkill = require('./LearningSessionSkill');
const ContentGenerationSkill = require('./ContentGenerationSkill');
const LearningReminderSkill = require('./LearningReminderSkill');
const LearningGraphSkill = require('./LearningGraphSkill');
const AdaptiveLearningSkill = require('./AdaptiveLearningSkill');

/**
 * All learning skills
 */
const learningSkills = [
  DomainDetectionSkill,
  LearningPlanCreateSkill,
  LearningPlanProgressSkill,
  LearningSessionSkill,
  ContentGenerationSkill,
  LearningReminderSkill,
  LearningGraphSkill,
  AdaptiveLearningSkill,
];

/**
 * Register all learning skills with the registry
 * @param {SkillRegistry} registry - The skill registry instance
 */
function registerLearningSkills(registry) {
  for (const skill of learningSkills) {
    registry.register(skill);
  }
  console.log(`[Learning Skills] Registered ${learningSkills.length} learning skills`);
}

module.exports = {
  // Individual skill exports
  DomainDetectionSkill,
  LearningPlanCreateSkill,
  LearningPlanProgressSkill,
  LearningSessionSkill,
  ContentGenerationSkill,
  LearningReminderSkill,
  LearningGraphSkill,
  AdaptiveLearningSkill,

  // Bulk exports
  learningSkills,
  registerLearningSkills,
};
