/* eslint-disable no-use-before-define */
/* eslint-disable react/prop-types */
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
  LinearProgress,
  Tooltip,
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
  // questId → progress snapshot. Populated lazily after the quest list
  // arrives — keeps the initial open fast even if the user has many
  // quests; each progress fetch is a single COUNT query, cheap but not
  // free.
  const [progressById, setProgressById] = useState({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const active = (await questApi.list({ status: 'active' })) || [];
      const paused = (await questApi.list({ status: 'paused' })) || [];
      const all = [...active, ...paused];
      setQuests(all);
      // Fan out progress fetches in parallel; ignore individual failures.
      const entries = await Promise.all(
        all.map(async (q) => {
          try {
            const p = await questApi.getProgress(q.id);
            return [q.id, p];
          } catch (_err) {
            return [q.id, null];
          }
        }),
      );
      setProgressById(Object.fromEntries(entries));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[OrbQuestMenu] list failed', e);
      setQuests([]);
      setProgressById({});
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
          <IconButton size="small" aria-label="new quest" onClick={openDialog}>
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
            <MenuItem
              key={q.id}
              disableRipple
              sx={{ alignItems: 'flex-start' }}
            >
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
                    <QuestProgress
                      progress={progressById[q.id]}
                      booksScopeFallback={(q.bookIds || []).length}
                      isPhase7={q.metadata?.source === 'phase-7-learning-path'}
                    />
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

/**
 * Inline progress strip for one Quest row. Shows:
 *   - A LinearProgress bar = booksStarted / booksTotal (the share of
 *     scoped books the user has at least one learning point in).
 *   - A caption: "{N} cards · {S}/{T} books started [· Path: {P} steps]"
 *
 * Falls back to just "{T} books in scope" when progress isn't loaded yet
 * (matches the previous single-line caption — no layout jump on open).
 */
// eslint-disable-next-line react/prop-types
function QuestProgress({ progress, booksScopeFallback, isPhase7 }) {
  const isValid =
    progress &&
    typeof progress === 'object' &&
    !Array.isArray(progress) &&
    typeof progress.booksTotal === 'number';
  if (!isValid) {
    if (!booksScopeFallback) return null;
    return (
      <Typography variant="caption" sx={{ opacity: 0.6 }}>
        {booksScopeFallback} book{booksScopeFallback === 1 ? '' : 's'} in scope
      </Typography>
    );
  }
  const { learningPointsTotal, booksStarted, booksTotal, pathStepsTotal } =
    progress;

  const ratio = booksTotal > 0 ? Math.min(1, booksStarted / booksTotal) : 0;

  const captionParts = [];
  captionParts.push(
    `${learningPointsTotal} card${learningPointsTotal === 1 ? '' : 's'}`,
  );
  if (booksTotal > 0) {
    captionParts.push(`${booksStarted}/${booksTotal} books started`);
  }
  if (isPhase7 && pathStepsTotal > 0) {
    captionParts.push(
      `Path: ${pathStepsTotal} step${pathStepsTotal === 1 ? '' : 's'}`,
    );
  }

  const tooltip =
    booksTotal === 0
      ? 'No books scoped — progress is by cards created'
      : `${booksStarted} of ${booksTotal} scoped books have at least one card`;

  return (
    <Box sx={{ mt: 0.5 }}>
      {booksTotal > 0 && (
        <Tooltip title={tooltip} placement="top" arrow>
          <LinearProgress
            variant="determinate"
            value={ratio * 100}
            sx={{
              height: 4,
              borderRadius: 2,
              mb: 0.5,
              opacity: 0.85,
            }}
          />
        </Tooltip>
      )}
      <Typography variant="caption" sx={{ opacity: 0.7 }}>
        {captionParts.join(' · ')}
      </Typography>
    </Box>
  );
}
