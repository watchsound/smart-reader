const {
  FEATURE_SURFACES,
  ATTENTION_STATE,
  PHASE_GROUP,
  isValidFeatureSurface,
} = require('../../commons/model/featureSurface');

describe('featureSurface: translate-drill', () => {
  test('is a valid surface', () => {
    expect(isValidFeatureSurface('translate-drill')).toBe(true);
    expect(FEATURE_SURFACES).toContain('translate-drill');
  });
  test('has attention-state focused-session', () => {
    expect(ATTENTION_STATE['translate-drill']).toBe('focused-session');
  });
  test('has phase-group production-prompts', () => {
    expect(PHASE_GROUP['translate-drill']).toBe('production-prompts');
  });
});
