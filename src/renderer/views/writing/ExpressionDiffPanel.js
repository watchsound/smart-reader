import React, { useMemo, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import DiffSpan from './DiffSpan';
import {
  splitSentences,
  locateSpans,
  clipSpansToSlice,
} from './expressionDiffLayout';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const SANS = `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

// Renders a slice of `text` from [sliceStart, sliceEnd) with any spans
// that overlap the window clipped to the window. A span that straddles
// a sentence boundary is rendered as adjacent pieces in adjacent slices,
// each carrying the same pairId so hover still links them.
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
  const clipped = clipSpansToSlice(globalSpans, sliceStart, sliceEnd);
  clipped.forEach((s, i) => {
    if (s.effectiveStart > cursor) {
      out.push(
        // eslint-disable-next-line react/no-array-index-key
        <span key={`${keyPrefix}-t${i}`}>
          {text.slice(cursor, s.effectiveStart)}
        </span>,
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
        {text.slice(s.effectiveStart, s.effectiveEnd)}
      </DiffSpan>,
    );
    cursor = s.effectiveEnd;
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

// Render a single sentence with the spans that apply to it inlined as
// colored DiffSpans. Used by the sentence-by-sentence comparison rail so
// each sentence carries its own grammar squiggles + weaker/stronger
// highlights right where the eye is reading — not just up in the
// summary panel.
function renderSentenceInline({
  sentence,
  side,
  sentenceIndex,
  allSpans,
  hoveredPairId,
  onHoverPair,
  keyPrefix,
}) {
  if (!sentence) return null;
  // Filter spans for this side + this sentence. Prefer the LLM's
  // sentence_index when present; fall back to "the span's text appears
  // within this sentence" so older responses still highlight.
  const candidates = allSpans.filter((s) => {
    if (s.side !== side) return false;
    if (typeof s.sentence_index === 'number') {
      return s.sentence_index === sentenceIndex;
    }
    return typeof s.text === 'string' && sentence.includes(s.text);
  });
  if (candidates.length === 0) return sentence;
  // locate within just this sentence (positions are sentence-local).
  const located = candidates
    .map((s) => {
      const idx = sentence.indexOf(s.text);
      if (idx < 0) return null;
      return {
        start: idx,
        end: idx + s.text.length,
        kind: s.kind,
        pairId: s.pair_id || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  // Drop overlaps (first-wins).
  const nonOverlapping = [];
  let lastEnd = -1;
  located.forEach((s) => {
    if (s.start >= lastEnd) {
      nonOverlapping.push(s);
      lastEnd = s.end;
    }
  });
  const out = [];
  let cursor = 0;
  nonOverlapping.forEach((s, i) => {
    if (s.start > cursor) {
      out.push(
        // eslint-disable-next-line react/no-array-index-key
        <span key={`${keyPrefix}-t${i}`}>{sentence.slice(cursor, s.start)}</span>,
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
        {sentence.slice(s.start, s.end)}
      </DiffSpan>,
    );
    cursor = s.end;
  });
  if (cursor < sentence.length) {
    out.push(<span key={`${keyPrefix}-tend`}>{sentence.slice(cursor)}</span>);
  }
  return out;
}

function ExpressionDiffPanel({ original, learner, diff, accent }) {
  const theme = useTheme();
  const [hoveredPairId, setHoveredPairId] = useState(null);
  const allSpans = diff?.spans || [];
  const originalSpans = allSpans.filter((s) => s.side === 'original');
  const learnerSpans = allSpans.filter((s) => s.side === 'learner');
  // Sentence-grouped comparisons (new shape). Fall back to a single
  // "whole-paragraph" group built from the legacy flat notes if the
  // LLM response didn't supply sentence groupings (e.g. older response).
  const sentenceGroups = useMemo(() => {
    if (Array.isArray(diff?.sentenceComparisons) && diff.sentenceComparisons.length > 0) {
      return diff.sentenceComparisons;
    }
    const flat = diff?.notes || [];
    if (flat.length === 0) return [];
    return [
      {
        sentenceIndex: 0,
        originalSentence: '',
        learnerSentence: '',
        notes: flat,
      },
    ];
  }, [diff?.sentenceComparisons, diff?.notes]);

  const upgradeCount = sentenceGroups.reduce(
    (n, g) => n + (g.notes ? g.notes.length : 0),
    0,
  );

  // Find which sentence-group contains the currently-hovered note, then
  // reorder the group list so that group floats to the top.
  const orderedGroups = useMemo(() => {
    if (!hoveredPairId) return sentenceGroups;
    const idx = sentenceGroups.findIndex((g) =>
      g.notes?.some((n) => n.pair_id === hoveredPairId),
    );
    if (idx <= 0) return sentenceGroups;
    return [
      sentenceGroups[idx],
      ...sentenceGroups.slice(0, idx),
      ...sentenceGroups.slice(idx + 1),
    ];
  }, [sentenceGroups, hoveredPairId]);

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

      {sentenceGroups.length > 0 && (
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
          {orderedGroups.map((group, gIdx) => {
            const groupKey = `g-${group.sentenceIndex ?? gIdx}-${gIdx}`;
            return (
              <Box
                key={groupKey}
                sx={{
                  mb: 2,
                  pb: 1.5,
                  borderBottom:
                    gIdx < orderedGroups.length - 1
                      ? `1px dashed ${alpha(theme.palette.divider, 0.4)}`
                      : 'none',
                }}
              >
                {/* Sentence pair header */}
                {(group.originalSentence || group.learnerSentence) && (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      sx={{
                        fontFamily: MONO,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                        color: accent,
                        mb: 0.5,
                      }}
                    >
                      Sentence{' '}
                      {group.sentenceIndex != null
                        ? group.sentenceIndex + 1
                        : gIdx + 1}
                    </Typography>
                    {group.originalSentence && (
                      <Typography
                        sx={{
                          fontFamily: SERIF,
                          fontSize: '0.95rem',
                          lineHeight: 1.7,
                          color: theme.palette.text.primary,
                          mb: 0.5,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            fontFamily: MONO,
                            fontSize: '0.7rem',
                            color: theme.palette.text.secondary,
                            mr: 0.5,
                          }}
                        >
                          ORIG:
                        </Box>
                        {renderSentenceInline({
                          sentence: group.originalSentence,
                          side: 'original',
                          sentenceIndex:
                            group.sentenceIndex != null
                              ? group.sentenceIndex
                              : gIdx,
                          allSpans,
                          hoveredPairId,
                          onHoverPair: setHoveredPairId,
                          keyPrefix: `og-${groupKey}`,
                        })}
                      </Typography>
                    )}
                    {group.learnerSentence && (
                      <Typography
                        sx={{
                          fontFamily: SANS,
                          fontSize: '0.95rem',
                          lineHeight: 1.7,
                          color: theme.palette.text.primary,
                        }}
                      >
                        <Box
                          component="span"
                          sx={{
                            fontFamily: MONO,
                            fontSize: '0.7rem',
                            color: theme.palette.text.secondary,
                            mr: 0.5,
                          }}
                        >
                          YOU:
                        </Box>
                        {renderSentenceInline({
                          sentence: group.learnerSentence,
                          side: 'learner',
                          sentenceIndex:
                            group.sentenceIndex != null
                              ? group.sentenceIndex
                              : gIdx,
                          allSpans,
                          hoveredPairId,
                          onHoverPair: setHoveredPairId,
                          keyPrefix: `lg-${groupKey}`,
                        })}
                      </Typography>
                    )}
                  </Box>
                )}

                {/* Notes for this sentence pair */}
                {group.notes && group.notes.length > 0 ? (
                  group.notes.map((n) => {
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
                          bgcolor: isHovered
                            ? alpha(accent, 0.08)
                            : 'transparent',
                          borderRadius: 1,
                          boxShadow: isHovered
                            ? `0 4px 12px ${alpha(accent, 0.18)}`
                            : 'none',
                          transition:
                            'background-color 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.9rem' }}>
                          You:{' '}
                          <em>&ldquo;{n.learner_phrase}&rdquo;</em>{' '}
                          &nbsp;→&nbsp; Original:{' '}
                          <em>&ldquo;{n.original_phrase}&rdquo;</em>
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
                  })
                ) : (
                  <Typography
                    sx={{
                      fontSize: '0.85rem',
                      color: theme.palette.text.secondary,
                      fontStyle: 'italic',
                      pl: 1.5,
                    }}
                  >
                    No expression upgrades for this sentence.
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default ExpressionDiffPanel;
