/**
 * NotificationsPanel.js
 *
 * A professionally styled panel displaying learning notifications
 * including study reminders, achievements, milestones, streaks, and reviews.
 * Features glass-morphism design, smooth animations, and intuitive visual hierarchy.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';

import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SchoolIcon from '@mui/icons-material/School';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ScheduleIcon from '@mui/icons-material/Schedule';

import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
} from '../../api/notificationApi';
import customStorage from '../../store/customStorage';

// Notification type styling
const NOTIFICATION_STYLES = {
  study_reminder: {
    color: '#1E88E5',
    darkColor: '#42A5F5',
    icon: SchoolIcon,
    label: 'Study Reminder',
    bg: '#E3F2FD',
    darkBg: '#0D2137',
  },
  achievement: {
    color: '#FDD835',
    darkColor: '#FFEE58',
    icon: EmojiEventsIcon,
    label: 'Achievement',
    bg: '#FFF8E1',
    darkBg: '#2D2600',
  },
  milestone: {
    color: '#9C27B0',
    darkColor: '#BA68C8',
    icon: StarIcon,
    label: 'Milestone',
    bg: '#F3E5F5',
    darkBg: '#2D1F30',
  },
  streak: {
    color: '#FF5722',
    darkColor: '#FF7043',
    icon: LocalFireDepartmentIcon,
    label: 'Streak',
    bg: '#FBE9E7',
    darkBg: '#2D1810',
  },
  review_due: {
    color: '#43A047',
    darkColor: '#66BB6A',
    icon: AccessTimeIcon,
    label: 'Review Due',
    bg: '#E8F5E9',
    darkBg: '#1B3A1B',
  },
  session_complete: {
    color: '#00ACC1',
    darkColor: '#26C6DA',
    icon: CheckCircleIcon,
    label: 'Session Complete',
    bg: '#E0F7FA',
    darkBg: '#0D3333',
  },
};

// Priority styling
const PRIORITY_STYLES = {
  high: { color: '#E53935', darkColor: '#EF5350' },
  normal: { color: '#FB8C00', darkColor: '#FFA726' },
  low: { color: '#9E9E9E', darkColor: '#BDBDBD' },
};

// Format relative time
function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPanel({
  onNotificationClick,
  onClose,
  maxHeight = 400,
  compact = false,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  customStorage.getSessionToken(); // Reserved for authenticated calls

  // Load notifications
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listResult, countResult] = await Promise.all([
        getNotifications({
          limit: 50,
          includeRead: activeTab === 1,
        }),
        getUnreadCount(),
      ]);

      if (listResult.success) {
        setNotifications(listResult.notifications || []);
      }
      if (countResult.success) {
        setUnreadCount(countResult.count || 0);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[NotificationsPanel] Error loading:', e);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Mark notification as read
  const handleMarkRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? { ...n, readAt: new Date().toISOString() }
            : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[NotificationsPanel] Error marking read:', e);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[NotificationsPanel] Error marking all read:', e);
    }
  };

  // Dismiss notification
  const handleDismiss = async (notificationId) => {
    try {
      await dismissNotification(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[NotificationsPanel] Error dismissing:', e);
    }
  };

  // Get filtered notifications based on tab
  const filteredNotifications =
    activeTab === 0 ? notifications.filter((n) => !n.readAt) : notifications;

  // Render notification item
  const renderNotificationItem = (notification) => {
    const style =
      NOTIFICATION_STYLES[notification.type] ||
      NOTIFICATION_STYLES.study_reminder;
    const Icon = style.icon;
    const isUnread = !notification.readAt;
    const priorityStyle =
      PRIORITY_STYLES[notification.priority] || PRIORITY_STYLES.normal;

    return (
      <Box
        key={notification.id}
        onClick={() => {
          if (isUnread) handleMarkRead(notification.id);
          onNotificationClick?.(notification);
        }}
        sx={{
          p: 1.5,
          mb: 1,
          borderRadius: 2,
          cursor: 'pointer',
          position: 'relative',
          bgcolor: isDark ? style.darkBg : style.bg,
          border: `1px solid ${alpha(isDark ? style.darkColor : style.color, isUnread ? 0.4 : 0.15)}`,
          boxShadow: isUnread
            ? `0 2px 8px ${alpha(isDark ? style.darkColor : style.color, 0.2)}`
            : 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: `0 4px 12px ${alpha(isDark ? style.darkColor : style.color, 0.25)}`,
          },
        }}
      >
        {/* Unread indicator */}
        {isUnread && (
          <Box
            sx={{
              position: 'absolute',
              left: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: isDark ? style.darkColor : style.color,
            }}
          />
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            pl: isUnread ? 1.5 : 0,
          }}
        >
          {/* Icon */}
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: alpha(isDark ? style.darkColor : style.color, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              sx={{
                fontSize: 20,
                color: isDark ? style.darkColor : style.color,
              }}
            />
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: isUnread ? 600 : 500,
                  color: isDark ? '#fff' : '#1a1a1a',
                  fontSize: '0.85rem',
                }}
              >
                {notification.title}
              </Typography>
              {notification.priority === 'high' && (
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: isDark
                      ? priorityStyle.darkColor
                      : priorityStyle.color,
                  }}
                />
              )}
            </Box>

            <Typography
              variant="body2"
              sx={{
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                fontSize: '0.8rem',
                lineHeight: 1.4,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {notification.message}
            </Typography>

            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}
            >
              <Chip
                label={style.label}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  bgcolor: alpha(isDark ? style.darkColor : style.color, 0.15),
                  color: isDark ? style.darkColor : style.color,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
                  fontSize: '0.7rem',
                }}
              >
                {formatRelativeTime(notification.createdAt)}
              </Typography>
            </Box>
          </Box>

          {/* Dismiss button */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(notification.id);
            }}
            sx={{
              opacity: 0.5,
              '&:hover': { opacity: 1 },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        width: compact ? 320 : 380,
        maxHeight,
        bgcolor: isDark ? alpha('#1a1a1a', 0.95) : alpha('#fff', 0.95),
        backdropFilter: 'blur(12px)',
        borderRadius: 3,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        boxShadow: isDark
          ? '0 8px 32px rgba(0,0,0,0.5)'
          : '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon sx={{ color: isDark ? '#fff' : '#1a1a1a' }} />
          </Badge>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem' }}>
            Notifications
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Mark all as read">
            <span>
              <IconButton
                size="small"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
              >
                <DoneAllIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={loadNotifications}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          {onClose && (
            <IconButton size="small" onClick={onClose}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          '& .MuiTab-root': {
            minHeight: 36,
            fontSize: '0.8rem',
            textTransform: 'none',
          },
        }}
      >
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <NotificationsActiveIcon sx={{ fontSize: 16 }} />
              <span>Unread ({unreadCount})</span>
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleIcon sx={{ fontSize: 16 }} />
              <span>All</span>
            </Box>
          }
        />
      </Tabs>

      {/* Content */}
      <Box
        sx={{
          p: 1.5,
          maxHeight: maxHeight - 130,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            borderRadius: 3,
          },
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {!loading && error && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="error" variant="body2">
              {error}
            </Typography>
            <Button size="small" onClick={loadNotifications} sx={{ mt: 1 }}>
              Retry
            </Button>
          </Box>
        )}
        {!loading && !error && filteredNotifications.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <NotificationsOffIcon
              sx={{
                fontSize: 48,
                color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                mb: 1,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
              }}
            >
              {activeTab === 0
                ? 'No unread notifications'
                : 'No notifications yet'}
            </Typography>
          </Box>
        )}
        {!loading &&
          !error &&
          filteredNotifications.length > 0 &&
          filteredNotifications.map(renderNotificationItem)}
      </Box>
    </Box>
  );
}
