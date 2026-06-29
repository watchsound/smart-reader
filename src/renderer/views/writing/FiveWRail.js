import React, { useState } from 'react';
import { Box, Typography, Collapse, IconButton } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const SLOTS = [
  { key: 'who', label: 'Who', icon: '👤' },
  { key: 'what', label: 'What', icon: '📝' },
  { key: 'when', label: 'When', icon: '🕐' },
  { key: 'where', label: 'Where', icon: '📍' },
  { key: 'why', label: 'Why', icon: '💡' },
];

function firstScene(data) {
  if (!data) return null;
  if (Array.isArray(data?.data) && data.data.length > 0) return data.data[0];
  if (typeof data === 'object') return data;
  return null;
}

function FiveWRail({ lang5w, accent }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const scene = firstScene(lang5w);

  const inline = SLOTS.map((s) => {
    const val = scene && scene[s.key] ? scene[s.key] : '—';
    return `${s.label.toUpperCase()} ${val}`;
  }).join(' · ');

  return (
    <Box
      sx={{
        bgcolor: alpha(accent, 0.06),
        borderRadius: '14px',
        border: `1px solid ${alpha(accent, 0.2)}`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          cursor: 'pointer',
        }}
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
      >
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: accent,
          }}
        >
          SCENE (5W)
        </Typography>
        <Typography
          sx={{
            flex: 1,
            fontSize: '0.85rem',
            color: theme.palette.text.secondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {open ? '' : inline}
        </Typography>
        <IconButton size="small">
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            px: 2,
            pb: 2,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 1.5,
          }}
        >
          {SLOTS.map(({ key, label, icon }) => (
            <Box
              key={key}
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(accent, 0.08),
                border: `1px solid ${alpha(accent, 0.15)}`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: accent,
                  mb: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {icon} {label}
              </Typography>
              <Typography
                sx={{ fontSize: '0.85rem', color: theme.palette.text.primary }}
              >
                {(scene && scene[key]) || '—'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default FiveWRail;
