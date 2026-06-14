import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Paper,
  Typography,
  Button,
  Stack,
  LinearProgress,
  Box,
  Tooltip,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PauseIcon from '@mui/icons-material/Pause';
import triggerBus from '../../brain/triggerBus';

/**
 * MultiSurfaceFlowHost — renders a flow that walks the user across views.
 * The host owns a sticky top strip (flow name + step counter + pause + abort)
 * and auto-navigates to each step's `view` route when the step changes.
 * User-state inside each view (scroll, selection, etc.) is preserved on
 * exit because the host does not unmount the view itself; it only navigates.
 *
 * Expected proposal.payload shape:
 *   {
 *     title?: string,                                // flow name
 *     steps: Array<{ view: string, payload?: object }>,
 *   }
 *
 * Lifecycle:
 *   - mount → navigate to steps[0].view
 *   - Next → advance step + navigate to steps[next].view
 *   - Pause → completeActive (proposal snapshot is retained on the bus
 *             for Plan 3 resume; for Plan 2 it just lifts the strip)
 *   - Abort → dismiss + completeActive
 *   - Last step Done → completeActive
 *
 * @param {object} props
 * @param {import('../../../commons/brain/triggerTypes').Proposal} props.proposal
 * @param {(result: { proposalId: string, step: number, kind: 'next' | 'pause' | 'abort' | 'done' }) => void} [props.onStepResult]
 */
export default function MultiSurfaceFlowHost({ proposal, onStepResult }) {
  const steps = proposal.payload?.steps || [];
  const total = steps.length;
  const [stepIdx, setStepIdx] = useState(0);
  const navigate = useNavigate();

  const flowTitle = proposal.payload?.title || proposal.source;
  const current = steps[stepIdx];

  // Auto-navigate when the step index changes (including initial mount).
  useEffect(() => {
    if (!current?.view) return;
    navigate(`/${current.view.replace(/^\/+/, '')}`);
  }, [stepIdx, current?.view, navigate]);

  if (total === 0) {
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

  const pause = () => {
    onStepResult?.({ proposalId: proposal.id, step: stepIdx, kind: 'pause' });
    // Strip lifts; proposal snapshot remains on the bus until completeActive.
    // Plan 3: persist resume cursor so a refresh can restore step state.
    triggerBus.completeActive();
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
      elevation={4}
      square
      sx={{
        position: 'fixed',
        top: 64, // sits below the main AppBar
        left: 0,
        right: 0,
        zIndex: 1290,
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: 2,
        py: 1,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ minWidth: 220 }}>
          <Typography variant="overline" sx={{ opacity: 0.6 }}>
            {flowTitle}
          </Typography>
          <Typography variant="caption" sx={{ ml: 1, opacity: 0.5 }}>
            step {stepIdx + 1} of {total}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{ borderRadius: 1 }}
          />
        </Box>
        {current?.payload?.label && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {current.payload.label}
          </Typography>
        )}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Pause (resume from Orb)">
            <IconButton size="small" onClick={pause} aria-label="pause">
              <PauseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Abort">
            <IconButton size="small" onClick={abort} aria-label="abort">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button size="small" variant="contained" onClick={advance}>
            {isLastStep ? 'Done' : 'Next'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
