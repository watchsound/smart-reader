import React from 'react';
import { Paper, Stack, Typography, Box, Chip, Button } from '@mui/material';
import useBrainState from '../../brain/useBrainState';
import triggerBus from '../../brain/triggerBus';

/**
 * BrainDashboardPanel — additive panel for the existing `/` dashboard
 * showing Orb-narrated state, the top three Proposals, and an action to
 * engage the top one. Lives alongside the existing Learning Progress
 * panels rather than replacing them (Plan 2 fork #7).
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
  const narration = STATE_NARRATION[orbState];
  const line =
    typeof narration === 'function' ? narration(queue.length) : narration;

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
          <Typography variant="caption" sx={{ color: '#a0aec0' }}>
            No pending proposals.
          </Typography>
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
