/**
 * LearningPlansPage.js
 *
 * Main page for managing learning plans.
 * Shows active plans, progress, and allows creating new plans.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  LinearProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Alert,
  Fab,
  Tooltip,
  Divider,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  Flag as GoalIcon,
  Schedule as TimeIcon,
  TrendingUp as ProgressIcon,
  EmojiEvents as TrophyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import LearningPlanWizard, { DOMAIN_COLORS } from './LearningPlanWizard';
import learningPlanApi from '../../api/learningPlanApi';

// Styled components
const PageContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  minHeight: '100%',
  background: theme.palette.mode === 'dark' ? '#1a1d21' : '#f8f9fa',
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
}));

const PlanCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'domainColor',
})(({ theme, domainColor }) => ({
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  transition: 'all 0.2s ease',
  overflow: 'visible',
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: domainColor,
    borderRadius: '16px 16px 0 0',
  },
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 40px ${alpha(domainColor, 0.2)}`,
  },
}));

const StatBox = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(1),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(8),
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
  borderRadius: 16,
  border: `2px dashed ${alpha(theme.palette.divider, 0.2)}`,
}));

const DOMAIN_LABELS = {
  vocabulary: 'Vocabulary',
  math: 'Math & Science',
  language: 'Language',
  knowledge: 'Knowledge',
  skill: 'Skills',
};

function LearningPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Load plans
  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await learningPlanApi.listPlans();
      if (result.success) {
        setPlans(result.plans || []);
      } else {
        setError(result.error || 'Failed to load plans');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  // Handle plan creation
  const handlePlanCreated = useCallback((plan) => {
    setPlans((prev) => [plan, ...prev]);
    setWizardOpen(false);
  }, []);

  // Menu handlers
  const handleMenuOpen = useCallback((event, plan) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedPlan(plan);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
    setSelectedPlan(null);
  }, []);

  // Plan actions
  const handleToggleStatus = useCallback(async () => {
    if (!selectedPlan) return;

    const newStatus = selectedPlan.status === 'active' ? 'paused' : 'active';
    try {
      const result = await learningPlanApi.togglePlanStatus({
        planId: selectedPlan.id,
        status: newStatus,
      });
      if (result.success) {
        setPlans((prev) =>
          prev.map((p) =>
            p.id === selectedPlan.id ? { ...p, status: newStatus } : p
          )
        );
      }
    } catch (err) {
      console.error('Error toggling status:', err);
    }
    handleMenuClose();
  }, [selectedPlan, handleMenuClose]);

  const handleDeletePlan = useCallback(async () => {
    if (!selectedPlan) return;

    try {
      const result = await learningPlanApi.deletePlan(selectedPlan.id);
      if (result.success) {
        setPlans((prev) => prev.filter((p) => p.id !== selectedPlan.id));
      }
    } catch (err) {
      console.error('Error deleting plan:', err);
    }
    handleMenuClose();
  }, [selectedPlan, handleMenuClose]);

  // Navigate to study session
  const handleStartStudy = useCallback((plan) => {
    navigate(`/study/${plan.id}`);
  }, [navigate]);

  // Calculate progress percentage
  const getProgress = (plan) => {
    if (!plan.progress) return 0;
    const total = plan.totalItems || 1;
    const mastered = plan.progress.mastered || 0;
    return Math.round((mastered / total) * 100);
  };

  // Render loading skeletons
  const renderSkeletons = () => (
    <Grid container spacing={3}>
      {[1, 2, 3].map((i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="rectangular" height={60} sx={{ mt: 2, borderRadius: 2 }} />
              <Skeleton variant="text" width="80%" sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  // Render empty state
  const renderEmptyState = () => (
    <EmptyState>
      <TrophyIcon sx={{ fontSize: 64, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
      <Typography variant="h6" color="text.secondary" gutterBottom>
        No Learning Plans Yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
        Create your first learning plan to start mastering new knowledge with spaced repetition.
      </Typography>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setWizardOpen(true)}
        sx={{ borderRadius: 2 }}
      >
        Create Learning Plan
      </Button>
    </EmptyState>
  );

  // Render plan card
  const renderPlanCard = (plan) => {
    const domainColor = DOMAIN_COLORS[plan.domain]?.primary || '#666';
    const progress = getProgress(plan);
    const isActive = plan.status === 'active';

    return (
      <Grid item xs={12} sm={6} md={4} key={plan.id}>
        <PlanCard domainColor={domainColor} elevation={0}>
          <CardContent sx={{ pt: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600} noWrap>
                  {plan.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={DOMAIN_LABELS[plan.domain] || plan.domain}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: alpha(domainColor, 0.1),
                      color: domainColor,
                    }}
                  />
                  <Chip
                    label={isActive ? 'Active' : 'Paused'}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      bgcolor: isActive ? alpha('#4caf50', 0.1) : alpha('#ff9800', 0.1),
                      color: isActive ? '#4caf50' : '#ff9800',
                    }}
                  />
                </Box>
              </Box>
              <IconButton size="small" onClick={(e) => handleMenuOpen(e, plan)}>
                <MoreIcon fontSize="small" />
              </IconButton>
            </Box>

            {/* Progress */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="caption" fontWeight={600}>
                  {progress}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha(domainColor, 0.1),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    bgcolor: domainColor,
                  },
                }}
              />
            </Box>

            {/* Stats */}
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <StatBox>
                  <Typography variant="h6" fontWeight={700} sx={{ color: domainColor }}>
                    {plan.totalItems || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Items
                  </Typography>
                </StatBox>
              </Grid>
              <Grid item xs={4}>
                <StatBox>
                  <Typography variant="h6" fontWeight={700} sx={{ color: domainColor }}>
                    {plan.progress?.mastered || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Mastered
                  </Typography>
                </StatBox>
              </Grid>
              <Grid item xs={4}>
                <StatBox>
                  <Typography variant="h6" fontWeight={700} sx={{ color: domainColor }}>
                    {plan.dailyMinutes || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Min/Day
                  </Typography>
                </StatBox>
              </Grid>
            </Grid>
          </CardContent>

          <Divider />

          <CardActions sx={{ p: 2, justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              <TimeIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              {plan.dailyMinutes} min/day
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayIcon />}
              onClick={() => handleStartStudy(plan)}
              disabled={!isActive}
              sx={{
                borderRadius: 2,
                bgcolor: domainColor,
                '&:hover': { bgcolor: alpha(domainColor, 0.9) },
                '&.Mui-disabled': { bgcolor: alpha(domainColor, 0.3) },
              }}
            >
              Study
            </Button>
          </CardActions>
        </PlanCard>
      </Grid>
    );
  };

  return (
    <PageContainer>
      {/* Header */}
      <HeaderSection>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Learning Plans
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your personalized learning journeys
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={loadPlans} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setWizardOpen(true)}
            sx={{ borderRadius: 2 }}
          >
            New Plan
          </Button>
        </Box>
      </HeaderSection>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Content */}
      {loading ? (
        renderSkeletons()
      ) : plans.length === 0 ? (
        renderEmptyState()
      ) : (
        <Grid container spacing={3}>
          {plans.map(renderPlanCard)}
        </Grid>
      )}

      {/* FAB for mobile */}
      <Fab
        color="primary"
        onClick={() => setWizardOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: { xs: 'flex', md: 'none' },
        }}
      >
        <AddIcon />
      </Fab>

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleToggleStatus}>
          <ListItemIcon>
            {selectedPlan?.status === 'active' ? (
              <PauseIcon fontSize="small" />
            ) : (
              <PlayIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {selectedPlan?.status === 'active' ? 'Pause Plan' : 'Resume Plan'}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDeletePlan} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Plan</ListItemText>
        </MenuItem>
      </Menu>

      {/* Wizard Dialog */}
      <LearningPlanWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onComplete={handlePlanCreated}
      />
    </PageContainer>
  );
}

export default LearningPlansPage;
