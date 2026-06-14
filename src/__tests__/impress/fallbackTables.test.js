const {
  pickTypographyByMoodRole,
  pickBackgroundByMood,
  pickTransitionByMood,
  cssFallbackForWebGL,
} = require('../../renderer/components/impressjs/effects/fallbackTables');

describe('effects/fallbackTables', () => {
  test('picks blur_in for dramatic opening', () => {
    expect(pickTypographyByMoodRole('dramatic', 'opening')).toBe('blur_in');
  });

  test('picks word_by_word_fade for calm key_concept', () => {
    expect(pickTypographyByMoodRole('calm', 'key_concept')).toBe('word_by_word_fade');
  });

  test('returns none for unknown mood+role pair', () => {
    expect(pickTypographyByMoodRole('zzz', 'zzz')).toBe('none');
  });

  test('picks nebula_cloud for cinematic background', () => {
    expect(pickBackgroundByMood('cinematic')).toBe('nebula_cloud');
  });

  test('picks none for unknown mood background', () => {
    expect(pickBackgroundByMood('zzz')).toBe('none');
  });

  test('picks depth_blur for dramatic transition', () => {
    expect(pickTransitionByMood('dramatic')).toBe('depth_blur');
  });

  test('text_3d_extrude falls back to blur_in when WebGL unavailable', () => {
    expect(cssFallbackForWebGL('text_3d_extrude')).toBe('blur_in');
  });

  test('nebula_cloud falls back to gradient_flow when WebGL unavailable', () => {
    expect(cssFallbackForWebGL('nebula_cloud')).toBe('gradient_flow');
  });

  test('unknown WebGL effect returns null', () => {
    expect(cssFallbackForWebGL('__bogus__')).toBeNull();
  });
});
