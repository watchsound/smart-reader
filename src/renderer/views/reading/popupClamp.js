/**
 * clampPopupPosition — keep the annotation popover inside the viewport.
 *
 * The reader places the annotation popover relative to the user's
 * mouseup point. For selections near the bottom (or right) of the
 * viewport the raw position lets the popover hang off-screen — the
 * Quick Note expansion makes it worse because the panel grows tall.
 *
 * This helper takes the desired position plus the panel's MAX size
 * (expanded state) and returns a clamped {top, left} that keeps the
 * whole panel inside the viewport with a small margin.
 *
 * If the viewport is smaller than the panel, the panel is anchored
 * at the margin — partial overflow is accepted (better top-visible
 * than centered-off-screen).
 */
export function clampPopupPosition({
  desiredTop,
  desiredLeft,
  panelMaxHeight,
  panelWidth,
  viewportHeight,
  viewportWidth,
  margin = 16,
}) {
  // Compute the highest allowed top (anchor) such that
  // top + panelMaxHeight + margin <= viewportHeight.
  const maxTop = viewportHeight - panelMaxHeight - margin;
  const maxLeft = viewportWidth - panelWidth - margin;

  const top = Math.max(margin, Math.min(desiredTop, maxTop));
  const left = Math.max(margin, Math.min(desiredLeft, maxLeft));

  return { top, left };
}

export default clampPopupPosition;
