/**
 * orbAnimations — visual language for the BrainOrb ambient indicator.
 *
 * Why this lives outside `animation-core`: animation-core is a text/word
 * effect system (wraps spans, flies clones, registers per-word effects).
 * The Orb is a 24-px single DOM element with five state-driven keyframe
 * animations; routing it through animation-core would be all the overhead
 * with none of the benefit. This module is the lighter cousin — pure CSS
 * keyframe objects + a state→animation map — so the BrainOrb component
 * stays declarative and the animations are unit-testable in isolation.
 *
 * Five orb states (`src/commons/brain/triggerTypes.js#OrbState`):
 *   idle           — passive, no animation, neutral gray
 *   thinking       — gentle scale pulse (Brain is computing)
 *   has-proposal   — bloom once + ambient breathing pulse (something for you)
 *   mid-flow       — slow rotating ring (a Flow is mid-execution)
 *   uncertain      — soft warm-tone wobble + opacity drift (low-confidence)
 *
 * Polish goals beyond the original three-keyframe surface:
 *   1. `has-proposal` was a one-shot bloom — the orb sat static afterwards.
 *      Now it blooms once then settles into an ambient breathing pulse so
 *      the user keeps noticing there's a proposal waiting.
 *   2. `mid-flow` had a static border ring — no visual sign anything was
 *      happening. Now the ring rotates slowly (8 s per turn).
 *   3. `uncertain` was a sharp opacity flicker. Now it's a soft wobble +
 *      gentle opacity drift, less alarming for a low-confidence state.
 *   4. Click feedback (scale-down on press) — see BrainOrb for the
 *      sx-level `:active` wiring; the duration constant lives here so
 *      both halves stay in sync.
 */

// Color palette per state. The `ring` slot is the rotating border color
// used in mid-flow; null means the state has no ring.
export const ORB_COLORS = {
  idle: { base: '#c8c8c8', ring: null },
  thinking: { base: '#9bb8ff', ring: null },
  'has-proposal': { base: '#6c8cff', ring: null },
  'mid-flow': { base: '#4a6bff', ring: 'rgba(74,107,255,0.55)' },
  uncertain: { base: '#ffb14a', ring: null },
};

export const ORB_SIZE_PX = 24;
export const CLICK_PRESS_SCALE = 0.92;
export const CLICK_PRESS_DURATION_MS = 120;
export const STATE_TRANSITION_MS = 220;

// Keyframe definitions in the object shape MUI sx + emotion both accept.
// Suffix-named to avoid colliding with other components that might use
// `pulse` or `bloom` keyframes.
export const ORB_KEYFRAMES = {
  '@keyframes orb-pulse': {
    '0%, 100%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.15)' },
  },
  '@keyframes orb-bloom': {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.3)' },
    '100%': { transform: 'scale(1.05)' },
  },
  // The lingering breath after bloom. Smaller amplitude than `orb-pulse`
  // so it reads as ambient attention, not active computation.
  '@keyframes orb-breath': {
    '0%, 100%': {
      transform: 'scale(1.05)',
      boxShadow: '0 0 0 0 rgba(108,140,255,0.45)',
    },
    '50%': {
      transform: 'scale(1.12)',
      boxShadow: '0 0 0 4px rgba(108,140,255,0)',
    },
  },
  // Smoother than the old binary opacity flicker — wobble + a soft
  // opacity drift, like a flame in a draft.
  '@keyframes orb-wobble': {
    '0%, 100%': { transform: 'translateX(0) scale(1)', opacity: 1 },
    '25%': { transform: 'translateX(-0.5px) scale(0.98)', opacity: 0.85 },
    '50%': { transform: 'translateX(0) scale(1.02)', opacity: 0.72 },
    '75%': { transform: 'translateX(0.5px) scale(0.98)', opacity: 0.85 },
  },
  '@keyframes orb-ring-spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  '@keyframes orb-badge-pop': {
    '0%': { transform: 'scale(0)', opacity: 0 },
    '60%': { transform: 'scale(1.15)', opacity: 1 },
    '100%': { transform: 'scale(1)', opacity: 1 },
  },
};

// CSS `animation` value per state. `null` = no animation on the main orb.
// Compound (comma-separated) animations let `has-proposal` chain bloom →
// breath cleanly: the bloom runs once and finishes at scale(1.05); the
// breath then oscillates around that scale forever.
export const ORB_ANIMATIONS = {
  idle: null,
  thinking: 'orb-pulse 1.4s ease-in-out infinite',
  'has-proposal':
    'orb-bloom 0.6s ease-out, orb-breath 2.4s ease-in-out 0.6s infinite',
  'mid-flow': null,
  uncertain: 'orb-wobble 1.4s ease-in-out infinite',
};

// CSS `animation` value for the mid-flow ring overlay. The ring is a
// pseudo-element-like absolute Box rendered alongside the orb; only
// mid-flow uses one today.
export const ORB_RING_ANIMATION = 'orb-ring-spin 8s linear infinite';

// CSS `animation` value for the queue-depth badge entry.
export const ORB_BADGE_ANIMATION =
  'orb-badge-pop 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both';

/**
 * @param {import('../../../commons/brain/triggerTypes').OrbState} state
 * @returns {{ base: string, ring: string | null }}
 */
export function getOrbColor(state) {
  return ORB_COLORS[state] || ORB_COLORS.idle;
}

/**
 * @param {import('../../../commons/brain/triggerTypes').OrbState} state
 * @returns {string | null}
 */
export function getOrbAnimation(state) {
  return ORB_ANIMATIONS[state] ?? null;
}
