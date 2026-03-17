import { useCallback, useRef } from 'react';

/**
 * Custom hook for detecting long press vs click interactions.
 *
 * @param {Function} onLongPress - Callback triggered on long press
 * @param {Function} onClick - Callback triggered on regular click
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Time in ms to trigger long press (default: 1000)
 * @returns {Object} Event handlers to spread on the target element
 */
export function useLongPress(onLongPress, onClick, { threshold = 1000 } = {}) {
  const timerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const isPressedRef = useRef(false);

  const start = useCallback(
    (e) => {
      // Prevent default to avoid text selection on long press
      if (e.type === 'mousedown') {
        e.preventDefault();
      }

      isPressedRef.current = true;
      isLongPressRef.current = false;

      timerRef.current = setTimeout(() => {
        if (isPressedRef.current) {
          isLongPressRef.current = true;
          onLongPress?.(e);
        }
      }, threshold);
    },
    [onLongPress, threshold],
  );

  const clear = useCallback(
    (e, shouldTriggerClick = true) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Only trigger click if it was a short press and we should trigger
      if (
        shouldTriggerClick &&
        isPressedRef.current &&
        !isLongPressRef.current
      ) {
        onClick?.(e);
      }

      isPressedRef.current = false;
    },
    [onClick],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isPressedRef.current = false;
    isLongPressRef.current = false;
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: (e) => clear(e, true),
    onMouseLeave: (e) => clear(e, false),
    onTouchStart: start,
    onTouchEnd: (e) => clear(e, true),
    onTouchCancel: cancel,
    // Prevent context menu on long press
    onContextMenu: (e) => {
      if (isLongPressRef.current) {
        e.preventDefault();
      }
    },
  };
}

export default useLongPress;
