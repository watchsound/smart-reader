import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { align } from './smithWaterman';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function WordCell({ token, accent, theme, fontStack }) {
  const isGap = token.gap;
  const isMatch = !isGap && token.match;
  const isMismatch = !isGap && !token.match;

  // Color semantics:
  //  match    → green tint
  //  mismatch → amber tint
  //  gap      → dashed grey box
  let bg = 'transparent';
  let color = theme.palette.text.primary;
  let border = `1px solid transparent`;
  if (isMatch) {
    bg = alpha(theme.palette.success.main, 0.12);
    color = theme.palette.success.main;
    border = `1px solid ${alpha(theme.palette.success.main, 0.3)}`;
  } else if (isMismatch) {
    bg = alpha(theme.palette.warning.main, 0.14);
    color = theme.palette.warning.main;
    border = `1px solid ${alpha(theme.palette.warning.main, 0.35)}`;
  } else if (isGap) {
    bg = 'transparent';
    color = alpha(theme.palette.text.secondary, 0.6);
    border = `1px dashed ${alpha(theme.palette.text.secondary, 0.4)}`;
  }

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-block',
        px: 0.75,
        py: 0.25,
        m: '2px',
        borderRadius: 1,
        fontFamily: fontStack,
        fontSize: '0.95rem',
        lineHeight: 1.5,
        backgroundColor: bg,
        color,
        border,
        fontWeight: isMatch ? 600 : 500,
      }}
    >
      {isGap ? '—' : token.word}
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

  const matchCount = alignedA.reduce(
    (n, t, i) => (t.match && alignedB[i].match ? n + 1 : n),
    0,
  );
  const aligned = alignedA.length;
  const denom = Math.max(totalA, totalB) || 1;
  const overlapPct = Math.round((matchCount / denom) * 100);

  if (aligned === 0) {
    return (
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          borderRadius: '14px',
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          p: 2,
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
            mb: 1,
          }}
        >
          WORD ALIGNMENT (SMITH–WATERMAN)
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
        >
          No locally-matching region between your version and the original.
        </Typography>
      </Box>
    );
  }

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
          WORD ALIGNMENT (SMITH–WATERMAN)
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

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
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
              minWidth: 70,
            }}
          >
            ORIGINAL
          </Typography>
          <Box sx={{ flex: 1, lineHeight: 0 }}>
            {alignedA.map((t, i) => (
              <WordCell
                // eslint-disable-next-line react/no-array-index-key
                key={`a-${i}`}
                token={t}
                accent={accent}
                theme={theme}
                fontStack={SERIF}
              />
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
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
              minWidth: 70,
            }}
          >
            YOURS
          </Typography>
          <Box sx={{ flex: 1, lineHeight: 0 }}>
            {alignedB.map((t, i) => (
              <WordCell
                // eslint-disable-next-line react/no-array-index-key
                key={`b-${i}`}
                token={t}
                accent={accent}
                theme={theme}
                fontStack={SANS}
              />
            ))}
          </Box>
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
        Green = matching word · Amber = mismatched word · Dashed — = gap
        (insertion / deletion). Shows only the best-scoring overlapping
        region — paraphrased segments outside the alignment are omitted.
      </Typography>
    </Box>
  );
}

export default AlignmentView;
