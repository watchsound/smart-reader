import {
  ORB_COLORS,
  ORB_KEYFRAMES,
  ORB_ANIMATIONS,
  ORB_RING_ANIMATION,
  ORB_BADGE_ANIMATION,
  getOrbColor,
  getOrbAnimation,
} from '../../renderer/components/brainShell/orbAnimations';

const ORB_STATES = [
  'idle',
  'thinking',
  'has-proposal',
  'mid-flow',
  'uncertain',
];

describe('orbAnimations', () => {
  test('every OrbState has a color palette entry', () => {
    ORB_STATES.forEach((state) => {
      const color = ORB_COLORS[state];
      expect(color).toBeDefined();
      expect(typeof color.base).toBe('string');
      expect(color.base.length).toBeGreaterThan(0);
      // ring is nullable
      expect(['object', 'string']).toContain(typeof (color.ring || null));
    });
  });

  test('mid-flow is the only state with a ring color', () => {
    expect(ORB_COLORS['mid-flow'].ring).toBeTruthy();
    ORB_STATES.filter((s) => s !== 'mid-flow').forEach((state) => {
      expect(ORB_COLORS[state].ring).toBeNull();
    });
  });

  test('every OrbState has an animation entry (null is allowed)', () => {
    ORB_STATES.forEach((state) => {
      expect(state in ORB_ANIMATIONS).toBe(true);
    });
  });

  test('idle has no animation; thinking/has-proposal/uncertain do', () => {
    expect(ORB_ANIMATIONS.idle).toBeNull();
    expect(ORB_ANIMATIONS.thinking).toMatch(/orb-pulse/);
    // has-proposal is compound: bloom + breath
    expect(ORB_ANIMATIONS['has-proposal']).toMatch(/orb-bloom/);
    expect(ORB_ANIMATIONS['has-proposal']).toMatch(/orb-breath/);
    expect(ORB_ANIMATIONS.uncertain).toMatch(/orb-wobble/);
  });

  test('every animation references a defined keyframe name', () => {
    const definedNames = Object.keys(ORB_KEYFRAMES).map((k) =>
      k.replace('@keyframes ', ''),
    );
    Object.values(ORB_ANIMATIONS)
      .filter(Boolean)
      .forEach((rule) => {
        // Extract animation names — they're the first word in each
        // comma-separated segment.
        rule.split(',').forEach((segment) => {
          const name = segment.trim().split(/\s+/)[0];
          expect(definedNames).toContain(name);
        });
      });
    [ORB_RING_ANIMATION, ORB_BADGE_ANIMATION].forEach((rule) => {
      const name = rule.trim().split(/\s+/)[0];
      expect(definedNames).toContain(name);
    });
  });

  test('getOrbColor returns idle palette for unknown states', () => {
    expect(getOrbColor('not-a-state')).toEqual(ORB_COLORS.idle);
  });

  test('getOrbAnimation returns null for unknown states', () => {
    expect(getOrbAnimation('not-a-state')).toBeNull();
  });

  test('keyframe objects have a 0% (or 0%,100%) entry and a peak', () => {
    Object.values(ORB_KEYFRAMES).forEach((frames) => {
      const stops = Object.keys(frames);
      // Each keyframe must declare at least a starting frame; pure
      // keyframe-validity is what we're guarding against here.
      const hasStart = stops.some((s) => s.includes('0%'));
      expect(hasStart).toBe(true);
      expect(stops.length).toBeGreaterThanOrEqual(2);
    });
  });
});
