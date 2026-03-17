/**
 * ReviewStep.js
 *
 * Step 5: Review and create the learning plan
 * - Summary of all selections
 * - Final settings (reminders, sync)
 * - Create plan button
 */

import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Divider,
  Chip,
  Switch,
  FormControlLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Collapse,
  Alert,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Flag as GoalIcon,
  LibraryBooks as MaterialIcon,
  Input as ImportIcon,
  Schedule as TimeIcon,
  Notifications as NotificationIcon,
  Sync as SyncIcon,
  ArrowBack as BackIcon,
  PlayArrow as StartIcon,
  CheckCircle as CheckIcon,
  Info as InfoIcon,
  EmojiEvents as TrophyIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';

import { DOMAIN_COLORS } from '../LearningPlanWizard';

// Styled components
const StepContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minHeight: 400,
}));

const SummaryCard = styled(Paper)(({ theme, color }) => ({
  padding: theme.spacing(2.5),
  borderRadius: 12,
  background:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
    background: color,
  },
}));

const PlanHighlight = styled(Box)(({ theme, color }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  background: `linear-gradient(135deg, ${alpha(color, 0.1)}, ${alpha(color, 0.05)})`,
  border: `2px solid ${alpha(color, 0.3)}`,
  textAlign: 'center',
  position: 'relative',
  overflow: 'hidden',
}));

const SettingsCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  background:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
}));

const NavigationBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 'auto',
  paddingTop: theme.spacing(2),
}));

// Domain labels
const DOMAIN_LABELS = {
  vocabulary: 'Vocabulary',
  math: 'Math & Science',
  language: 'Language Learning',
  knowledge: 'General Knowledge',
  skill: 'Skills & Procedures',
};

// Source type labels
const SOURCE_LABELS = {
  file: 'Imported File',
  book: 'Library Book',
  vocabulary_set: 'Vocabulary Set',
  url: 'Web URL',
  manual: 'Manual Entry',
};

function ReviewStep({ data, updateData, onBack, onCreatePlan, isSubmitting }) {
  const domainColor = DOMAIN_COLORS[data.domainType]?.primary || '#666';

  const handleReminderToggle = useCallback(
    (e) => {
      updateData({ enableReminders: e.target.checked });
    },
    [updateData]
  );

  const handleSyncToggle = useCallback(
    (e) => {
      updateData({ syncProgress: e.target.checked });
    },
    [updateData]
  );

  // Plan stats
  const planStats = useMemo(() => {
    if (data.calculatedPlan) {
      // Access fields from the calculation object returned by LearningPlanGenerator
      const calc = data.calculatedPlan.calculation || {};
      return {
        daysToComplete: calc.daysToComplete || data.calculatedPlan.estimatedDuration || 0,
        newItemsPerDay: calc.newItemsPerDay || 1,
        completionDate: calc.estimatedCompletion
          ? dayjs(calc.estimatedCompletion).format('MMMM D, YYYY')
          : dayjs().add(calc.daysToComplete || 30, 'day').format('MMMM D, YYYY'),
        retention: 85, // Not calculated by generator, use default
      };
    }

    // Fallback estimation
    const avgMinutesPerItem = 2;
    const newItemsPerDay = Math.max(1, Math.floor(data.dailyMinutes / avgMinutesPerItem));
    const daysToComplete = Math.ceil(data.learningPoints.length / (newItemsPerDay * 0.5));

    return {
      daysToComplete,
      newItemsPerDay,
      completionDate: dayjs().add(daysToComplete, 'day').format('MMMM D, YYYY'),
      retention: 85,
    };
  }, [data.calculatedPlan, data.dailyMinutes, data.learningPoints.length]);

  // Get source description
  const sourceDescription = useMemo(() => {
    if (data.sourceType === 'file' && data.sourceFile) {
      return data.sourceFile.name;
    }
    if (data.sourceType === 'book' && data.selectedBook) {
      return data.selectedBook.title;
    }
    if (data.sourceType === 'vocabulary_set' && data.selectedVocabularySet) {
      return data.selectedVocabularySet.name || `Set ${data.selectedVocabularySet.id}`;
    }
    if (data.sourceType === 'url' && data.sourceUrl) {
      return data.sourceUrl;
    }
    return SOURCE_LABELS[data.sourceType];
  }, [data]);

  // Time of day label
  const timeOfDayLabel = useMemo(() => {
    const labels = {
      morning: 'Morning (6 AM - 12 PM)',
      afternoon: 'Afternoon (12 PM - 6 PM)',
      evening: 'Evening (6 PM - 10 PM)',
      any: 'Flexible (Any time)',
    };
    return labels[data.preferredTimeOfDay] || 'Flexible';
  }, [data.preferredTimeOfDay]);

  return (
    <StepContainer>
      {/* Plan Highlight */}
      <PlanHighlight color={domainColor}>
        <TrophyIcon sx={{ fontSize: 48, color: domainColor, mb: 1 }} />
        <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
          {data.goalName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Chip
            label={DOMAIN_LABELS[data.domainType]}
            size="small"
            sx={{ bgcolor: alpha(domainColor, 0.2), color: domainColor }}
          />
          <Chip
            label={`${data.learningPoints.length} items`}
            size="small"
            sx={{ bgcolor: alpha(domainColor, 0.1) }}
          />
          <Chip
            label={`${data.dailyMinutes} min/day`}
            size="small"
            sx={{ bgcolor: alpha(domainColor, 0.1) }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Estimated completion: <strong>{planStats.completionDate}</strong>
        </Typography>
      </PlanHighlight>

      {/* Summary Grid */}
      <Grid container spacing={2}>
        {/* Goal Summary */}
        <Grid item xs={12} md={6}>
          <SummaryCard color={domainColor} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pl: 1 }}>
              <GoalIcon sx={{ color: domainColor, fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Goal
              </Typography>
            </Box>
            <List dense disablePadding>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={data.goalName}
                  secondary={DOMAIN_LABELS[data.domainType]}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              {data.description && (
                <ListItem disablePadding sx={{ pl: 1 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={data.description}
                    primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                  />
                </ListItem>
              )}
            </List>
          </SummaryCard>
        </Grid>

        {/* Material Summary */}
        <Grid item xs={12} md={6}>
          <SummaryCard color={domainColor} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pl: 1 }}>
              <MaterialIcon sx={{ color: domainColor, fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Material
              </Typography>
            </Box>
            <List dense disablePadding>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={sourceDescription}
                  secondary={SOURCE_LABELS[data.sourceType]}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 200,
                    },
                  }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ImportIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </ListItemIcon>
                <ListItemText
                  primary={`${data.learningPoints.length} learning items imported`}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
            </List>
          </SummaryCard>
        </Grid>

        {/* Schedule Summary */}
        <Grid item xs={12} md={6}>
          <SummaryCard color={domainColor} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pl: 1 }}>
              <TimeIcon sx={{ color: domainColor, fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Schedule
              </Typography>
            </Box>
            <List dense disablePadding>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={`${data.dailyMinutes} minutes per day`}
                  secondary={timeOfDayLabel}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </ListItemIcon>
                <ListItemText
                  primary={`~${planStats.newItemsPerDay} new items + reviews daily`}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
            </List>
          </SummaryCard>
        </Grid>

        {/* Projection Summary */}
        <Grid item xs={12} md={6}>
          <SummaryCard color={domainColor} elevation={0}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pl: 1 }}>
              <TrophyIcon sx={{ color: domainColor, fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                Projection
              </Typography>
            </Box>
            <List dense disablePadding>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={`Complete in ~${planStats.daysToComplete} days`}
                  secondary={`By ${planStats.completionDate}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
              <ListItem disablePadding sx={{ pl: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <InfoIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </ListItemIcon>
                <ListItemText
                  primary={`${planStats.retention}% expected retention rate`}
                  primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
                />
              </ListItem>
            </List>
          </SummaryCard>
        </Grid>
      </Grid>

      <Divider />

      {/* Additional Settings */}
      <SettingsCard elevation={0}>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
          Additional Settings
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={data.enableReminders}
                onChange={handleReminderToggle}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: domainColor,
                    '& + .MuiSwitch-track': {
                      backgroundColor: domainColor,
                    },
                  },
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <NotificationIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2">Enable Reminders</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Get notified at your preferred study time
                  </Typography>
                </Box>
              </Box>
            }
          />

          <FormControlLabel
            control={
              <Switch
                checked={data.syncProgress}
                onChange={handleSyncToggle}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: domainColor,
                    '& + .MuiSwitch-track': {
                      backgroundColor: domainColor,
                    },
                  },
                }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SyncIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Box>
                  <Typography variant="body2">Sync to Knowledge Graph</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Track mastery in your knowledge network
                  </Typography>
                </Box>
              </Box>
            }
          />
        </Box>
      </SettingsCard>

      {/* Info Alert */}
      <Alert severity="info" icon={<InfoIcon />}>
        Your learning plan will use the Leitner spaced repetition system with 5 boxes.
        Items move forward when answered correctly, and back to box 1 when incorrect.
      </Alert>

      {/* Navigation */}
      <NavigationBox>
        <Button
          startIcon={<BackIcon />}
          onClick={onBack}
          disabled={isSubmitting}
          sx={{ px: 3 }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <StartIcon />}
          onClick={onCreatePlan}
          disabled={isSubmitting}
          sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            fontSize: '1rem',
            fontWeight: 600,
            background: `linear-gradient(135deg, ${domainColor}, ${alpha(domainColor, 0.8)})`,
            boxShadow: `0 4px 20px ${alpha(domainColor, 0.4)}`,
            '&:hover': {
              background: `linear-gradient(135deg, ${domainColor}, ${domainColor})`,
              boxShadow: `0 6px 24px ${alpha(domainColor, 0.5)}`,
            },
            '&.Mui-disabled': {
              background: 'rgba(0, 0, 0, 0.12)',
              boxShadow: 'none',
            },
          }}
        >
          {isSubmitting ? 'Creating Plan...' : 'Start Learning!'}
        </Button>
      </NavigationBox>
    </StepContainer>
  );
}

export default ReviewStep;
