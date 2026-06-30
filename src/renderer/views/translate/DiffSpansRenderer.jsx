import React, { useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import DiffSpan from '../writing/DiffSpan';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

// Locate each span's first occurrence in text + drop overlaps that would
// double-paint the same character range.
function locate(text, sideSpans) {
  const located = sideSpans
    .map((s) => {
      const idx = text.indexOf(s.text);
      return idx >= 0 ? { ...s, start: idx, end: idx + s.text.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  for (const s of located) {
    if (s.start < cursor) continue; // drop overlap
    out.push(s);
    cursor = s.end;
  }
  return out;
}

function renderSide(text, sideSpans, fontStack, hoveredPairId, onHoverPair) {
  const located = locate(text, sideSpans);
  const out = [];
  let cursor = 0;
  located.forEach((s, i) => {
    if (s.start > cursor) {
      out.push(<span key={`t${i}`}>{text.slice(cursor, s.start)}</span>);
    }
    out.push(
      <DiffSpan
        key={`s${i}`}
        kind={s.kind || 'weaker'}
        bucket={s.bucket}
        pairId={s.pair_id}
        hoveredPairId={hoveredPairId}
        onHoverPair={onHoverPair}
      >
        {s.text}
      </DiffSpan>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) {
    out.push(<span key="tend">{text.slice(cursor)}</span>);
  }
  return (
    <Box sx={{ fontFamily: fontStack, fontSize: '17px', lineHeight: 1.8 }}>
      {out}
    </Box>
  );
}

function DiffSpansRenderer({ learnerText, modelText, spans }) {
  const theme = useTheme();
  const [hoveredPairId, setHoveredPairId] = useState(null);
  const learnerSpans = useMemo(
    () => (spans || []).filter((s) => s.side === 'learner'),
    [spans],
  );
  const modelSpans = useMemo(
    () => (spans || []).filter((s) => s.side === 'model'),
    [spans],
  );

  const SideBox = ({ title, font, text, sideSpans }) => (
    <Box
      sx={{
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: theme.palette.background.paper,
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
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.palette.text.secondary,
            fontWeight: 600,
          }}
        >
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        {renderSide(text, sideSpans, font, hoveredPairId, setHoveredPairId)}
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2,
      }}
    >
      <SideBox
        title="YOUR ENGLISH"
        font={SANS}
        text={learnerText}
        sideSpans={learnerSpans}
      />
      <SideBox
        title="MODEL ENGLISH"
        font={SERIF}
        text={modelText}
        sideSpans={modelSpans}
      />
    </Box>
  );
}

export default DiffSpansRenderer;
