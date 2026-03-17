/**
 * PauseOverlay.js
 *
 * Overlay shown when the study session is paused.
 * Displays current progress and provides resume/end options.
 */

import React from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Backdrop,
  Fade,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  PlayArrow as ResumeIcon,
  Stop as EndIcon,
  Pause as PauseIcon,
  Timer as TimerIcon,
  TrendingUp as AccuracyIcon,
  Whatshot as StreakIcon,
} from '@mui/icons-material';

// Styled components
const OverlayContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(3),
}));

const PauseCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  borderRadius: 24,
  textAlign: 'center',
  maxWidth: 400,
  background: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.95)
    : alpha(theme.palette.background.paper, 0.98),
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
}));

const IconWrapper = styled(Box)(({ theme }) => ({
  width: 80,
  height: 80,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.7)})`,
  margin: '0 auto',
  marginBottom: theme.spacing(2),
  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`,
}));

const StatRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(4),
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(3),
}));

const StatItem = styled(Box)(({ theme }) => ({
  textAlign: 'center',
}));

const StatValue = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: '1.5rem',
}));

const StatLabel = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
}));

const ButtonRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  justifyContent: 'center',
}));

// Format time as MM:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

function PauseOverlay({
  open,
  onResume,
  onEnd,
  stats = {},
}) {
  const { progress = 0, accuracy = 0, streak = 0, elapsedTime = 0 } = stats;

  return (
    <Backdrop
      open={open}
      sx={{
        zIndex: (theme) => theme.zIndex.modal,
        backdropFilter: 'blur(8px)',
        backgroundColor: (theme) => alpha(theme.palette.background.default, 0.8),
      }}
    >
      <Fade in={open}>
        <OverlayContainer>
          <PauseCard elevation={8}>
            <IconWrapper>
              <PauseIcon sx={{ color: '#fff', fontSize: 40 }} />
            </IconWrapper>

            <Typography variant="h5" fontWeight={700} gutterBottom>
              Session Paused
            </Typography>

            <Typography variant="body2" color="text.secondary">
              Take a break! Your progress is saved.
            </Typography>

            <StatRow>
              <StatItem>
                <StatValue sx={{ color: 'primary.main' }}>
                  {progress}%
                </StatValue>
                <StatLabel>Progress</StatLabel>
              </StatItem>

              <StatItem>
                <StatValue sx={{ color: 'success.main' }}>
                  {accuracy}%
                </StatValue>
                <StatLabel>Accuracy</StatLabel>
              </StatItem>

              <StatItem>
                <StatValue sx={{ color: 'warning.main' }}>
                  {streak}
                </StatValue>
                <StatLabel>Streak</StatLabel>
              </StatItem>

              <StatItem>
                <StatValue sx={{ color: 'info.main' }}>
                  {formatTime(elapsedTime)}
                </StatValue>
                <StatLabel>Time</StatLabel>
              </StatItem>
            </StatRow>

            <ButtonRow>
              <Button
                variant="outlined"
                color="error"
                startIcon={<EndIcon />}
                onClick={onEnd}
                sx={{ borderRadius: 2 }}
              >
                End Session
              </Button>

              <Button
                variant="contained"
                startIcon={<ResumeIcon />}
                onClick={onResume}
                sx={{
                  borderRadius: 2,
                  px: 4,
                }}
              >
                Resume
              </Button>
            </ButtonRow>

            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: 'block', mt: 2 }}
            >
              Press P or Escape to resume
            </Typography>
          </PauseCard>
        </OverlayContainer>
      </Fade>
    </Backdrop>
  );
}

export default PauseOverlay;
