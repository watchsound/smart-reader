import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import { PHASES } from './config';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function PhaseTabBar({ activePhase, sourceLocked, onChange, accent }) {
  const theme = useTheme();

  return (
    <Box
      role="tablist"
      aria-label="Writing Practice phases"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 3,
        py: 2,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: theme.palette.background.paper,
      }}
    >
      {PHASES.map((phase, idx) => {
        const isActive = phase.id === activePhase;
        const isLocked = idx > 0 && !sourceLocked;

        return (
          <Tooltip
            key={phase.id}
            title={isLocked ? 'Lock the source paragraph first' : phase.blurb}
            arrow
          >
            <Box
              role="tab"
              aria-selected={isActive}
              aria-disabled={isLocked}
              onClick={() => {
                if (isLocked) return;
                onChange(phase.id);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                borderRadius: 999,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.3 : 1,
                bgcolor: isActive ? alpha(accent, 0.12) : 'transparent',
                color: isActive ? accent : theme.palette.text.primary,
                border: `1px solid ${isActive ? accent : 'transparent'}`,
                transition: 'all 200ms ease-out',
                '&:hover': {
                  // eslint-disable-next-line no-nested-ternary
                  bgcolor: isLocked
                    ? 'transparent'
                    : isActive
                      ? alpha(accent, 0.16)
                      : alpha(accent, 0.06),
                },
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {phase.meta}
              </Typography>
              {isLocked ? <LockIcon sx={{ fontSize: 14 }} /> : null}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

export default PhaseTabBar;
