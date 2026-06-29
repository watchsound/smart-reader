import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import DiffSpan from './DiffSpan';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

// Find non-overlapping span occurrences in `text`. Returns
// { start, end, kind, pairId } sorted by start, first-wins for overlap.
function locateSpans(text, sideSpans) {
  const found = sideSpans.reduce((acc, s) => {
    const idx = text.indexOf(s.text);
    if (idx >= 0) {
      acc.push({
        start: idx,
        end: idx + s.text.length,
        kind: s.kind,
        pairId: s.pair_id || null,
      });
    }
    return acc;
  }, []);
  found.sort((a, b) => a.start - b.start);
  const out = [];
  let lastEnd = -1;
  found.forEach((f) => {
    if (f.start >= lastEnd) {
      out.push(f);
      lastEnd = f.end;
    }
  });
  return out;
}

function renderSide(text, sideSpans, fontStack, hoveredPairId, onHoverPair) {
  const spans = locateSpans(text, sideSpans);
  const out = [];
  let last = 0;
  spans.forEach((s, i) => {
    if (s.start > last) {
      // eslint-disable-next-line react/no-array-index-key
      out.push(<span key={`t${i}`}>{text.slice(last, s.start)}</span>);
    }
    out.push(
      <DiffSpan
        // eslint-disable-next-line react/no-array-index-key
        key={`s${i}`}
        kind={s.kind}
        pairId={s.pairId}
        hoveredPairId={hoveredPairId}
        onHoverPair={onHoverPair}
      >
        {text.slice(s.start, s.end)}
      </DiffSpan>,
    );
    last = s.end;
  });
  if (last < text.length) out.push(<span key="tend">{text.slice(last)}</span>);
  return (
    <Box sx={{ fontFamily: fontStack, fontSize: '17px', lineHeight: 1.8 }}>
      {out}
    </Box>
  );
}

function ExpressionDiffPanel({ original, learner, diff, accent }) {
  const theme = useTheme();
  const [hoveredPairId, setHoveredPairId] = useState(null);
  const originalSpans = (diff?.spans || []).filter(
    (s) => s.side === 'original',
  );
  const learnerSpans = (diff?.spans || []).filter((s) => s.side === 'learner');
  const upgradeCount = (diff?.notes || []).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
        }}
      >
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
              px: 2,
              py: 1,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              ORIGINAL
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {renderSide(
              original,
              originalSpans,
              SERIF,
              hoveredPairId,
              setHoveredPairId,
            )}
          </Box>
        </Box>

        <Box
          sx={{
            bgcolor: theme.palette.background.paper,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            borderLeft: `4px solid ${alpha(accent, 0.4)}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.7rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              YOUR VERSION
            </Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {renderSide(
              learner,
              learnerSpans,
              SANS,
              hoveredPairId,
              setHoveredPairId,
            )}
          </Box>
        </Box>
      </Box>

      {(diff?.notes || []).length > 0 && (
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
              alignItems: 'center',
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
              EXPRESSION NOTES
            </Typography>
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                color: theme.palette.text.secondary,
              }}
            >
              {upgradeCount} upgrade{upgradeCount === 1 ? '' : 's'}
            </Typography>
          </Box>
          {diff.notes.map((n) => {
            const isHovered = hoveredPairId === n.pair_id;
            return (
              <Box
                key={n.pair_id}
                onMouseEnter={() => setHoveredPairId(n.pair_id)}
                onMouseLeave={() => setHoveredPairId(null)}
                sx={{
                  borderLeft: `3px solid ${
                    isHovered ? accent : alpha(accent, 0.3)
                  }`,
                  pl: 1.5,
                  py: 1,
                  mb: 1,
                  bgcolor: isHovered ? alpha(accent, 0.04) : 'transparent',
                  transition: 'all 150ms ease-out',
                }}
              >
                <Typography sx={{ fontSize: '0.9rem' }}>
                  You: <em>&ldquo;{n.learner_phrase}&rdquo;</em> &nbsp;→&nbsp;
                  Original: <em>&ldquo;{n.original_phrase}&rdquo;</em>
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    color: theme.palette.text.secondary,
                    mt: 0.5,
                  }}
                >
                  {n.explanation}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default ExpressionDiffPanel;
