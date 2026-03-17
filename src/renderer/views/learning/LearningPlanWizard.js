/**
 * LearningPlanWizard.js
 *
 * Main wizard container for creating a learning plan.
 * 5-step process:
 * 1. Goal - Define learning goal and domain
 * 2. Material - Select source material
 * 3. Import - Add/create learning points
 * 4. Commitment - Set time and deadline
 * 5. Review - Confirm and create plan
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  Typography,
  IconButton,
  Fade,
  LinearProgress,
  useMediaQuery,
} from '@mui/material';
import { styled, alpha, useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Flag as GoalIcon,
  LibraryBooks as MaterialIcon,
  Input as ImportIcon,
  Schedule as CommitmentIcon,
  PlayArrow as ReviewIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import GoalStep from './steps/GoalStep';
import MaterialStep from './steps/MaterialStep';
import ImportStep from './steps/ImportStep';
import CommitmentStep from './steps/CommitmentStep';
import ReviewStep from './steps/ReviewStep';

// Styled components
const WizardContainer = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    maxWidth: 900,
    width: '100%',
    minHeight: '70vh',
    maxHeight: '90vh',
    background:
      theme.palette.mode === 'dark'
        ? 'linear-gradient(135deg, rgba(30, 33, 38, 0.98), rgba(25, 28, 32, 0.98))'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.98))',
    backdropFilter: 'blur(20px)',
    overflow: 'hidden',
  },
  '& .MuiBackdrop-root': {
    backdropFilter: 'blur(8px)',
    background:
      theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.4)',
  },
}));

const WizardHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background:
    theme.palette.mode === 'dark'
      ? 'linear-gradient(135deg, rgba(40, 45, 50, 0.95), rgba(35, 40, 45, 0.95))'
      : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 247, 250, 0.95))',
}));

const WizardBody = styled(Box)(({ theme }) => ({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
}));

const StepperSidebar = styled(Box)(({ theme }) => ({
  width: 220,
  padding: theme.spacing(3, 2),
  borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  background:
    theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
  [theme.breakpoints.down('md')]: {
    display: 'none',
  },
}));

const StepContent = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(3),
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: alpha(theme.palette.primary.main, 0.3),
    borderRadius: 3,
    '&:hover': {
      background: alpha(theme.palette.primary.main, 0.5),
    },
  },
}));

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
  '& .MuiStepConnector-line': {
    borderColor: alpha(theme.palette.primary.main, 0.2),
    borderLeftWidth: 2,
    minHeight: 30,
    marginLeft: 11,
  },
  '&.Mui-active .MuiStepConnector-line': {
    borderColor: theme.palette.primary.main,
  },
  '&.Mui-completed .MuiStepConnector-line': {
    borderColor: theme.palette.success.main,
  },
}));

const StepIconWrapper = styled(Box, {
  shouldForwardProp: (prop) => !['active', 'completed'].includes(prop),
})(({ theme, active, completed }) => ({
  width: 40,
  height: 40,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: completed
    ? theme.palette.success.main
    : active
      ? theme.palette.primary.main
      : alpha(theme.palette.text.secondary, 0.1),
  color: completed || active ? '#fff' : theme.palette.text.secondary,
  transition: 'all 0.3s ease',
  boxShadow: active ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}` : 'none',
}));

// Step configuration
const STEPS = [
  { label: 'Define Goal', icon: GoalIcon, description: 'What do you want to learn?' },
  { label: 'Select Material', icon: MaterialIcon, description: 'Where will content come from?' },
  { label: 'Import Items', icon: ImportIcon, description: 'Add learning points' },
  { label: 'Set Commitment', icon: CommitmentIcon, description: 'Time and deadline' },
  { label: 'Review & Start', icon: ReviewIcon, description: 'Confirm your plan' },
];

// Domain colors
export const DOMAIN_COLORS = {
  vocabulary: { primary: '#4CAF50', light: '#E8F5E9' },
  math: { primary: '#2196F3', light: '#E3F2FD' },
  language: { primary: '#9C27B0', light: '#F3E5F5' },
  knowledge: { primary: '#FF9800', light: '#FFF3E0' },
  skill: { primary: '#00BCD4', light: '#E0F7FA' },
};

function LearningPlanWizard({ open, onClose, onComplete }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Wizard state
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data for all steps
  const [wizardData, setWizardData] = useState({
    // Step 1: Goal
    goalName: '',
    domainType: 'vocabulary',
    description: '',

    // Step 2: Material
    sourceType: 'manual', // file, book, vocabulary_set, url, manual
    sourceId: null,
    sourceFile: null,
    sourceUrl: '',

    // Step 3: Import
    learningPoints: [],
    totalCount: 0,

    // Step 4: Commitment
    dailyMinutes: 30,
    targetDate: null,
    preferredTimeOfDay: 'any',
    calculatedPlan: null,

    // Step 5: Review
    enableReminders: true,
    syncProgress: true,
  });

  // Update wizard data
  const updateWizardData = useCallback((updates) => {
    setWizardData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Navigation handlers
  const handleNext = useCallback(() => {
    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const handleBack = useCallback(() => {
    setActiveStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleStepClick = useCallback((stepIndex) => {
    // Only allow clicking on completed steps or the next available step
    if (stepIndex <= activeStep) {
      setActiveStep(stepIndex);
    }
  }, [activeStep]);

  // Validate current step - extract values to ensure proper dependency tracking
  const {
    goalName,
    domainType,
    sourceType,
    sourceId,
    sourceFile,
    sourceUrl,
    learningPoints,
    dailyMinutes,
    calculatedPlan,
  } = wizardData;

  const isStepValid = useMemo(() => {
    switch (activeStep) {
      case 0: // Goal
        return (goalName || '').trim().length > 0 && !!domainType;
      case 1: // Material
        return sourceType === 'manual' || !!sourceId || !!sourceFile || !!sourceUrl;
      case 2: // Import
        return (learningPoints || []).length > 0;
      case 3: // Commitment
        return dailyMinutes > 0 && !!calculatedPlan;
      case 4: // Review
        return true;
      default:
        return false;
    }
  }, [activeStep, goalName, domainType, sourceType, sourceId, sourceFile, sourceUrl, learningPoints, dailyMinutes, calculatedPlan]);

  // Handle plan creation
  const handleCreatePlan = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Call API to create the plan
      // Convert dayjs targetDate to ISO string if it exists
      const planData = {
        ...wizardData,
        targetDate: wizardData.targetDate ? wizardData.targetDate.toISOString() : null,
      };

      const result = await window.electron.ipcRenderer.invoke('learning-plan-create', planData);

      if (result.success) {
        onComplete?.(result.plan);
        onClose?.();
      } else {
        console.error('Failed to create plan:', result.error);
      }
    } catch (error) {
      console.error('Error creating plan:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [wizardData, onComplete, onClose]);

  // Render custom step icon
  const renderStepIcon = useCallback(
    (index) => {
      const StepIcon = STEPS[index].icon;
      const completed = index < activeStep;
      const active = index === activeStep;

      return (
        <StepIconWrapper active={active} completed={completed}>
          {completed ? <CheckCircleIcon fontSize="small" /> : <StepIcon fontSize="small" />}
        </StepIconWrapper>
      );
    },
    [activeStep]
  );

  // Render current step content
  const renderStepContent = () => {
    const props = {
      data: wizardData,
      updateData: updateWizardData,
      onNext: handleNext,
      onBack: handleBack,
      isValid: isStepValid,
    };

    switch (activeStep) {
      case 0:
        return <GoalStep {...props} />;
      case 1:
        return <MaterialStep {...props} />;
      case 2:
        return <ImportStep {...props} />;
      case 3:
        return <CommitmentStep {...props} />;
      case 4:
        return (
          <ReviewStep
            {...props}
            onCreatePlan={handleCreatePlan}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <WizardContainer
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="md"
      TransitionComponent={Fade}
    >
      {/* Header */}
      <WizardHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Create Learning Plan
          </Typography>
          {isMobile && (
            <Typography variant="caption" color="text.secondary">
              Step {activeStep + 1} of {STEPS.length}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onClose}
          disabled={isSubmitting}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'text.primary',
              background: alpha(theme.palette.error.main, 0.1),
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </WizardHeader>

      {/* Mobile stepper progress */}
      {isMobile && (
        <LinearProgress
          variant="determinate"
          value={((activeStep + 1) / STEPS.length) * 100}
          sx={{
            height: 4,
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${DOMAIN_COLORS[wizardData.domainType]?.primary || theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            },
          }}
        />
      )}

      {/* Body */}
      <WizardBody>
        {/* Sidebar stepper (desktop only) */}
        {!isMobile && (
          <StepperSidebar>
            <Stepper
              activeStep={activeStep}
              orientation="vertical"
              connector={<CustomStepConnector />}
            >
              {STEPS.map((step, index) => (
                <Step key={step.label} completed={index < activeStep}>
                  <StepLabel
                    StepIconComponent={() => renderStepIcon(index)}
                    onClick={() => handleStepClick(index)}
                    sx={{
                      cursor: index <= activeStep ? 'pointer' : 'default',
                      '& .MuiStepLabel-label': {
                        fontSize: '0.875rem',
                        fontWeight: index === activeStep ? 600 : 400,
                        color:
                          index === activeStep
                            ? 'text.primary'
                            : 'text.secondary',
                        ml: 1,
                      },
                    }}
                  >
                    {step.label}
                  </StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Current step description */}
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block">
                Current Step
              </Typography>
              <Typography variant="body2" fontWeight={500} sx={{ mt: 0.5 }}>
                {STEPS[activeStep].description}
              </Typography>
            </Box>
          </StepperSidebar>
        )}

        {/* Step content */}
        <StepContent>
          <DialogContent sx={{ p: 0 }}>
            <Fade in key={activeStep} timeout={300}>
              <Box>{renderStepContent()}</Box>
            </Fade>
          </DialogContent>
        </StepContent>
      </WizardBody>
    </WizardContainer>
  );
}

export default LearningPlanWizard;
