/**
 * WeakItemsPanel.js
 *
 * Displays items that need more practice based on performance data.
 * Shows accuracy, mastery level, and weakness reasons.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Button,
  Skeleton,
  LinearProgress,
  Tooltip,
  IconButton,
  Collapse,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Warning as WarningIcon,
  TrendingDown as WeakIcon,
  Speed as SpeedIcon,
  Psychology as MasteryIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  PlayArrow as StudyIcon,
} from '@mui/icons-material';
import studyAnalyticsApi from '../../../api/studyAnalyticsApi';

/**
 * Get icon and color based on weakness type
 */
const getWeaknessInfo = (reason) => {
  if (reason?.includes('accuracy')) {
    return { icon: <WeakIcon />, color: 'error' };
  }
  if (reason?.includes('response') || reason?.includes('Slow')) {
    return { icon: <SpeedIcon />, color: 'warning' };
  }
  if (reason?.includes('mastery')) {
    return { icon: <MasteryIcon />, color: 'info' };
  }
  return { icon: <WarningIcon />, color: 'warning' };
};

/**
 * Single weak item row component
 */
function WeakItemRow({ item, onStudy }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const weaknessInfo = getWeaknessInfo(item.weaknessReason);

  const accuracyNum = parseFloat(item.accuracy || 0);
  const masteryNum = parseFloat(item.currentMastery || 0);

  return (
    <Paper
      variant="outlined"
      sx={{
        mb: 1,
        overflow: 'hidden',
        borderColor: alpha(theme.palette[weaknessInfo.color].main, 0.3),
      }}
    >
      <ListItem
        button
        onClick={() => setExpanded(!expanded)}
        sx={{
          bgcolor: alpha(theme.palette[weaknessInfo.color].main, 0.05),
        }}
      >
        <ListItemIcon sx={{ color: `${weaknessInfo.color}.main` }}>
          {weaknessInfo.icon}
        </ListItemIcon>
        <ListItemText
          primary={
            <Typography variant="body2" fontWeight={500}>
              {item.itemId}
            </Typography>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {item.itemType} • {item.reviewCount} reviews
            </Typography>
          }
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mr: 1 }}>
          <Box sx={{ textAlign: 'center', minWidth: 60 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Accuracy
            </Typography>
            <Typography
              variant="body2"
              color={accuracyNum < 50 ? 'error.main' : 'text.primary'}
              fontWeight={500}
            >
              {item.accuracy}%
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center', minWidth: 60 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Mastery
            </Typography>
            <Typography
              variant="body2"
              color={masteryNum < 30 ? 'error.main' : 'text.primary'}
              fontWeight={500}
            >
              {Math.round(masteryNum)}%
            </Typography>
          </Box>
        </Box>
        <IconButton size="small">
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </IconButton>
      </ListItem>

      <Collapse in={expanded}>
        <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
          {/* Accuracy bar */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Accuracy Progress
              </Typography>
              <Typography variant="caption">{item.accuracy}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={accuracyNum}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  bgcolor:
                    accuracyNum >= 70
                      ? 'success.main'
                      : accuracyNum >= 50
                        ? 'warning.main'
                        : 'error.main',
                },
              }}
            />
          </Box>

          {/* Mastery bar */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Mastery Level
              </Typography>
              <Typography variant="caption">{Math.round(masteryNum)}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={masteryNum}
              color="info"
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
              }}
            />
          </Box>

          {/* Weakness reason */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Why this needs practice:
            </Typography>
            <Chip
              label={item.weaknessReason || 'Needs improvement'}
              size="small"
              color={weaknessInfo.color}
              variant="outlined"
            />
          </Box>

          {/* Graph data if available */}
          {item.graphData && (
            <Box sx={{ mb: 2, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Knowledge Graph Insights:
              </Typography>
              {item.graphData.dependentCount > 0 && (
                <Typography variant="caption">
                  • Blocking {item.graphData.dependentCount} other concepts
                </Typography>
              )}
              {item.graphData.graphReason && (
                <Typography variant="caption" display="block">
                  • {item.graphData.graphReason}
                </Typography>
              )}
            </Box>
          )}

          {/* Study button */}
          <Button
            variant="contained"
            color={weaknessInfo.color}
            size="small"
            startIcon={<StudyIcon />}
            onClick={() => onStudy?.(item)}
            fullWidth
          >
            Practice This Item
          </Button>
        </Box>
      </Collapse>
    </Paper>
  );
}

/**
 * Main WeakItemsPanel component
 */
export default function WeakItemsPanel({
  token,
  topicId = null,
  limit = 10,
  onStudyItem,
  onStudyAll,
}) {
  const [weakItems, setWeakItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Race guard: loadWeakItems re-fires when topicId/limit/token deps
  // change. Rapid topic-switching (e.g. arrow-key nav through a topic
  // list) lets a slow earlier response overwrite a faster newer one's
  // weakItems with stale results.
  const loadGenRef = useRef(0);

  // Load weak items
  const loadWeakItems = useCallback(async () => {
    if (!token) return;

    const myGen = loadGenRef.current + 1;
    loadGenRef.current = myGen;
    const isStale = () => myGen !== loadGenRef.current;

    setIsLoading(true);
    setError(null);
    try {
      const result = await studyAnalyticsApi.identifyWeakItems(
        token,
        topicId,
        limit,
      );
      if (isStale()) return;
      if (result.success) {
        setWeakItems(result.weakItems);
      } else {
        setError(result.error);
      }
    } catch (err) {
      if (isStale()) return;
      setError(err.message);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [token, topicId, limit]);

  useEffect(() => {
    loadWeakItems();
  }, [loadWeakItems]);

  // Loading state
  if (isLoading) {
    return (
      <Box>
        {[1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            height={72}
            sx={{ mb: 1, borderRadius: 1 }}
          />
        ))}
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Typography color="error" gutterBottom>
          Failed to load weak items
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadWeakItems}
          size="small"
        >
          Retry
        </Button>
      </Box>
    );
  }

  // Empty state
  if (weakItems.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          p: 3,
          bgcolor: 'success.main',
          bgcolor: alpha('#4CAF50', 0.1),
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" color="success.main" gutterBottom>
          🎉 Great Job!
        </Typography>
        <Typography color="text.secondary">
          No weak items detected. Keep up the good work!
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="subtitle1" fontWeight={500}>
            Items Needing Practice
          </Typography>
          <Chip
            label={weakItems.length}
            size="small"
            color="warning"
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={loadWeakItems}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {onStudyAll && weakItems.length > 0 && (
            <Button
              variant="contained"
              size="small"
              color="warning"
              startIcon={<StudyIcon />}
              onClick={() => onStudyAll(weakItems)}
            >
              Study All
            </Button>
          )}
        </Box>
      </Box>

      {/* Weak items list */}
      <List disablePadding>
        {weakItems.map((item, index) => (
          <WeakItemRow
            key={`${item.itemId}-${index}`}
            item={item}
            onStudy={onStudyItem}
          />
        ))}
      </List>

      {/* Summary */}
      <Box
        sx={{
          mt: 2,
          p: 2,
          bgcolor: 'action.hover',
          borderRadius: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          💡 Tip: Focus on items with the lowest accuracy first. Regular practice
          on weak items can significantly improve your overall retention.
        </Typography>
      </Box>
    </Box>
  );
}
