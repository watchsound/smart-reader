import React, { useCallback, useEffect, useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Divider,
  Box,
  Chip,
  IconButton,
  Stack,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArchiveIcon from '@mui/icons-material/Archive';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import RouteIcon from '@mui/icons-material/Route';
import questApi from '../../api/questApi';
import NewQuestDialog from './NewQuestDialog';

/**
 * OrbQuestMenu — popover surfaced by right-clicking the Brain Orb.
 * Shows the user's active + paused Quests with pause / resume / archive
 * controls. Refetches on open + after every mutation.
 *
 * Quest creation is intentionally NOT here — that's a fuller flow (goal
 * text, bookIds picker) that lives behind a separate "New Quest" UI in
 * Plan 4 (currently triggered via Phase 7 cross-book-path-panel).
 *
 * @param {object} props
 * @param {HTMLElement | null} props.anchorEl
 * @param {() => void} props.onClose
 */
export default function OrbQuestMenu({ anchorEl, onClose }) {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const active = (await questApi.list({ status: 'active' })) || [];
      const paused = (await questApi.list({ status: 'paused' })) || [];
      setQuests([...active, ...paused]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[OrbQuestMenu] list failed', e);
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (anchorEl) refresh();
  }, [anchorEl, refresh]);

  const onPause = async (q) => {
    await questApi.pause(q.id);
    refresh();
  };
  const onResume = async (q) => {
    await questApi.resume(q.id);
    refresh();
  };
  const onArchive = async (q) => {
    await questApi.archive(q.id);
    refresh();
  };
  const onWalk = async (q) => {
    // Re-emit the Phase 7 path as a multi-surface-flow Trigger. The Orb
    // will bloom on the new proposal; user clicks Orb to engage. Close
    // this menu so the user sees the Orb update.
    await questApi.walk(q.id);
    onClose();
  };

  const openDialog = () => {
    setDialogOpen(true);
    // Close the menu so the dialog isn't nested inside a still-open Menu
    // (MUI Menu's focus trap fights with Dialog's focus trap).
    onClose();
  };

  return (
    <>
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 320, maxWidth: 420 } } }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="overline" sx={{ opacity: 0.6 }}>
          Quests
        </Typography>
        <IconButton
          size="small"
          aria-label="new quest"
          onClick={openDialog}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      <Divider />
      {loading && (
        <MenuItem disabled>
          <ListItemText primary="Loading…" />
        </MenuItem>
      )}
      {!loading && quests.length === 0 && (
        <MenuItem disabled>
          <ListItemText
            primary="No active quests"
            secondary="A Phase 7 cross-book path creates one automatically."
          />
        </MenuItem>
      )}
      {!loading &&
        quests.map((q) => (
          <MenuItem key={q.id} disableRipple sx={{ alignItems: 'flex-start' }}>
            <ListItemIcon sx={{ mt: 0.5 }}>
              <FlagIcon
                fontSize="small"
                sx={{ opacity: q.status === 'active' ? 1 : 0.4 }}
              />
            </ListItemIcon>
            <ListItemText
              primary={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>
                    {q.name}
                  </Typography>
                  <Chip
                    size="small"
                    label={q.status}
                    color={q.status === 'active' ? 'primary' : 'default'}
                  />
                </Stack>
              }
              secondary={
                <Box>
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', display: 'block' }}
                  >
                    {q.goal}
                  </Typography>
                  {q.bookIds && q.bookIds.length > 0 && (
                    <Typography variant="caption" sx={{ opacity: 0.6 }}>
                      {q.bookIds.length} book
                      {q.bookIds.length === 1 ? '' : 's'} in scope
                    </Typography>
                  )}
                </Box>
              }
            />
            <Stack direction="row" spacing={0.5} sx={{ ml: 1, mt: 0.5 }}>
              {q.metadata?.source === 'phase-7-learning-path' && (
                <IconButton
                  size="small"
                  aria-label="walk quest"
                  title="Walk the path"
                  onClick={() => onWalk(q)}
                >
                  <RouteIcon fontSize="small" />
                </IconButton>
              )}
              {q.status === 'active' ? (
                <IconButton
                  size="small"
                  aria-label="pause quest"
                  onClick={() => onPause(q)}
                >
                  <PauseIcon fontSize="small" />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  aria-label="resume quest"
                  onClick={() => onResume(q)}
                >
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              )}
              <IconButton
                size="small"
                aria-label="archive quest"
                onClick={() => onArchive(q)}
              >
                <ArchiveIcon fontSize="small" />
              </IconButton>
            </Stack>
          </MenuItem>
        ))}
    </Menu>
    <NewQuestDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      onCreated={() => {
        // Re-open the menu? No — keep dialog UX simple; the next right-click
        // on the Orb shows the new quest. We just need the cache to refresh
        // next time. quest:changed event will hit triggerBus too.
        refresh();
      }}
    />
    </>
  );
}
