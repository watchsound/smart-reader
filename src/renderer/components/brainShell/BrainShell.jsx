import React, { useEffect, useRef, useState } from 'react';
import { Box, AppBar, Toolbar, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BrainOrb from './BrainOrb';
import ManualMenu from './ManualMenu';
import FlowCoordinator from './FlowCoordinator';
import OrbQuestMenu from './OrbQuestMenu';
import SessionStartDialog from '../../views/aiSession/SessionStartDialog';
import sessionApi from '../../api/sessionApi';
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
 *
 * Task 8 additions (Phase 10b-2):
 *   - Right-click on BrainOrb opens OrbQuestMenu (previously unconnected).
 *   - OrbQuestMenu gets an "Start AI Session" item that opens SessionStartDialog.
 *   - On mount, checks for an active session and renders a resume pill near the orb.
 */
export default function BrainShell({ children }) {
  const { orbState, queue, activeProposal } = useBrainState();
  const navigate = useNavigate();

  // --- OrbQuestMenu anchor (right-click target) ---
  const [menuAnchor, setMenuAnchor] = useState(null);
  const onOrbContextMenu = (e) => {
    e.preventDefault();
    setMenuAnchor(e.currentTarget);
  };

  // --- SessionStartDialog ---
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);

  // --- Resume pill (active session from previous run) ---
  const [resumeSessionId, setResumeSessionId] = useState(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const active = await sessionApi.loadActive();
        if (mountedRef.current && active && active.status === 'active') {
          setResumeSessionId(active.id);
        }
      } catch (_e) {
        // ignore — session service may not be available on all routes
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
          {resumeSessionId && (
            <Box
              component="button"
              onClick={() => navigate(`/ai-session/${resumeSessionId}`)}
              sx={{
                padding: '4px 10px',
                fontSize: 12,
                background: '#fc6',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Resume session
            </Box>
          )}
          <BrainOrb
            state={orbState}
            queueDepth={queue.length}
            onClick={onOrbClick}
            onContextMenu={onOrbContextMenu}
          />
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, position: 'relative' }}>{children}</Box>
      <FlowCoordinator proposal={activeProposal} />
      <OrbQuestMenu
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onStartSession={() => setSessionDialogOpen(true)}
      />
      <SessionStartDialog
        open={sessionDialogOpen}
        onClose={() => setSessionDialogOpen(false)}
        activeQuest={null}
        userId={1}
      />
    </Box>
  );
}
