import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Box,
} from '@mui/material';
import triggerBus from '../../brain/triggerBus';
import RationaleCard from './RationaleCard';

/**
 * InlineSequenceHost — renders a multi-step Inline Sequence Flow.
 * The Brain choreographs a sequence of atomic steps (each shaped like
 * an Atomic Chip payload) within the current view. The user can advance,
 * abort, or finish — no auto-navigation between routes.
 *
 * Plan 2 will refactor Phase 6 (ComprehensionPanel) to be driven by
 * this host. For now the host stands alone and renders any
 * proposal.payload.steps array as a sequence.
 *
 * Expected proposal.payload shape:
 *   {
 *     title?: string,             // sequence label, e.g. "Comprehension check"
 *     steps: Array<{ title?, body?, ... }>,  // one entry per step
 *   }
 *
 * Reports per-step results to the bus on next/abort/done via the
 * `onStepResult` callback (Plan 3 may persist these to learner state).
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal} props.proposal
 * @param {(result: { proposalId: string, step: number, kind: 'next' | 'abort' | 'done' }) => void} [props.onStepResult]
 */
export default function InlineSequenceHost({ proposal, onStepResult }) {
  const steps = proposal.payload?.steps || [];
  const total = steps.length;
  const [stepIdx, setStepIdx] = useState(0);

  const sequenceTitle = proposal.payload?.title || proposal.source;
  const current = steps[stepIdx];

  if (total === 0) {
    // Empty sequence — close immediately so the orb returns to idle.
    triggerBus.completeActive();
    return null;
  }

  const advance = () => {
    onStepResult?.({ proposalId: proposal.id, step: stepIdx, kind: 'next' });
    if (stepIdx + 1 >= total) {
      onStepResult?.({ proposalId: proposal.id, step: stepIdx, kind: 'done' });
      triggerBus.completeActive();
      return;
    }
    setStepIdx((s) => s + 1);
  };

  const abort = () => {
    onStepResult?.({ proposalId: proposal.id, step: stepIdx, kind: 'abort' });
    triggerBus.dismiss(proposal.id);
    triggerBus.completeActive();
  };

  const progressPct = Math.round(((stepIdx + 1) / total) * 100);
  const isLastStep = stepIdx + 1 === total;

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 420,
        p: 2,
        zIndex: 1300,
      }}
    >
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="overline" sx={{ opacity: 0.6 }}>
            {sequenceTitle}
          </Typography>
          <Typography variant="caption" sx={{ ml: 1, opacity: 0.5 }}>
            step {stepIdx + 1} of {total}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{ mt: 0.5, borderRadius: 1 }}
          />
        </Box>
        {current.title && (
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {current.title}
          </Typography>
        )}
        {current.body && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {current.body}
          </Typography>
        )}
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" onClick={abort}>
            Abort
          </Button>
          <Button size="small" variant="contained" onClick={advance}>
            {isLastStep ? 'Done' : 'Next'}
          </Button>
        </Stack>
        <RationaleCard triggerId={proposal.id} />
      </Stack>
    </Paper>
  );
}
