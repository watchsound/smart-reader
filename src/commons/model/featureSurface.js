/**
 * Phase 13 Attribution: closed feature_surface enum + lens maps.
 * Lives in commons so both main process (writers) and renderer
 * (lens toggle UI) import the same source of truth.
 *
 * 'unknown' is a LINT GUARD — never write it intentionally; the
 * masteryEventCallSites lint test fails the build if a record() call
 * omits featureSurface.
 */

const FEATURE_SURFACES = [
  'reading-microcard',
  'director-session',
  'comprehension',
  'production-prompt',
  'pre-reading-diagnostic',
  'manual-review',
  'mindmap-study',
  'study-forum',
  'translate-drill',
  'backfill',
  'unknown',
];

const ATTENTION_STATE = {
  'reading-microcard': 'while-reading',
  'pre-reading-diagnostic': 'while-reading',
  'director-session': 'focused-session',
  comprehension: 'focused-session',
  'production-prompt': 'focused-session',
  'manual-review': 'focused-session',
  'mindmap-study': 'focused-session',
  'study-forum': 'focused-session',
  'translate-drill': 'focused-session',
  backfill: 'historical',
  unknown: 'historical',
};

const PHASE_GROUP = {
  'reading-microcard': 'reading-loop',
  'pre-reading-diagnostic': 'diagnostics',
  'director-session': 'director',
  comprehension: 'comprehension',
  'production-prompt': 'production-prompts',
  'manual-review': 'manual-review',
  'mindmap-study': 'production-prompts',
  'study-forum': 'production-prompts',
  'translate-drill': 'production-prompts',
  backfill: 'historical',
  unknown: 'historical',
};

const isValidFeatureSurface = (s) => FEATURE_SURFACES.includes(s);

module.exports = {
  FEATURE_SURFACES,
  ATTENTION_STATE,
  PHASE_GROUP,
  isValidFeatureSurface,
};
