import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import MultilineTextField from './MultilineTextField';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const lockPulse = (color) => keyframes`
  0%   { box-shadow: 0 0 0 0 ${alpha(color, 0)}; }
  40%  { box-shadow: 0 0 0 6px ${alpha(color, 0.35)}; }
  100% { box-shadow: 0 0 0 0 ${alpha(color, 0)}; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateX(4px); }
  to   { opacity: 1; transform: translateX(0); }
`;

function SourcePanel({
  text,
  onTextChange,
  sourceLocked,
  onLock,
  onUnlock,
  accent,
  label = 'SOURCE PARAGRAPH',
  placeholder = 'Paste a paragraph you want to learn from. The model text is the anchor for the next two phases.',
}) {
  const theme = useTheme();
  const trimmed = (text || '').trim();
  const canLock = trimmed.length > 0;

  // Pulse the panel briefly on the locked transition.
  const prevLockedRef = useRef(sourceLocked);
  const [pulsing, setPulsing] = useState(false);
  useEffect(() => {
    if (!prevLockedRef.current && sourceLocked) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 700);
      prevLockedRef.current = sourceLocked;
      return () => clearTimeout(t);
    }
    prevLockedRef.current = sourceLocked;
    return undefined;
  }, [sourceLocked]);

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderLeft: `4px solid ${accent}`,
        overflow: 'hidden',
        position: 'relative',
        animation: pulsing ? `${lockPulse(accent)} 700ms ease-out` : 'none',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.palette.text.secondary,
          }}
        >
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            key={sourceLocked ? 'locked' : 'unlocked'}
            sx={{
              fontFamily: MONO,
              fontSize: '0.72rem',
              color: sourceLocked ? accent : theme.palette.text.disabled,
              animation: `${fadeIn} 250ms ease-out`,
            }}
          >
            {sourceLocked ? '○ LOCKED' : '● UNLOCKED'}
          </Typography>
          {sourceLocked ? (
            <Tooltip title="Edit source">
              <IconButton size="small" onClick={onUnlock}>
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      </Box>

      <Box
        sx={{
          p: 2.5,
          fontFamily: SERIF,
          fontSize: '18px',
          lineHeight: 1.8,
          color: theme.palette.text.primary,
        }}
      >
        <MultilineTextField
          initialText={text}
          placeholder={placeholder}
          onTextChange={sourceLocked ? () => {} : onTextChange}
          colors={{ accent }}
          minimal
        />
      </Box>

      {!sourceLocked && (
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Typography
            component="button"
            disabled={!canLock}
            onClick={canLock ? onLock : undefined}
            sx={{
              fontFamily: MONO,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              border: 'none',
              borderRadius: 1,
              background: canLock ? accent : alpha(accent, 0.3),
              color: '#fff',
              cursor: canLock ? 'pointer' : 'not-allowed',
              px: 2,
              py: 0.75,
              opacity: canLock ? 1 : 0.5,
            }}
          >
            Continue →
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default SourcePanel;
