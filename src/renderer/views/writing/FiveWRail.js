import React, { useState } from 'react';
import { Box, Typography, Collapse, IconButton } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const SLOTS = [
  { key: 'who', label: 'Who', icon: '👤' },
  { key: 'what', label: 'What', icon: '📝' },
  { key: 'when', label: 'When', icon: '🕐' },
  { key: 'where', label: 'Where', icon: '📍' },
  { key: 'why', label: 'Why', icon: '💡' },
];

// Normalize the LLM response into an array of scenes. The prompt asks
// for per-sentence 5W, so we expect `data: [{ sentenceIndex, who, what, ... }]`.
function allScenes(data) {
  if (!data) return [];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') return [data];
  return [];
}

function FiveWRail({ lang5w, accent }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const scenes = allScenes(lang5w);
  const sceneCount = scenes.length;

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
          }}
        >
          {sceneCount === 0
            ? 'no scenes detected'
            : `${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'} — click to expand`}
        </Typography>
        <IconButton size="small">
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {scenes.map((scene, sIdx) => (
            <Box
              // eslint-disable-next-line react/no-array-index-key
              key={`scene-${sIdx}`}
              sx={{
                opacity: 0,
                animation: `${fadeInUp} 280ms ease-out ${Math.min(
                  sIdx * 60,
                  600,
                )}ms forwards`,
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: accent,
                  mb: 0.75,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Sentence {scene.sentenceIndex !== undefined ? scene.sentenceIndex + 1 : sIdx + 1}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 1,
                }}
              >
                {SLOTS.map(({ key, label, icon }) => (
                  <Box
                    key={key}
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      bgcolor: alpha(accent, 0.08),
                      border: `1px solid ${alpha(accent, 0.15)}`,
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: MONO,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: accent,
                        mb: 0.25,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      {icon} {label}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.8rem',
                        color: theme.palette.text.primary,
                      }}
                    >
                      {scene[key] || '—'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default FiveWRail;
