/**
 * clampPopupPosition — viewport-aware popup positioning.
 *
 * Pins the annotation popover positioning math: the panel must always
 * fit inside the viewport with a small margin, even (a) when the
 * selection is near the bottom edge and (b) when the panel later
 * expands its Quick Note section. The clamp is computed against the
 * panel's MAX height (expanded state), not its current height — MUI
 * Popover does not reposition itself when its content grows.
 *
 * @jest-environment node
 */

const { clampPopupPosition } = require('../../renderer/views/reading/popupClamp');

const VIEWPORT = { viewportHeight: 1000, viewportWidth: 1400 };
const PANEL = { panelMaxHeight: 600, panelWidth: 320 };

describe('clampPopupPosition', () => {
  it('returns the desired position when it fits with room to spare', () => {
    expect(
      clampPopupPosition({
        desiredTop: 200,
        desiredLeft: 300,
        ...PANEL,
        ...VIEWPORT,
      }),
    ).toEqual({ top: 200, left: 300 });
  });

  it('clamps top so the panel (at MAX height) does not run past viewport bottom', () => {
    // Selection at y=900 in a 1000-tall viewport; raw popup would extend
    // to 900 + 600 = 1500, past the viewport. Clamp pulls it up to
    // 1000 - 600 - 16 = 384.
    const { top } = clampPopupPosition({
      desiredTop: 900,
      desiredLeft: 100,
      ...PANEL,
      ...VIEWPORT,
    });
    expect(top).toBe(384);
  });

  it('clamps left so the panel does not run past viewport right edge', () => {
    // Selection at x=1300 in a 1400-wide viewport; raw popup at 1300 + 320
    // = 1620 overflows. Clamp pulls it to 1400 - 320 - 16 = 1064.
    const { left } = clampPopupPosition({
      desiredTop: 100,
      desiredLeft: 1300,
      ...PANEL,
      ...VIEWPORT,
    });
    expect(left).toBe(1064);
  });

  it('respects the margin at the top edge (never goes negative)', () => {
    // Desired top above the margin — clamp up to margin.
    expect(
      clampPopupPosition({
        desiredTop: 5,
        desiredLeft: 100,
        ...PANEL,
        ...VIEWPORT,
      }).top,
    ).toBe(16);
  });

  it('respects the margin at the left edge', () => {
    expect(
      clampPopupPosition({
        desiredTop: 100,
        desiredLeft: -50,
        ...PANEL,
        ...VIEWPORT,
      }).left,
    ).toBe(16);
  });

  it('degenerates to top-margin when viewport is shorter than panel', () => {
    // 400-tall viewport but 600-tall panel. Nothing we can do but anchor
    // at the top margin; overflow is unavoidable.
    expect(
      clampPopupPosition({
        desiredTop: 300,
        desiredLeft: 200,
        ...PANEL,
        viewportHeight: 400,
        viewportWidth: 1400,
      }).top,
    ).toBe(16);
  });

  it('uses the configurable margin (defaults to 16)', () => {
    const { top } = clampPopupPosition({
      desiredTop: 900,
      desiredLeft: 100,
      ...PANEL,
      ...VIEWPORT,
      margin: 32,
    });
    // 1000 - 600 - 32 = 368.
    expect(top).toBe(368);
  });
});
