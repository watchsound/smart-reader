/**
 * selectionCommitter — drag-select state machine.
 *
 * Pins the invariant that motivated this module: mid-drag pauses fire
 * extra `selected` events (epub.js debounces selectionchange into them),
 * but only the FINAL cfiRange — the one in effect at mouseup — should
 * commit. Pre-fix, EPubView committed on every `selected`, stacking
 * orphan highlight annotations into the document and wiping the
 * native drag-select visual.
 *
 * @jest-environment node
 */

const {
  createSelectionCommitter,
} = require('../../renderer/views/reading/selectionCommitter');

describe('selectionCommitter', () => {
  it('returns null on mouseup with no prior mousedown', () => {
    const c = createSelectionCommitter();
    expect(c.onMouseUp({ x: 50, y: 50 }, 8)).toBeNull();
  });

  it('returns null when drag distance is below the threshold (treated as click)', () => {
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    c.onSelected('cfi/range/1', { window: {} });
    // 2px diagonal: dx^2 + dy^2 = 1 + 1 = 2 < 8
    expect(c.onMouseUp({ x: 11, y: 11 }, 8)).toBeNull();
  });

  it('returns null when mousedown happened but selected never fired', () => {
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    // dx=20, dy=0 → 400 > 8 (drag-sized motion), but no selection
    expect(c.onMouseUp({ x: 30, y: 10 }, 8)).toBeNull();
  });

  it('commits the latest cfiRange when drag distance exceeds threshold', () => {
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    c.onSelected('cfi/range/1', { window: { id: 'w' } });
    const result = c.onMouseUp({ x: 50, y: 50 }, 8);
    expect(result).not.toBeNull();
    expect(result.cfiRange).toBe('cfi/range/1');
    expect(result.contents.window.id).toBe('w');
  });

  it('keeps ONLY the last cfiRange when selected fires multiple times mid-drag', () => {
    // This is the bug regression: pre-fix, every `selected` event triggered
    // an annotation add. After this fix, only the last one survives to mouseup.
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    c.onSelected('cfi/range/short', { window: {} });
    c.onSelected('cfi/range/medium', { window: {} });
    c.onSelected('cfi/range/long', { window: {} });
    const result = c.onMouseUp({ x: 100, y: 100 }, 8);
    expect(result.cfiRange).toBe('cfi/range/long');
  });

  it('clears pending after a commit (next drag without selection returns null)', () => {
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    c.onSelected('cfi/range/first', { window: {} });
    expect(c.onMouseUp({ x: 50, y: 50 }, 8).cfiRange).toBe('cfi/range/first');

    // Second drag without any selected event — must NOT replay the first.
    c.onMouseDown({ x: 0, y: 0 });
    expect(c.onMouseUp({ x: 40, y: 40 }, 8)).toBeNull();
  });

  it('a sub-threshold drag discards pending so the next drag starts clean', () => {
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    c.onSelected('cfi/leaked', { window: {} });
    expect(c.onMouseUp({ x: 11, y: 11 }, 8)).toBeNull(); // click — pending dropped

    c.onMouseDown({ x: 0, y: 0 });
    expect(c.onMouseUp({ x: 50, y: 50 }, 8)).toBeNull(); // no carryover
  });

  it('mousedown clears any stale pending from a prior abandoned drag', () => {
    const c = createSelectionCommitter();
    c.onMouseDown({ x: 10, y: 10 });
    c.onSelected('cfi/stale', { window: {} });
    // No mouseup — user wandered off; a new drag begins.
    c.onMouseDown({ x: 100, y: 100 });
    expect(c._peek().pending).toBeNull();
    expect(c.onMouseUp({ x: 200, y: 200 }, 8)).toBeNull();
  });
});
