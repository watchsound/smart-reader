/* eslint-disable prettier/prettier */
/**
 * Fallback resolution tables.
 *  - mood+role -> typography effect name (used when AI omits data[].typography)
 *  - mood     -> background / transition (used when AI omits those)
 *  - WebGL effect name -> CSS effect name (used when WebGL unavailable)
 */

const TYPOGRAPHY_BY_MOOD_ROLE = {
  'dramatic|opening':     'blur_in',
  'dramatic|key_concept': 'scramble_decode',
  'dramatic|punchline':   'glitch_chromatic',
  'dramatic|closing':     'neon_glow_pulse',
  'calm|opening':         'blur_in',
  'calm|key_concept':     'word_by_word_fade',
  'calm|quote':           'ink_write',
  'calm|closing':         'word_by_word_fade',
  'tech|opening':         'scramble_decode',
  'tech|key_concept':     'typewriter',
  'tech|data':            'typewriter',
  'tech|punchline':       'glitch_chromatic',
  'playful|opening':      'letters_from_edges',
  'playful|key_concept':  'letters_from_edges',
  'playful|punchline':    'neon_glow_pulse',
  'scholarly|opening':    'blur_in',
  'scholarly|key_concept':'word_by_word_fade',
  'scholarly|quote':      'ink_write',
  'cinematic|opening':    'blur_in',
  'cinematic|key_concept':'word_by_word_fade',
  'cinematic|punchline':  'glitch_chromatic',
  'cinematic|closing':    'neon_glow_pulse',
};

const BACKGROUND_BY_MOOD = {
  calm:      'gradient_flow',
  dramatic:  'starfield_parallax',
  tech:      'data_stream',
  playful:   'dust_motes',
  scholarly: 'ink_wash',
  cinematic: 'nebula_cloud',
};

const TRANSITION_BY_MOOD = {
  calm:      'dissolve',
  dramatic:  'depth_blur',
  tech:      'depth_blur',
  playful:   'ink_bleed',
  scholarly: 'default',
  cinematic: 'shatter_rebuild',
};

const WEBGL_TO_CSS = {
  text_3d_extrude:     'blur_in',
  text_particle_burst: 'letters_from_edges',
  text_liquid_morph:   'scramble_decode',
  nebula_cloud:        'gradient_flow',
  geometry_field:      'dust_motes',
  data_stream:         'starfield_parallax',
  aurora:              'gradient_flow',
};

function pickTypographyByMoodRole(mood, role) {
  return TYPOGRAPHY_BY_MOOD_ROLE[`${mood}|${role}`] || 'none';
}

function pickBackgroundByMood(mood) {
  return BACKGROUND_BY_MOOD[mood] || 'none';
}

function pickTransitionByMood(mood) {
  return TRANSITION_BY_MOOD[mood] || 'default';
}

function cssFallbackForWebGL(name) {
  return WEBGL_TO_CSS[name] || null;
}

module.exports = {
  pickTypographyByMoodRole,
  pickBackgroundByMood,
  pickTransitionByMood,
  cssFallbackForWebGL,
};
