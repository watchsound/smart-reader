/**
 * createSelectionCommitter
 *
 * Tiny state machine that defers EPUB text-selection side effects from
 * epub.js's `selected` event (which fires on every selectionchange,
 * including mid-drag pauses) to the actual `mouseup` that ends the drag.
 *
 * Why this exists:
 *   Before this, EPubView did the highlight-add + state-set + native-
 *   selection-clear inside the `selected` handler. Pausing mid-drag
 *   triggered all of those: orphan highlights got stacked into the
 *   document, the native selection visual was wiped, and the eventual
 *   mouseup dialog only knew how to clean up the LAST cfiRange — the
 *   intermediate highlights leaked permanently.
 *
 * Contract:
 *   - onMouseDown(point): records drag origin; clears any pending selection
 *   - onSelected(cfiRange, contents): records the latest selection candidate
 *   - onMouseUp(point, minDistSq):
 *       returns the pending selection if (a) the drag moved > sqrt(minDistSq)
 *       pixels AND (b) onSelected fired at least once since mousedown;
 *       returns null otherwise.
 *
 * The caller (EPubView) does all the DOM/state work in response to the
 * returned commit — annotation add, native-selection clear, dialog open.
 */
export function createSelectionCommitter() {
  let mouseDownLoc = null;
  let pending = null;

  return {
    onMouseDown(point) {
      mouseDownLoc = point;
      pending = null;
    },
    onSelected(cfiRange, contents) {
      pending = { cfiRange, contents };
    },
    onMouseUp(point, minDistSq) {
      const loc = mouseDownLoc;
      mouseDownLoc = null;
      if (!loc) {
        pending = null;
        return null;
      }
      const dx = loc.x - point.x;
      const dy = loc.y - point.y;
      if (dx * dx + dy * dy < minDistSq) {
        pending = null;
        return null;
      }
      const committed = pending;
      pending = null;
      return committed;
    },
    // Test/inspection helper — not used by EPubView.
    _peek() {
      return { mouseDownLoc, pending };
    },
  };
}

export default createSelectionCommitter;
