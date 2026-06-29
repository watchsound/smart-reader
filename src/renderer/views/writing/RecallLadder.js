import React, { useMemo, useState } from 'react';
import { Box, Typography, Tooltip, Fade } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { RUNGS } from './config';
import MaskedToken from './MaskedToken';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function tokenize(text) {
  const re = /\$\{(.*?)\}/g;
  const out = [];
  let last = 0;
  let m = re.exec(text);
  while (m !== null) {
    if (m.index > last) {
      out.push({ kind: 'text', value: text.slice(last, m.index) });
    }
    out.push({ kind: 'mask', value: m[1] });
    last = re.lastIndex;
    m = re.exec(text);
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
  return out;
}

function RecallLadder({ variants, loading, accent, onContinue }) {
  const theme = useTheme();
  const [activeRung, setActiveRung] = useState('light');
  const [rungProgress, setRungProgress] = useState({
    light: 0,
    medium: 0,
    hard: 0,
  });

  const masked = variants[activeRung] || '';
  const tokens = useMemo(() => tokenize(masked), [masked]);
  const totalMasks = tokens.filter((t) => t.kind === 'mask').length;
  const resolved = rungProgress[activeRung] || 0;

  const handleResolved = () => {
    setRungProgress((prev) => ({
      ...prev,
      [activeRung]: (prev[activeRung] || 0) + 1,
    }));
  };

  const mediumStarted = (rungProgress.medium || 0) > 0;

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderLeft: `4px solid ${accent}`,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 1.5,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {RUNGS.map((rung) => {
            const isActive = rung.id === activeRung;
            const done = rungProgress[rung.id] || 0;
            return (
              <Tooltip key={rung.id} title={rung.blurb} arrow>
                <Box
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveRung(rung.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 999,
                    cursor: 'pointer',
                    bgcolor: isActive ? alpha(accent, 0.12) : 'transparent',
                    color: isActive ? accent : theme.palette.text.primary,
                    border: `1px solid ${isActive ? accent : 'transparent'}`,
                    '&:hover': {
                      bgcolor: isActive
                        ? alpha(accent, 0.16)
                        : alpha(accent, 0.06),
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '0.9rem' }}>
                    {done > 0 ? rung.glyphEngaged : '○'}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {rung.label}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            color: theme.palette.text.secondary,
          }}
        >
          {resolved} / {totalMasks}
          {resolved === totalMasks && totalMasks > 0 ? '  ✓' : ''}
        </Typography>
      </Box>

      <Box
        sx={{
          p: 3,
          fontFamily: SERIF,
          fontSize: '18px',
          lineHeight: 2,
          maxWidth: 680,
          minHeight: 200,
          color: theme.palette.text.primary,
        }}
      >
        {loading ? (
          <Typography color="text.secondary">Preparing ladder…</Typography>
        ) : (
          <Fade in key={activeRung} timeout={200}>
            <Box>
              {tokens.map((t, i) =>
                t.kind === 'text' ? (
                  // eslint-disable-next-line react/no-array-index-key
                  <span key={`t${i}`}>{t.value}</span>
                ) : (
                  <MaskedToken
                    // eslint-disable-next-line react/no-array-index-key
                    key={`m${i}-${activeRung}`}
                    expected={t.value}
                    accent={accent}
                    onResolved={handleResolved}
                  />
                ),
              )}
            </Box>
          </Fade>
        )}
      </Box>

      <Box
        sx={{
          px: 3,
          py: 1.5,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 2,
        }}
      >
        <Typography
          component="button"
          onClick={onContinue}
          sx={{
            fontFamily: MONO,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            border: 'none',
            borderRadius: 1,
            background: accent,
            color: '#fff',
            cursor: 'pointer',
            px: 2,
            py: 0.75,
            boxShadow: mediumStarted
              ? `0 0 0 4px ${alpha(accent, 0.25)}`
              : 'none',
            transition: 'box-shadow 250ms ease-out',
          }}
        >
          Continue to Compose →
        </Typography>
      </Box>
    </Box>
  );
}

export default RecallLadder;
