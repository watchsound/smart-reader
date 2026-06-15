import React from 'react';
import { Box, Tooltip } from '@mui/material';

/**
 * BrainOrb — single ambient indicator reflecting Brain state.
 * Five visual variants live in `orb-{state}` classes and inline `sx`.
 * Plan 1: minimal styling; animation-core polish is Plan 2.
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
  const stateClass = `orb-${state}`;
  const label = `Brain — ${state}${
    queueDepth > 1 ? ` (${queueDepth} pending)` : ''
  }`;

  return (
    <Tooltip title={label} placement="bottom">
      <Box
        role="button"
        aria-label={label}
        tabIndex={0}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={stateClass}
        sx={{
          position: 'relative',
          width: 24,
          height: 24,
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor:
            {
              idle: '#c8c8c8',
              thinking: '#9bb8ff',
              'has-proposal': '#6c8cff',
              'mid-flow': '#4a6bff',
              uncertain: '#ffb14a',
            }[state] || '#c8c8c8',
          transition: 'background-color 200ms ease, transform 200ms ease',
          animation:
            {
              thinking: 'orb-pulse 1.4s ease-in-out infinite',
              'has-proposal': 'orb-bloom 0.6s ease-out',
              uncertain: 'orb-flicker 0.9s ease-in-out infinite',
            }[state] || 'none',
          '@keyframes orb-pulse': {
            '0%, 100%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.15)' },
          },
          '@keyframes orb-bloom': {
            '0%': { transform: 'scale(1)' },
            '50%': { transform: 'scale(1.3)' },
            '100%': { transform: 'scale(1)' },
          },
          '@keyframes orb-flicker': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.6 },
          },
        }}
      >
        {queueDepth > 1 && (
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
            }}
          >
            {queueDepth}
          </Box>
        )}
        {state === 'mid-flow' && (
          <Box
            sx={{
              position: 'absolute',
              top: -3,
              left: -3,
              right: -3,
              bottom: -3,
              borderRadius: '50%',
              border: '2px solid rgba(74,107,255,0.4)',
            }}
          />
        )}
      </Box>
    </Tooltip>
  );
}
