import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import questApi from '../../api/questApi';

/**
 * NewQuestDialog — modal for creating a Quest from the OrbQuestMenu.
 * Book scoping is deferred to a follow-up — Phase 7 will auto-populate
 * bookIds when a cross-book path is planned for this Quest's goal.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(quest: object) => void} [props.onCreated] callback with the created Quest
 */
export default function NewQuestDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setName('');
    setGoal('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const canSubmit = name.trim().length > 0 && goal.trim().length > 0;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await questApi.create({
        name: name.trim(),
        goal: goal.trim(),
      });
      if (created && created.error) {
        setError(created.error);
        setSubmitting(false);
        return;
      }
      onCreated?.(created);
      reset();
      setSubmitting(false);
      onClose();
    } catch (e) {
      setError(e?.message || 'Create failed');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Quest</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            A Quest is a long-lived goal. Brain uses it to weight which
            proposals to surface — items related to the quest's books bubble
            to the top of the queue.
          </Typography>
          <TextField
            label="Name"
            fullWidth
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Learn German B2"
            disabled={submitting}
          />
          <TextField
            label="Goal"
            fullWidth
            multiline
            minRows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Reach B2 by end of year — fluent reading + can hold a 10-min conversation"
            disabled={submitting}
          />
          {error && <Alert severity="error">{error}</Alert>}
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Tip: Once created, run a cross-book learning path for this goal
            in the Knowledge dashboard — it will populate the Quest's book
            scope automatically.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
