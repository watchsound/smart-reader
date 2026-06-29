import React from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import MultilineTextField from './MultilineTextField';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function SourcePanel({
  text,
  onTextChange,
  sourceLocked,
  onLock,
  onUnlock,
  accent,
}) {
  const theme = useTheme();
  const placeholder =
    'Paste a paragraph you want to learn from. The model text is the anchor for the next two phases.';
  const trimmed = (text || '').trim();
  const canLock = trimmed.length > 0;

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderLeft: `4px solid ${accent}`,
        overflow: 'hidden',
        position: 'relative',
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
          SOURCE PARAGRAPH
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: '0.72rem',
              color: sourceLocked ? accent : theme.palette.text.disabled,
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
