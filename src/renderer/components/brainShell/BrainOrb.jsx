/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
import React, { useState } from 'react';
import { Box, Tooltip, Zoom } from '@mui/material';
import {
  ORB_KEYFRAMES,
  ORB_SIZE_PX,
  CLICK_PRESS_SCALE,
  CLICK_PRESS_DURATION_MS,
  STATE_TRANSITION_MS,
  ORB_RING_ANIMATION,
  ORB_BADGE_ANIMATION,
  getOrbColor,
  getOrbAnimation,
} from './orbAnimations';

/**
 * BrainOrb — single ambient indicator reflecting Brain state.
 *
 * Five state variants (idle / thinking / has-proposal / mid-flow /
 * uncertain) drive base color, ring overlay, and per-state keyframe
 * animation. The animation grammar lives in `./orbAnimations` so the
 * orb component stays declarative and the keyframes are testable in
 * isolation. (animation-core is a text/word effect system — not a fit
 * for a 24-px ambient indicator; see orbAnimations.js for the why.)
 *
 * Micro-interactions polished beyond the v1 surface:
 *   - has-proposal blooms once and settles into a slow breathing pulse
 *   - mid-flow ring rotates (slow, 8 s/turn) so the state reads as live
 *   - uncertain wobbles + opacity-drifts instead of binary flicker
 *   - queue-depth badge scales/fades in via Zoom + keyframe entrance
 *   - clicking the orb scales it down briefly for tactile feedback
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').OrbState} props.state
 * @param {number} [props.queueDepth=0]
 * @param {() => void} [props.onClick]
 * @param {(e: React.MouseEvent) => void} [props.onContextMenu]
 */
export default function BrainOrb({
  state,
  queueDepth = 0,
  onClick,
  onContextMenu,
}) {
  const [pressed, setPressed] = useState(false);
  const stateClass = `orb-${state}`;
  const label = `Brain — ${state}${
    queueDepth > 1 ? ` (${queueDepth} pending)` : ''
  }`;
  const { base, ring } = getOrbColor(state);
  const animation = getOrbAnimation(state);

  // Tactile press feedback. Reset on mouseup/leave so a dragged-off press
  // can't strand the orb in the pressed-down scale.
  const press = () => setPressed(true);
  const release = () => setPressed(false);

  return (
    <Tooltip title={label} placement="bottom">
      <Box
        role="button"
        aria-label={label}
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseDown={press}
        onMouseUp={release}
        onMouseLeave={release}
        onBlur={release}
        className={stateClass}
        sx={{
          position: 'relative',
          width: ORB_SIZE_PX,
          height: ORB_SIZE_PX,
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor: base,
          transform: pressed ? `scale(${CLICK_PRESS_SCALE})` : 'scale(1)',
          transition: `background-color ${STATE_TRANSITION_MS}ms ease, transform ${CLICK_PRESS_DURATION_MS}ms ease`,
          animation: animation || 'none',
          ...ORB_KEYFRAMES,
        }}
      >
        {queueDepth > 1 && (
          <Zoom in mountOnEnter unmountOnExit>
            <Box
              role="status"
              sx={{
                position: 'absolute',
                top: -6,
                right: -6,
                minWidth: 16,
                height: 16,
                borderRadius: '8px',
                backgroundColor: '#ff5252',
                color: '#fff',
                fontSize: 10,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                animation: ORB_BADGE_ANIMATION,
                ...ORB_KEYFRAMES,
              }}
            >
              {queueDepth}
            </Box>
          </Zoom>
        )}
        {ring && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: -3,
              left: -3,
              right: -3,
              bottom: -3,
              borderRadius: '50%',
              border: `2px solid ${ring}`,
              borderTopColor: 'transparent',
              animation: ORB_RING_ANIMATION,
              ...ORB_KEYFRAMES,
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
