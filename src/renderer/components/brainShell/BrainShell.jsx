import React from 'react';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import BrainOrb from './BrainOrb';
import ManualMenu from './ManualMenu';
import FlowCoordinator from './FlowCoordinator';
import useBrainState from '../../brain/useBrainState';
import triggerBus from '../../brain/triggerBus';

/**
 * BrainShell — top-level wrapper that gives the Brain a body in the UI.
 *
 * Layout (Plan 1):
 *   AppBar  →  [ManualMenu] ... [BrainOrb]
 *   {children}  (the active route)
 *   FlowCoordinator (active Proposal renders here, floating)
 *
 * In Plan 2 the AppBar gains a Multi-Surface Flow strip (when a flow
 * is in progress) and a Quest progress indicator (when one is active).
 */
export default function BrainShell({ children }) {
  const { orbState, queue, activeProposal } = useBrainState();

  const onOrbClick = async () => {
    const top = queue[0];
    if (top) {
      await triggerBus.accept(top.id);
    } else {
      const synthesized = await triggerBus.pull();
      // eslint-disable-next-line no-console
      console.log('[BrainShell] pull result:', synthesized);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <ManualMenu />
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: 16 }}>
            SmartReader
          </Typography>
          <BrainOrb
            state={orbState}
            queueDepth={queue.length}
            onClick={onOrbClick}
          />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, position: 'relative' }}>{children}</Box>
      <FlowCoordinator proposal={activeProposal} />
    </Box>
  );
}
