/**
 * BrainSettingsSection.js
 *
 * Settings UI for the AI Learning Brain feature.
 * Allows users to:
 * - Enable/disable the brain
 * - Configure heartbeat settings
 * - Manage background service
 * - View brain status and insights
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  Paper,
  Divider,
  Slider,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Psychology as BrainIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  Notifications as NotificationIcon,
  Cloud as ServiceIcon,
  CloudOff as ServiceOffIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  History as HistoryIcon,
  Lightbulb as InsightsIcon,
} from '@mui/icons-material';

import brainApi from '../../api/brainApi';

// Styled components
const SectionPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(2),
}));

const StatusChip = styled(Chip)(({ theme, status }) => ({
  fontWeight: 600,
  ...(status === 'running' && {
    backgroundColor: alpha(theme.palette.success.main, 0.1),
    color: theme.palette.success.main,
    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
  }),
  ...(status === 'stopped' && {
    backgroundColor: alpha(theme.palette.warning.main, 0.1),
    color: theme.palette.warning.main,
    border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
  }),
  ...(status === 'error' && {
    backgroundColor: alpha(theme.palette.error.main, 0.1),
    color: theme.palette.error.main,
    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
  }),
  ...(status === 'disabled' && {
    backgroundColor: alpha(theme.palette.grey[500], 0.1),
    color: theme.palette.grey[500],
    border: `1px solid ${alpha(theme.palette.grey[500], 0.3)}`,
  }),
}));

const SettingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1, 0),
}));

const InsightCard = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.primary.main, 0.05),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  marginBottom: theme.spacing(1),
}));

function BrainSettingsSection() {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [brainEnabled, setBrainEnabled] = useState(true);
  const [brainStatus, setBrainStatus] = useState(null);
  const [serviceStatus, setServiceStatus] = useState(null);
  const [insights, setInsights] = useState(null);
  const [heartbeatHistory, setHeartbeatHistory] = useState([]);
  const [config, setConfig] = useState({
    heartbeat: {
      interval: '24h',
      activeHours: { start: 8, end: 22 },
    },
    notifications: {
      enabled: true,
      streakAlert: true,
      dailySummary: true,
      weeklyReport: true,
      struggleAlert: true,
      welcomeBack: true,
    },
  });
  const [showHistory, setShowHistory] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installError, setInstallError] = useState(null);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, serviceRes, insightsRes, historyRes, configRes] = await Promise.all([
        brainApi.getStatus(),
        brainApi.getServiceStatus(),
        brainApi.getInsights(),
        brainApi.getHeartbeatHistory(10),
        brainApi.getConfig(),
      ]);

      setBrainStatus(statusRes);
      setServiceStatus(serviceRes);
      setInsights(insightsRes);
      setHeartbeatHistory(historyRes || []);
      setBrainEnabled(configRes?.enabled !== false);
      if (configRes?.heartbeat) {
        setConfig((prev) => ({ ...prev, ...configRes }));
      }
    } catch (error) {
      console.error('Failed to load brain settings:', error);
    }
    setIsLoading(false);
  };

  // Toggle brain enabled
  const handleToggleBrain = async (event) => {
    const enabled = event.target.checked;
    setBrainEnabled(enabled);
    try {
      await brainApi.setEnabled(enabled);
    } catch (error) {
      console.error('Failed to toggle brain:', error);
      setBrainEnabled(!enabled);
    }
  };

  // Update notification setting
  const handleNotificationToggle = async (key, value) => {
    const newNotifications = { ...config.notifications, [key]: value };
    setConfig((prev) => ({ ...prev, notifications: newNotifications }));
    try {
      await brainApi.setConfig({ notifications: newNotifications });
    } catch (error) {
      console.error('Failed to update notification setting:', error);
    }
  };

  // Trigger manual heartbeat
  const handleTriggerHeartbeat = async () => {
    try {
      setIsLoading(true);
      await brainApi.triggerHeartbeat();
      await loadData();
    } catch (error) {
      console.error('Failed to trigger heartbeat:', error);
    }
    setIsLoading(false);
  };

  // Install background service
  const handleInstallService = async () => {
    setIsInstalling(true);
    setInstallError(null);
    try {
      const result = await brainApi.installService();
      if (result.success) {
        await loadData();
      } else {
        setInstallError(result.error || 'Installation failed');
      }
    } catch (error) {
      setInstallError(error.message);
    }
    setIsInstalling(false);
  };

  // Uninstall background service
  const handleUninstallService = async () => {
    try {
      await brainApi.uninstallService();
      await loadData();
    } catch (error) {
      console.error('Failed to uninstall service:', error);
    }
  };

  // Get status label and icon
  const getStatusInfo = () => {
    if (!brainEnabled) {
      return { status: 'disabled', label: 'Disabled', icon: <PauseIcon /> };
    }
    if (brainStatus?.mode === 'service' && serviceStatus?.running) {
      return { status: 'running', label: 'Running (Service)', icon: <SuccessIcon /> };
    }
    if (brainStatus?.mode === 'hybrid' && brainStatus?.isRunning) {
      return { status: 'running', label: 'Running (Hybrid)', icon: <SuccessIcon /> };
    }
    return { status: 'stopped', label: 'Stopped', icon: <WarningIcon /> };
  };

  const statusInfo = getStatusInfo();

  // Format time until next heartbeat
  const formatTimeUntilNext = () => {
    if (!brainStatus?.nextScheduledHeartbeat) return 'Not scheduled';
    const next = new Date(brainStatus.nextScheduledHeartbeat);
    const diff = next - Date.now();
    if (diff < 0) return 'Due now';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (isLoading && !brainStatus) {
    return (
      <SectionPaper>
        <Box display="flex" alignItems="center" justifyContent="center" py={4}>
          <CircularProgress size={24} sx={{ mr: 2 }} />
          <Typography>Loading brain settings...</Typography>
        </Box>
      </SectionPaper>
    );
  }

  return (
    <Box>
      {/* Header */}
      <SectionPaper>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <BrainIcon color="primary" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h6">AI Learning Brain</Typography>
              <Typography variant="body2" color="text.secondary">
                Autonomous learning manager with episodic memory
              </Typography>
            </Box>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <StatusChip
              status={statusInfo.status}
              icon={statusInfo.icon}
              label={statusInfo.label}
              size="small"
            />
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={loadData} disabled={isLoading} size="small">
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Enable/Disable */}
        <SettingRow>
          <Box>
            <Typography variant="body1">Enable Learning Brain</Typography>
            <Typography variant="body2" color="text.secondary">
              Analyze learning patterns and provide insights
            </Typography>
          </Box>
          <Switch checked={brainEnabled} onChange={handleToggleBrain} />
        </SettingRow>
      </SectionPaper>

      {brainEnabled && (
        <>
          {/* Current Insights */}
          {insights && (
            <SectionPaper>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <InsightsIcon color="primary" />
                <Typography variant="h6">Current Insights</Typography>
              </Box>

              <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(150px, 1fr))" gap={2}>
                <InsightCard>
                  <Typography variant="body2" color="text.secondary">
                    Due Items
                  </Typography>
                  <Typography variant="h4">{insights.dueItemsCount || 0}</Typography>
                </InsightCard>

                <InsightCard>
                  <Typography variant="body2" color="text.secondary">
                    Streak
                  </Typography>
                  <Typography variant="h4">{insights.streakDays || 0} days</Typography>
                </InsightCard>

                <InsightCard>
                  <Typography variant="body2" color="text.secondary">
                    Weekly Accuracy
                  </Typography>
                  <Typography variant="h4">{insights.weeklyAccuracy || 0}%</Typography>
                </InsightCard>

                <InsightCard>
                  <Typography variant="body2" color="text.secondary">
                    Weekly Reviews
                  </Typography>
                  <Typography variant="h4">{insights.weeklyReviews || 0}</Typography>
                </InsightCard>
              </Box>

              {insights.weakConcepts?.length > 0 && (
                <Box mt={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Focus Areas
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {insights.weakConcepts.slice(0, 5).map((concept, i) => (
                      <Chip
                        key={i}
                        label={concept.name || concept}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {insights.lastUpdated && (
                <Typography variant="caption" color="text.secondary" display="block" mt={2}>
                  Last updated: {new Date(insights.lastUpdated).toLocaleString()}
                </Typography>
              )}
            </SectionPaper>
          )}

          {/* Heartbeat Settings */}
          <SectionPaper>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <ScheduleIcon color="primary" />
              <Typography variant="h6">Heartbeat Schedule</Typography>
            </Box>

            <SettingRow>
              <Box>
                <Typography variant="body1">Next Heartbeat</Typography>
                <Typography variant="body2" color="text.secondary">
                  {brainStatus?.nextScheduledHeartbeat
                    ? new Date(brainStatus.nextScheduledHeartbeat).toLocaleString()
                    : 'Not scheduled'}
                </Typography>
              </Box>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  label={formatTimeUntilNext()}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlayIcon />}
                  onClick={handleTriggerHeartbeat}
                  disabled={isLoading}
                >
                  Run Now
                </Button>
              </Box>
            </SettingRow>

            <Divider sx={{ my: 2 }} />

            {/* Heartbeat History */}
            <Box>
              <Button
                variant="text"
                onClick={() => setShowHistory(!showHistory)}
                endIcon={showHistory ? <CollapseIcon /> : <ExpandIcon />}
                startIcon={<HistoryIcon />}
                size="small"
              >
                Heartbeat History ({heartbeatHistory.length})
              </Button>

              <Collapse in={showHistory}>
                <List dense>
                  {heartbeatHistory.length === 0 ? (
                    <ListItem>
                      <ListItemText primary="No heartbeat history yet" />
                    </ListItem>
                  ) : (
                    heartbeatHistory.map((entry, i) => (
                      <ListItem key={i}>
                        <ListItemIcon>
                          {entry.status === 'success' ? (
                            <SuccessIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="error" fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={new Date(entry.time).toLocaleString()}
                          secondary={`${entry.status} - ${entry.duration || 0}ms${entry.isCatchUp ? ' (catch-up)' : ''}${entry.manual ? ' (manual)' : ''}`}
                        />
                      </ListItem>
                    ))
                  )}
                </List>
              </Collapse>
            </Box>
          </SectionPaper>

          {/* Background Service */}
          <SectionPaper>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              {serviceStatus?.installed ? (
                <ServiceIcon color="primary" />
              ) : (
                <ServiceOffIcon color="disabled" />
              )}
              <Typography variant="h6">Background Service</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" paragraph>
              The background service allows the Learning Brain to run even when the app is closed,
              sending notifications and analyzing your learning patterns.
            </Typography>

            {installError && (
              <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setInstallError(null)}>
                {installError}
                <Typography variant="caption" display="block" mt={1}>
                  The app will use hybrid mode (in-app scheduler + catch-up on launch) instead.
                </Typography>
              </Alert>
            )}

            <SettingRow>
              <Box>
                <Typography variant="body1">Service Status</Typography>
                <Typography variant="body2" color="text.secondary">
                  {serviceStatus?.installed
                    ? serviceStatus?.running
                      ? 'Installed and running'
                      : 'Installed but not running'
                    : 'Not installed (using hybrid mode)'}
                </Typography>
              </Box>
              <Box display="flex" gap={1}>
                {serviceStatus?.installed ? (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    onClick={handleUninstallService}
                  >
                    Uninstall
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleInstallService}
                    disabled={isInstalling}
                    startIcon={isInstalling && <CircularProgress size={16} />}
                  >
                    {isInstalling ? 'Installing...' : 'Install Service'}
                  </Button>
                )}
              </Box>
            </SettingRow>
          </SectionPaper>

          {/* Notification Settings */}
          <SectionPaper>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <NotificationIcon color="primary" />
              <Typography variant="h6">Notifications</Typography>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={config.notifications?.enabled !== false}
                  onChange={(e) => handleNotificationToggle('enabled', e.target.checked)}
                />
              }
              label="Enable notifications"
            />

            <Collapse in={config.notifications?.enabled !== false}>
              <Box ml={3} mt={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.notifications?.streakAlert !== false}
                      onChange={(e) => handleNotificationToggle('streakAlert', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Streak at risk alerts"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.notifications?.dailySummary !== false}
                      onChange={(e) => handleNotificationToggle('dailySummary', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Daily review reminders"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.notifications?.weeklyReport !== false}
                      onChange={(e) => handleNotificationToggle('weeklyReport', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Weekly progress reports"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.notifications?.struggleAlert !== false}
                      onChange={(e) => handleNotificationToggle('struggleAlert', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Focus area alerts"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.notifications?.welcomeBack !== false}
                      onChange={(e) => handleNotificationToggle('welcomeBack', e.target.checked)}
                      size="small"
                    />
                  }
                  label="Welcome back messages"
                />
              </Box>
            </Collapse>
          </SectionPaper>
        </>
      )}
    </Box>
  );
}

export default BrainSettingsSection;
