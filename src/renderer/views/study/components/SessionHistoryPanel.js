/**
 * SessionHistoryPanel.js
 *
 * Displays detailed session history with pagination and filtering.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  LinearProgress,
  alpha,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  AccessTime as TimeIcon,
  CheckCircle as CorrectIcon,
  TrendingUp as TrendIcon,
  Lightbulb as HintIcon,
} from '@mui/icons-material';
import { useSessionHistory } from '../hooks/useStudyAnalytics';
import { formatDuration, formatAccuracy, getPerformanceLevel } from '../../../api/studyAnalyticsApi';

/**
 * Format date for display
 */
const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Format time for display
 */
const formatTime = (dateStr) => {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Session row component with expandable details
 */
function SessionRow({ session }) {
  const [expanded, setExpanded] = useState(false);

  const accuracy = parseFloat(session.accuracy || 0);
  const performance = getPerformanceLevel(accuracy);

  return (
    <>
      <TableRow
        hover
        onClick={() => setExpanded(!expanded)}
        sx={{ cursor: 'pointer', '& > *': { borderBottom: 'unset' } }}
      >
        <TableCell>
          <IconButton size="small">
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{formatDate(session.startedAt)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {formatTime(session.startedAt)}
          </Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TimeIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {formatDuration(session.durationMinutes)}
            </Typography>
          </Box>
        </TableCell>
        <TableCell align="center">
          <Typography variant="body2">{session.itemsReviewed}</Typography>
        </TableCell>
        <TableCell align="center">
          <Chip
            label={formatAccuracy(accuracy)}
            size="small"
            sx={{
              bgcolor: alpha(performance.color, 0.1),
              color: performance.color,
              fontWeight: 500,
            }}
          />
        </TableCell>
        <TableCell>
          {session.focusScore !== null && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress
                variant="determinate"
                value={session.focusScore}
                sx={{
                  width: 60,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    bgcolor:
                      session.focusScore >= 70
                        ? 'success.main'
                        : session.focusScore >= 50
                          ? 'warning.main'
                          : 'error.main',
                  },
                }}
              />
              <Typography variant="caption">{session.focusScore}%</Typography>
            </Box>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={6} sx={{ py: 0 }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 2,
                }}
              >
                <StatItem
                  icon={<CorrectIcon color="success" />}
                  label="Correct"
                  value={`${session.itemsCorrect} / ${session.itemsReviewed}`}
                />
                <StatItem
                  icon={<TrendIcon color="info" />}
                  label="Efficiency"
                  value={
                    session.efficiencyScore
                      ? `${session.efficiencyScore}%`
                      : 'N/A'
                  }
                />
                <StatItem
                  icon={<HintIcon color="warning" />}
                  label="Hints Used"
                  value={session.hintsUsed || 0}
                />
                <StatItem
                  icon={<TimeIcon color="action" />}
                  label="Avg Response"
                  value={
                    session.avgResponseTimeMs
                      ? `${(session.avgResponseTimeMs / 1000).toFixed(1)}s`
                      : 'N/A'
                  }
                />
                {session.streakLength > 0 && (
                  <StatItem
                    icon={<span>🔥</span>}
                    label="Best Streak"
                    value={session.streakLength}
                  />
                )}
                {session.retentionRate !== null && (
                  <StatItem
                    icon={<span>🧠</span>}
                    label="Retention"
                    value={`${session.retentionRate}%`}
                  />
                )}
              </Box>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

/**
 * Small stat display item
 */
function StatItem({ icon, label, value }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {icon}
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" fontWeight={500}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * Main SessionHistoryPanel component
 */
export default function SessionHistoryPanel({
  token,
  topicId = null,
  pageSize = 10,
  maxHeight = 500,
}) {
  const {
    sessions,
    total,
    page,
    hasMore,
    hasPrev,
    isLoading,
    loadPage,
  } = useSessionHistory({ token, topicId, pageSize });

  const handleChangePage = useCallback(
    (event, newPage) => {
      loadPage(newPage);
    },
    [loadPage],
  );

  if (isLoading && sessions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">Loading session history...</Typography>
      </Box>
    );
  }

  if (sessions.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No sessions recorded yet.</Typography>
        <Typography variant="caption" color="text.secondary">
          Complete a study session to see your history here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ maxHeight, overflow: 'auto' }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell width={50} />
              <TableCell>Date</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell align="center">Items</TableCell>
              <TableCell align="center">Accuracy</TableCell>
              <TableCell>Focus</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={pageSize}
        rowsPerPageOptions={[pageSize]}
        sx={{ borderTop: 1, borderColor: 'divider' }}
      />

      {isLoading && (
        <LinearProgress sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} />
      )}
    </Box>
  );
}
