import React, { useState } from 'react';
import { Paper, Typography, Button, Stack } from '@mui/material';
import triggerBus from '../../brain/triggerBus';

/**
 * AtomicChipHost — renders a single Atomic Chip Proposal.
 * Plan 1 uses the floating-global variant (fixed bottom-right) only;
 * in-place anchoring at paragraph CFIs is deferred to Plan 2 when
 * EPUB/PDF reader integration lands.
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal} props.proposal
 */
export default function AtomicChipHost({ proposal }) {
  const [expanded, setExpanded] = useState(false);

  const dismiss = () => {
    triggerBus.dismiss(proposal.id);
    triggerBus.completeActive();
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 360,
        p: 2,
        zIndex: 1300,
      }}
    >
      <Stack spacing={1}>
        <Typography variant="overline" sx={{ opacity: 0.6 }}>
          {proposal.source}
        </Typography>
        <Typography variant="body2">
          {proposal.payload?.title || 'New proposal from Brain'}
        </Typography>
        {expanded && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {proposal.payload?.body || JSON.stringify(proposal.payload, null, 2)}
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Less' : 'More'}
          </Button>
          <Button size="small" onClick={dismiss}>
            Dismiss
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
