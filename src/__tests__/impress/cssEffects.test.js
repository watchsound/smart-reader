/**
 * @jest-environment jsdom
 */
require('../../renderer/components/impressjs/effects/cssEffects');
const { lookup } = require('../../renderer/components/impressjs/effects/registries');

function makeCtx() {
  document.body.innerHTML = '<div id="impress"><div class="step" id="step-0">x</div></div>';
  return {
    slideEl: document.getElementById('step-0'),
    doc: document,
    slideData: {},
    deck: {},
    scene: null,
  };
}

describe('cssEffects descriptors', () => {
  test('blur_in mounts and cleans up', () => {
    const d = lookup('typography', 'blur_in');
    const ctx = makeCtx();
    const cleanup = d.apply(ctx);
    expect(ctx.slideEl.classList.contains('impress-typo-blur_in')).toBe(true);
    cleanup();
    expect(ctx.slideEl.classList.contains('impress-typo-blur_in')).toBe(false);
  });

  test('gradient_flow toggles body class', () => {
    const d = lookup('background', 'gradient_flow');
    const ctx = makeCtx();
    const cleanup = d.apply(ctx);
    expect(document.body.classList.contains('impress-bg-gradient_flow')).toBe(true);
    cleanup();
    expect(document.body.classList.contains('impress-bg-gradient_flow')).toBe(false);
  });

  test('depth_blur toggles root class', () => {
    const d = lookup('transition', 'depth_blur');
    const ctx = makeCtx();
    const cleanup = d.apply(ctx);
    expect(document.getElementById('impress').classList.contains('impress-transition-depth_blur')).toBe(true);
    cleanup();
    expect(document.getElementById('impress').classList.contains('impress-transition-depth_blur')).toBe(false);
  });

  test('helix layout generates data attributes', () => {
    const d = lookup('layout', 'helix');
    expect(d.generate(0, 5)).toMatch(/data-x="\d+"/);
    expect(d.generate(0, 5)).toMatch(/data-rotate-y="0"/);
  });

  test('none typography is a no-op without throwing', () => {
    const d = lookup('typography', 'none');
    const cleanup = d.apply(makeCtx());
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  test.each([
    'typewriter', 'word_by_word_fade', 'scramble_decode',
    'letters_from_edges', 'glitch_chromatic', 'neon_glow_pulse', 'ink_write',
  ])('typography effect "%s" mounts and cleans up without throwing', (name) => {
    const d = lookup('typography', name);
    expect(d).not.toBeNull();
    const ctx = makeCtx();
    const cleanup = d.apply(ctx);
    expect(typeof cleanup).toBe('function');
    cleanup();
  });

  test.each(['dissolve', 'ink_bleed', 'shatter_rebuild'])(
    'transition effect "%s" mounts and cleans up',
    (name) => {
      const d = lookup('transition', name);
      expect(d).not.toBeNull();
      const cleanup = d.apply(makeCtx());
      expect(typeof cleanup).toBe('function');
      cleanup();
    },
  );

  test.each(['starfield_parallax', 'dust_motes', 'ink_wash', 'cinema_letterbox'])(
    'background effect "%s" mounts and cleans up',
    (name) => {
      const d = lookup('background', name);
      expect(d).not.toBeNull();
      const cleanup = d.apply(makeCtx());
      expect(typeof cleanup).toBe('function');
      cleanup();
    },
  );
});
