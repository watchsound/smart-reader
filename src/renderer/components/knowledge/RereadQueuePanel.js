/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * RereadQueuePanel — Phase 8 spaced re-reading queue.
 *
 * Lives in Knowledge Dashboard as tab 6 "Re-read Queue".
 *
 * Shows chapters queued for re-reading due to comprehension gaps,
 * sorted by dueAt (overdue first). Each card shows:
 *   - Book title + chapter name
 *   - Comprehension score that triggered the item
 *   - Gap chips (concepts missed)
 *   - Due date badge (overdue / due today / upcoming)
 *   - [Done] + [Dismiss] actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Paper,
  Divider,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Replay as ReplayIcon,
  Warning as WarningIcon,
  CheckCircle as DoneIcon,
  Close as DismissIcon,
  MenuBook as BookIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import rereadQueueApi from '../../api/rereadQueueApi';
import { recordEvent } from '../../api/brainApi';

function dueBadge(dueAt, theme) {
  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diffDays = Math.round((due - now) / 86400000);
  if (diffDays < 0) {
    return { label: `${Math.abs(diffDays)}d overdue`, color: '#ef4444' };
  }
  if (diffDays === 0) {
    return { label: 'Due today', color: '#f59e0b' };
  }
  return { label: `Due in ${diffDays}d`, color: theme.palette.text.disabled };
}

function scoreColor(score) {
  if (score >= 75) return '#10b981';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function QueueCard({ item, onComplete, onDismiss, theme }) {
  const badge = dueBadge(item.dueAt, theme);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: alpha(theme.palette.divider, 0.15),
        background:
          theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.6)
            : theme.palette.background.paper,
      }}
    >
      <Stack spacing={1}>
        {/* Header row */}
        <Stack direction="row" alignItems="flex-start" spacing={1}>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={0.75} flexWrap="wrap">
              <BookIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
              <Typography
                variant="subtitle2"
                sx={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}
              >
                {item.bookTitle}
              </Typography>
            </Stack>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontSize: 12, mt: 0.25 }}
            >
              {item.chapterName}
            </Typography>
          </Box>

          {/* Score ring */}
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `3px solid ${scoreColor(item.score)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: alpha(scoreColor(item.score), 0.08),
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: scoreColor(item.score) }}>
              {item.score}
            </Typography>
          </Box>
        </Stack>

        {/* Gaps */}
        {Array.isArray(item.gaps) && item.gaps.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {item.gaps.map((g) => (
              <Chip
                key={g}
                icon={<WarningIcon sx={{ fontSize: 11 }} />}
                label={g}
                size="small"
                sx={{
                  fontSize: 10,
                  height: 18,
                  bgcolor: alpha('#f59e0b', 0.1),
                  color: '#f59e0b',
                  '& .MuiChip-icon': { color: '#f59e0b' },
                }}
              />
            ))}
          </Stack>
        )}

        {/* Due badge + actions */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <ScheduleIcon sx={{ fontSize: 12, color: badge.color }} />
            <Typography variant="caption" sx={{ color: badge.color, fontWeight: 600 }}>
              {badge.label}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={0.75}>
            <Button
              size="small"
              startIcon={<DismissIcon sx={{ fontSize: 12 }} />}
              onClick={() => onDismiss(item.id)}
              sx={{ fontSize: 11, minWidth: 0, px: 1, color: 'text.disabled' }}
            >
              Dismiss
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<DoneIcon sx={{ fontSize: 12 }} />}
              onClick={() => onComplete(item)}
              sx={{ fontSize: 11, px: 1.5 }}
            >
              Done
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function RereadQueuePanel() {
  const theme = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await rereadQueueApi.getPending();
      setItems(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err?.message || 'Failed to load re-read queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleComplete = useCallback(async (item) => {
    try {
      await rereadQueueApi.complete(item.id);
      recordEvent.rereadCompleted({
        bookId: item.bookId,
        chapterId: item.chapterId,
        chapterName: item.chapterName,
        originalScore: item.score,
      });
      setItems((prev) => prev.filter((it) => it.id !== item.id));
    } catch (_) {
      // best-effort
    }
  }, []);

  const handleDismiss = useCallback(async (id) => {
    try {
      await rereadQueueApi.dismiss(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (_) {
      // best-effort
    }
  }, []);

  const overdueCount = items.filter(
    (it) => new Date(it.dueAt).getTime() < Date.now(),
  ).length;

  return (
    <Box sx={{ maxWidth: 680, mx: 'auto', py: 1 }}>
      {/* Header */}
      <Stack direction="row" spacing={1.5} alignItems="center" mb={3}>
        <ReplayIcon sx={{ color: theme.palette.primary.main, fontSize: 24 }} />
        <Box flex={1}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 17 }}>
            Re-read Queue
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>
            Chapters flagged for re-reading after comprehension gaps were found.
          </Typography>
        </Box>
        {overdueCount > 0 && (
          <Chip
            label={`${overdueCount} overdue`}
            size="small"
            sx={{ bgcolor: alpha('#ef4444', 0.1), color: '#ef4444', fontSize: 11 }}
          />
        )}
      </Stack>

      {loading && (
        <Stack alignItems="center" py={4}>
          <CircularProgress size={28} />
        </Stack>
      )}

      {!loading && error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && items.length === 0 && (
        <Box
          sx={{
            py: 6,
            textAlign: 'center',
            color: 'text.disabled',
          }}
        >
          <DoneIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
          <Typography variant="body2">
            Nothing queued — keep reading!
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
            Chapters with comprehension gaps will appear here.
          </Typography>
        </Box>
      )}

      {!loading && items.length > 0 && (
        <Stack spacing={1.5}>
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              onComplete={handleComplete}
              onDismiss={handleDismiss}
              theme={theme}
            />
          ))}
          <Divider sx={{ mt: 1 }} />
          <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
            {items.length} item{items.length !== 1 ? 's' : ''} pending
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
