import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Stack, Typography, Box, Chip, Button } from '@mui/material';
import useBrainState from '../../brain/useBrainState';
import triggerBus from '../../brain/triggerBus';

/**
 * BrainDashboardPanel — additive panel for the existing `/` dashboard
 * showing Orb-narrated state, the top three Proposals, and an action to
 * engage the top one. Lives alongside the existing Learning Progress
 * panels rather than replacing them (Plan 2 fork #7).
 *
 * When the queue is empty, the panel asks the Brain for a synthesized
 * "what's next?" suggestion via triggerBus.pull() (Plan 3 LLM-backed
 * synthesizePullSuggestion with deterministic Quest-aware fallback) and
 * renders it inline with a "Go" action.
 */
const STATE_NARRATION = {
  idle: 'Nothing pressing — pick a book or pull a suggestion.',
  thinking: 'Brain is computing…',
  'has-proposal': (count) =>
    `You have ${count} proposal${count === 1 ? '' : 's'} ready.`,
  'mid-flow': 'You are in the middle of a flow.',
  uncertain: 'Brain has several proposals and is deciding which is best.',
};

export default function BrainDashboardPanel() {
  const { orbState, queue } = useBrainState();
  const navigate = useNavigate();
  const narration = STATE_NARRATION[orbState];
  const line =
    typeof narration === 'function' ? narration(queue.length) : narration;

  // Synthesized suggestion (LLM or deterministic) for the empty-queue path.
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (queue.length === 0 && !suggestion && !suggestionLoading) {
      setSuggestionLoading(true);
      Promise.resolve(triggerBus.pull())
        .then((s) => {
          if (!cancelled) setSuggestion(s || null);
        })
        .catch(() => {
          if (!cancelled) setSuggestion(null);
        })
        .finally(() => {
          if (!cancelled) setSuggestionLoading(false);
        });
    }
    // When the queue gains items, drop the cached suggestion so a future
    // empty state re-asks the Brain (state may have shifted).
    if (queue.length > 0 && suggestion) setSuggestion(null);
    return () => {
      cancelled = true;
    };
  }, [queue.length, suggestion, suggestionLoading]);

  const onSuggestionGo = () => {
    if (suggestion?.navigate) {
      navigate(`/${String(suggestion.navigate).replace(/^\/+/, '')}`);
    }
  };

  return (
    <Paper
      sx={{
        p: 3,
        borderRadius: '16px',
        border: '1px solid #f0f0f0',
        mb: 3,
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{ color: '#2d3748' }}
          >
            Brain
          </Typography>
          <Typography variant="body2" sx={{ color: '#718096' }}>
            {line || ''}
          </Typography>
        </Box>

        {queue.length === 0 ? (
          <Box>
            {suggestionLoading && (
              <Typography variant="caption" sx={{ color: '#a0aec0' }}>
                Thinking about what to suggest…
              </Typography>
            )}
            {!suggestionLoading && !suggestion && (
              <Typography variant="caption" sx={{ color: '#a0aec0' }}>
                No pending proposals.
              </Typography>
            )}
            {!suggestionLoading && suggestion && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: '#f7fafc',
                  border: '1px dashed #cbd5e0',
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      label={suggestion.source === 'llm' ? 'LLM' : 'auto'}
                      sx={{ height: 18, fontSize: 10 }}
                    />
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ color: '#2d3748' }}
                    >
                      {suggestion.title}
                    </Typography>
                  </Stack>
                  {suggestion.body && (
                    <Typography
                      variant="caption"
                      sx={{ color: '#718096' }}
                    >
                      {suggestion.body}
                    </Typography>
                  )}
                  {suggestion.navigate && (
                    <Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={onSuggestionGo}
                      >
                        Go
                      </Button>
                    </Box>
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        ) : (
          <Stack spacing={1}>
            {queue.slice(0, 3).map((p) => (
              <Box
                key={p.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Chip size="small" label={p.priority} />
                <Typography
                  variant="body2"
                  sx={{ flexGrow: 1, color: '#4a5568' }}
                >
                  {p.source}: {p.payload?.title || p.id}
                </Typography>
                <Button size="small" onClick={() => triggerBus.accept(p.id)}>
                  Do now
                </Button>
                <Button size="small" onClick={() => triggerBus.dismiss(p.id)}>
                  Skip
                </Button>
              </Box>
            ))}
            {queue.length > 3 && (
              <Typography variant="caption" sx={{ color: '#a0aec0' }}>
                + {queue.length - 3} more queued
              </Typography>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
