import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import DiffSpan from './DiffSpan';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// Splits a text into sentence-sized chunks based on terminal punctuation
// followed by whitespace. Each chunk keeps its trailing whitespace so
// concatenation preserves the original text.
function splitSentences(text) {
  if (!text) return [];
  const out = [];
  const re = /[^.!?]*[.!?]+(?:\s+|$)|[^.!?]+$/g;
  let m = re.exec(text);
  while (m !== null) {
    if (m[0].length > 0) out.push(m[0]);
    m = re.exec(text);
  }
  if (out.length === 0) out.push(text);
  return out;
}

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

// Renders a slice of `text` from [sliceStart, sliceEnd) and applies any
// spans that fall within that slice. Spans straddling the slice boundary
// are kept whole and rendered in the slice that contains their start.
function renderSlice(
  text,
  sliceStart,
  sliceEnd,
  globalSpans,
  hoveredPairId,
  onHoverPair,
  keyPrefix,
) {
  const out = [];
  let cursor = sliceStart;
  globalSpans
    .filter((s) => s.start >= sliceStart && s.start < sliceEnd)
    .forEach((s, i) => {
      if (s.start > cursor) {
        out.push(
          // eslint-disable-next-line react/no-array-index-key
          <span key={`${keyPrefix}-t${i}`}>{text.slice(cursor, s.start)}</span>,
        );
      }
      out.push(
        <DiffSpan
          // eslint-disable-next-line react/no-array-index-key
          key={`${keyPrefix}-s${i}`}
          kind={s.kind}
          pairId={s.pairId}
          hoveredPairId={hoveredPairId}
          onHoverPair={onHoverPair}
        >
          {text.slice(s.start, s.end)}
        </DiffSpan>,
      );
      cursor = s.end;
    });
  if (cursor < sliceEnd) {
    out.push(
      <span key={`${keyPrefix}-tend`}>{text.slice(cursor, sliceEnd)}</span>,
    );
  }
  return out;
}

function renderSide(text, sideSpans, fontStack, hoveredPairId, onHoverPair) {
  const globalSpans = locateSpans(text, sideSpans);
  const sentences = splitSentences(text);
  let cursor = 0;
  return (
    <Box sx={{ fontFamily: fontStack, fontSize: '17px', lineHeight: 1.8 }}>
      {sentences.map((sentence, idx) => {
        const sliceStart = cursor;
        const sliceEnd = cursor + sentence.length;
        cursor = sliceEnd;
        const delayMs = Math.min(idx * 60, 600);
        return (
          <Box
            component="span"
            // eslint-disable-next-line react/no-array-index-key
            key={`sent-${idx}`}
            sx={{
              display: 'inline',
              opacity: 0,
              animation: `${fadeInUp} 350ms ease-out ${delayMs}ms forwards`,
            }}
          >
            {renderSlice(
              text,
              sliceStart,
              sliceEnd,
              globalSpans,
              hoveredPairId,
              onHoverPair,
              `${idx}`,
            )}
          </Box>
        );
      })}
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
