import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Typography, Button, Stack } from '@mui/material';
import triggerBus from '../../brain/triggerBus';
import RationaleCard from './RationaleCard';

/**
 * AtomicChipHost — renders a single Atomic Chip Proposal.
 *
 * Floating bottom-right Paper card. Supports payload-defined action
 * buttons (e.g., "Open chapter") that can navigate to a route and/or
 * dispatch a tagged action; falls back to More/Dismiss when no actions
 * are declared.
 *
 * Expected proposal.payload shape:
 *   {
 *     title?: string,
 *     body?: string,
 *     actions?: Array<{ label: string, navigate?: string, primary?: boolean }>,
 *   }
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal} props.proposal
 */
export default function AtomicChipHost({ proposal }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const dismiss = () => {
    triggerBus.dismiss(proposal.id);
    triggerBus.completeActive();
  };

  const fireAction = (action) => {
    if (action?.navigate) {
      navigate(`/${String(action.navigate).replace(/^\/+/, '')}`);
    }
    // Acting on a proposal counts as engagement → close the flow.
    triggerBus.completeActive();
  };

  const actions = Array.isArray(proposal.payload?.actions)
    ? proposal.payload.actions
    : [];

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
        {(expanded || actions.length > 0) && proposal.payload?.body && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {proposal.payload.body}
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          {actions.length === 0 && (
            <Button size="small" onClick={() => setExpanded((v) => !v)}>
              {expanded ? 'Less' : 'More'}
            </Button>
          )}
          <Button size="small" onClick={dismiss}>
            Dismiss
          </Button>
          {actions.map((a) => (
            <Button
              key={a.label}
              size="small"
              variant={a.primary ? 'contained' : 'outlined'}
              onClick={() => fireAction(a)}
            >
              {a.label}
            </Button>
          ))}
        </Stack>
        <RationaleCard triggerId={proposal.id} />
      </Stack>
    </Paper>
  );
}
