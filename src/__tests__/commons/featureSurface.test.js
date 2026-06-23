const {
  FEATURE_SURFACES,
  ATTENTION_STATE,
  PHASE_GROUP,
  isValidFeatureSurface,
} = require('../../commons/model/featureSurface');

describe('featureSurface enum', () => {
  it('exports closed set of 9 values', () => {
    expect(FEATURE_SURFACES).toEqual([
      'reading-microcard',
      'director-session',
      'comprehension',
      'production-prompt',
      'pre-reading-diagnostic',
      'manual-review',
      'mindmap-study',
      'backfill',
      'unknown',
    ]);
  });

  it('maps every surface to one of 3 attention states', () => {
    FEATURE_SURFACES.forEach((s) => {
      expect(['while-reading', 'focused-session', 'historical']).toContain(ATTENTION_STATE[s]);
    });
  });

  it('maps every surface to a non-empty phase group', () => {
    FEATURE_SURFACES.forEach((s) => {
      expect(typeof PHASE_GROUP[s]).toBe('string');
      expect(PHASE_GROUP[s].length).toBeGreaterThan(0);
    });
  });

  it('isValidFeatureSurface returns true for enum values', () => {
    expect(isValidFeatureSurface('director-session')).toBe(true);
    expect(isValidFeatureSurface('not-a-thing')).toBe(false);
    expect(isValidFeatureSurface(undefined)).toBe(false);
  });
});
