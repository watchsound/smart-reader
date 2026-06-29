import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { align } from './wordAlignment';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

// One zipped column = (A[i] on top, connector, B[i] on bottom).
// Both rows in the same column share width so the alignment lines up
// vertically — bioinformatics convention.
function AlignmentColumn({ a, b, theme }) {
  const isMatch = !a.gap && !b.gap && a.match;
  const isMismatch = !a.gap && !b.gap && !a.match;
  const isGap = a.gap || b.gap;

  // Per-side colors
  const colorFor = (token, fontStack) => {
    if (token.gap) {
      return {
        bg: 'transparent',
        fg: alpha(theme.palette.text.secondary, 0.55),
        border: `1px dashed ${alpha(theme.palette.text.secondary, 0.35)}`,
      };
    }
    if (isMatch) {
      return {
        bg: alpha(theme.palette.success.main, 0.12),
        fg: theme.palette.success.main,
        border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
      };
    }
    return {
      bg: alpha(theme.palette.warning.main, 0.14),
      fg: theme.palette.warning.main,
      border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
    };
  };

  // Connector between the two rows: solid for match, dashed for mismatch,
  // dotted-faint for gap. Carries the "are these aligned?" signal at a
  // glance without re-using color (which already encodes match/mismatch).
  let connector;
  if (isMatch) {
    connector = (
      <Box
        sx={{
          height: 2,
          mx: 'auto',
          width: '70%',
          bgcolor: theme.palette.success.main,
          borderRadius: 1,
          my: 0.5,
        }}
      />
    );
  } else if (isMismatch) {
    connector = (
      <Box
        sx={{
          height: 0,
          mx: 'auto',
          width: '70%',
          borderTop: `1.5px dashed ${alpha(theme.palette.warning.main, 0.7)}`,
          my: 0.5,
        }}
      />
    );
  } else {
    connector = (
      <Box
        sx={{
          height: 0,
          mx: 'auto',
          width: '40%',
          borderTop: `1px dotted ${alpha(theme.palette.text.secondary, 0.35)}`,
          my: 0.5,
        }}
      />
    );
  }

  const cellSx = (token, palette, fontStack) => ({
    fontFamily: fontStack,
    fontSize: '0.95rem',
    fontWeight: token.gap ? 400 : isMatch ? 600 : 500,
    px: '6px',
    py: '2px',
    borderRadius: '4px',
    bgcolor: palette.bg,
    color: palette.fg,
    border: palette.border,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  });

  const paletteA = colorFor(a, SERIF);
  const paletteB = colorFor(b, SANS);

  return (
    <Box
      sx={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        mx: '2px',
        my: '4px',
        minWidth: '2.2ch',
      }}
    >
      <Box component="span" sx={cellSx(a, paletteA, SERIF)}>
        {a.gap ? '—' : a.word}
      </Box>
      {connector}
      <Box component="span" sx={cellSx(b, paletteB, SANS)}>
        {b.gap ? '—' : b.word}
      </Box>
    </Box>
  );
}

function AlignmentView({ original, learner, accent }) {
  const theme = useTheme();
  const result = useMemo(
    () => align(original || '', learner || ''),
    [original, learner],
  );
  const { alignedA, alignedB, score, totalA, totalB } = result;

  const aligned = alignedA.length;
  if (aligned === 0) return null;

  const matchCount = alignedA.reduce(
    (n, t, i) => (t.match && alignedB[i].match ? n + 1 : n),
    0,
  );
  const denom = Math.max(totalA, totalB) || 1;
  const overlapPct = Math.round((matchCount / denom) * 100);

  return (
    <Box
      sx={{
        bgcolor: theme.palette.background.paper,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        p: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          mb: 1.5,
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
          WORD ALIGNMENT (NEEDLEMAN–WUNSCH)
        </Typography>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            color: theme.palette.text.secondary,
          }}
        >
          {matchCount} matches · {aligned} aligned · {overlapPct}% overlap ·
          score {score}
        </Typography>
      </Box>

      {/* Side labels run as small chips down the left side; the columns
          themselves are flex-wrapped so long alignments wrap to new lines
          without breaking the per-column A-above-B integrity. */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            pt: '6px',
            minWidth: 56,
          }}
        >
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: theme.palette.text.secondary,
            }}
          >
            ORIGINAL
          </Typography>
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: '0.65rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: theme.palette.text.secondary,
              mt: 3.5,
            }}
          >
            YOURS
          </Typography>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          {alignedA.map((a, i) => (
            <AlignmentColumn
              // eslint-disable-next-line react/no-array-index-key
              key={`col-${i}`}
              a={a}
              b={alignedB[i]}
              theme={theme}
            />
          ))}
        </Box>
      </Box>

      <Typography
        sx={{
          mt: 1.5,
          fontFamily: MONO,
          fontSize: '0.65rem',
          color: theme.palette.text.secondary,
        }}
      >
        Solid green bar = match · Dashed amber = mismatch · Dotted faint =
        gap (insertion / deletion). Each column zips one word of the
        original above its aligned counterpart in your version.
      </Typography>
    </Box>
  );
}

export default AlignmentView;
