/**
 * CommitmentStep.js
 *
 * Step 4: Set time commitment and deadline
 * - Daily study time slider
 * - Target completion date picker
 * - Preferred time of day
 * - Calculated plan preview
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Slider,
  Button,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Grid,
  Divider,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Schedule as TimeIcon,
  CalendarMonth as CalendarIcon,
  WbSunny as MorningIcon,
  WbTwilight as AfternoonIcon,
  NightsStay as EveningIcon,
  AllInclusive as AnyTimeIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Speed as SpeedIcon,
  TrendingUp as ProgressIcon,
  EmojiEvents as GoalIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

import { DOMAIN_COLORS } from '../LearningPlanWizard';

// Styled components
const StepContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  minHeight: 400,
}));

const SettingCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  borderRadius: 12,
  background:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
}));

const PlanPreviewCard = styled(Paper)(({ theme, color }) => ({
  padding: theme.spacing(3),
  borderRadius: 12,
  background: `linear-gradient(135deg, ${alpha(color, 0.05)}, ${alpha(color, 0.02)})`,
  border: `1px solid ${alpha(color, 0.2)}`,
}));

const StatBox = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(1.5),
  borderRadius: 8,
  background:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
}));

const NavigationBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 'auto',
  paddingTop: theme.spacing(2),
}));

// Time marks for slider
const TIME_MARKS = [
  { value: 10, label: '10m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
];

// Time of day options
const TIME_OF_DAY_OPTIONS = [
  { value: 'morning', label: 'Morning', icon: MorningIcon, description: '6 AM - 12 PM' },
  { value: 'afternoon', label: 'Afternoon', icon: AfternoonIcon, description: '12 PM - 6 PM' },
  { value: 'evening', label: 'Evening', icon: EveningIcon, description: '6 PM - 10 PM' },
  { value: 'any', label: 'Flexible', icon: AnyTimeIcon, description: 'Any time' },
];

function CommitmentStep({ data, updateData, onNext, onBack, isValid }) {
  const [isCalculating, setIsCalculating] = useState(false);

  const domainColor = DOMAIN_COLORS[data.domainType]?.primary || '#666';
  const itemCount = data.learningPoints.length;

  // Calculate plan when inputs change
  useEffect(() => {
    const calculatePlan = async () => {
      if (itemCount === 0 || data.dailyMinutes <= 0) {
        updateData({ calculatedPlan: null });
        return;
      }

      setIsCalculating(true);

      try {
        // Call LearningPlanGenerator to calculate schedule
        const result = await window.electron.ipcRenderer.invoke('learning-plan-calculate', {
          totalItems: itemCount,
          dailyMinutes: data.dailyMinutes,
          targetDate: data.targetDate ? data.targetDate.toISOString() : null,
          domain: data.domainType,
          algorithm: 'leitner', // or 'fsrs'
        });

        if (result?.success) {
          updateData({ calculatedPlan: result.plan });
        }
      } catch (err) {
        console.error('Error calculating plan:', err);
      } finally {
        setIsCalculating(false);
      }
    };

    // Debounce calculation
    const timer = setTimeout(calculatePlan, 500);
    return () => clearTimeout(timer);
  }, [itemCount, data.dailyMinutes, data.targetDate, data.domainType, updateData]);

  const handleDailyMinutesChange = useCallback(
    (_, value) => {
      updateData({ dailyMinutes: value });
    },
    [updateData]
  );

  const handleTargetDateChange = useCallback(
    (date) => {
      updateData({ targetDate: date });
    },
    [updateData]
  );

  const handleTimeOfDayChange = useCallback(
    (_, value) => {
      if (value) {
        updateData({ preferredTimeOfDay: value });
      }
    },
    [updateData]
  );

  // Derive stats from calculated plan
  const planStats = useMemo(() => {
    if (!data.calculatedPlan) {
      // Estimate if no calculation yet
      const avgMinutesPerItem = 2; // Average 2 minutes per card review
      const newItemsPerDay = Math.floor(data.dailyMinutes / avgMinutesPerItem);
      const daysToComplete = Math.ceil(itemCount / (newItemsPerDay * 0.5)); // Factor in reviews

      return {
        daysToComplete,
        newItemsPerDay: newItemsPerDay > 0 ? newItemsPerDay : 1,
        reviewsPerDay: Math.ceil(newItemsPerDay * 1.5),
        completionDate: dayjs().add(daysToComplete, 'day').format('MMM D, YYYY'),
        estimatedRetention: 85,
      };
    }

    // Access fields from the calculation object returned by LearningPlanGenerator
    const calc = data.calculatedPlan.calculation || {};
    return {
      daysToComplete: calc.daysToComplete || data.calculatedPlan.estimatedDuration || 0,
      newItemsPerDay: calc.newItemsPerDay || 1,
      reviewsPerDay: calc.reviewsPerDay || 1,
      completionDate: calc.estimatedCompletion
        ? dayjs(calc.estimatedCompletion).format('MMM D, YYYY')
        : dayjs().add(calc.daysToComplete || 30, 'day').format('MMM D, YYYY'),
      estimatedRetention: 85, // Not calculated by generator, use default
    };
  }, [data.calculatedPlan, data.dailyMinutes, itemCount]);

  // Check if deadline is realistic
  const deadlineWarning = useMemo(() => {
    if (!data.targetDate) return null;

    const targetDays = dayjs(data.targetDate).diff(dayjs(), 'day');
    if (targetDays < planStats.daysToComplete) {
      return `This deadline requires more study time. Consider increasing to ${Math.ceil(
        data.dailyMinutes * (planStats.daysToComplete / targetDays)
      )} minutes/day.`;
    }
    return null;
  }, [data.targetDate, planStats.daysToComplete, data.dailyMinutes]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <StepContainer>
        <Grid container spacing={3}>
          {/* Daily Study Time */}
          <Grid item xs={12} md={6}>
            <SettingCard elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TimeIcon sx={{ color: domainColor }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Daily Study Time
                </Typography>
              </Box>

              <Box sx={{ px: 2, pt: 2 }}>
                <Typography
                  variant="h4"
                  fontWeight={700}
                  sx={{ color: domainColor, mb: 3, textAlign: 'center' }}
                >
                  {data.dailyMinutes} minutes
                </Typography>

                <Slider
                  value={data.dailyMinutes}
                  onChange={handleDailyMinutesChange}
                  min={5}
                  max={120}
                  step={5}
                  marks={TIME_MARKS}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}m`}
                  sx={{
                    color: domainColor,
                    '& .MuiSlider-thumb': {
                      boxShadow: `0 0 0 8px ${alpha(domainColor, 0.16)}`,
                    },
                    '& .MuiSlider-track': {
                      background: `linear-gradient(90deg, ${alpha(domainColor, 0.7)}, ${domainColor})`,
                    },
                  }}
                />
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Consistency is more important than duration. Start small and build up.
              </Typography>
            </SettingCard>
          </Grid>

          {/* Target Date */}
          <Grid item xs={12} md={6}>
            <SettingCard elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarIcon sx={{ color: domainColor }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Target Completion Date
                </Typography>
                <Chip label="Optional" size="small" sx={{ ml: 'auto' }} />
              </Box>

              <DatePicker
                value={data.targetDate}
                onChange={handleTargetDateChange}
                minDate={dayjs().add(1, 'day')}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    placeholder: 'Select a date (optional)',
                    size: 'small',
                  },
                }}
              />

              {deadlineWarning && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  sx={{ mt: 1, display: 'block' }}
                >
                  ⚠️ {deadlineWarning}
                </Typography>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Leave empty for a relaxed pace, or set a deadline for exams/tests.
              </Typography>
            </SettingCard>
          </Grid>

          {/* Preferred Time of Day */}
          <Grid item xs={12}>
            <SettingCard elevation={0}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TimeIcon sx={{ color: domainColor }} />
                <Typography variant="subtitle1" fontWeight={600}>
                  Preferred Study Time
                </Typography>
              </Box>

              <ToggleButtonGroup
                value={data.preferredTimeOfDay}
                exclusive
                onChange={handleTimeOfDayChange}
                fullWidth
                sx={{
                  '& .MuiToggleButton-root': {
                    py: 1.5,
                    flexDirection: 'column',
                    gap: 0.5,
                    '&.Mui-selected': {
                      bgcolor: alpha(domainColor, 0.1),
                      borderColor: domainColor,
                      color: domainColor,
                      '&:hover': {
                        bgcolor: alpha(domainColor, 0.15),
                      },
                    },
                  },
                }}
              >
                {TIME_OF_DAY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <ToggleButton key={option.value} value={option.value}>
                      <Icon fontSize="small" />
                      <Typography variant="caption" fontWeight={600}>
                        {option.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {option.description}
                      </Typography>
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                We'll send reminders at your preferred time (if enabled).
              </Typography>
            </SettingCard>
          </Grid>
        </Grid>

        <Divider />

        {/* Plan Preview */}
        <PlanPreviewCard color={domainColor} elevation={0}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ProgressIcon sx={{ color: domainColor }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Your Learning Plan Preview
            </Typography>
            {isCalculating && <CircularProgress size={16} sx={{ ml: 1 }} />}
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <StatBox>
                <Typography variant="h5" fontWeight={700} sx={{ color: domainColor }}>
                  {itemCount}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Items
                </Typography>
              </StatBox>
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatBox>
                <Typography variant="h5" fontWeight={700} sx={{ color: domainColor }}>
                  {planStats.newItemsPerDay}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  New/Day
                </Typography>
              </StatBox>
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatBox>
                <Typography variant="h5" fontWeight={700} sx={{ color: domainColor }}>
                  ~{planStats.daysToComplete}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Days to Complete
                </Typography>
              </StatBox>
            </Grid>
            <Grid item xs={6} sm={3}>
              <StatBox>
                <Typography variant="h5" fontWeight={700} sx={{ color: domainColor }}>
                  {planStats.estimatedRetention}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Est. Retention
                </Typography>
              </StatBox>
            </Grid>
          </Grid>

          <Box
            sx={{
              mt: 2,
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha(domainColor, 0.05),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            <GoalIcon sx={{ color: domainColor }} />
            <Typography variant="body2">
              Estimated completion: <strong>{planStats.completionDate}</strong>
            </Typography>
          </Box>
        </PlanPreviewCard>

        {/* Navigation */}
        <NavigationBox>
          <Button startIcon={<BackIcon />} onClick={onBack} sx={{ px: 3 }}>
            Back
          </Button>
          <Button
            variant="contained"
            endIcon={<NextIcon />}
            onClick={onNext}
            disabled={!isValid}
            sx={{
              px: 4,
              py: 1,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${domainColor}, ${alpha(domainColor, 0.8)})`,
              '&:hover': {
                background: `linear-gradient(135deg, ${domainColor}, ${domainColor})`,
              },
              '&.Mui-disabled': {
                background: 'rgba(0, 0, 0, 0.12)',
              },
            }}
          >
            Review Plan
          </Button>
        </NavigationBox>
      </StepContainer>
    </LocalizationProvider>
  );
}

export default CommitmentStep;
