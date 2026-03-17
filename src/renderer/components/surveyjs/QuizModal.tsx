import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  IconButton,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Fade,
  LinearProgress,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';

// Icons
import QuizIcon from '@mui/icons-material/Quiz';
import CloseIcon from '@mui/icons-material/Close';
import SpeedIcon from '@mui/icons-material/Speed';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

import customStorage from '../../store/customStorage';
import { QuizProblem } from '../../../commons/model/Quiz';
import { quizToSurveyJs } from './SurveyUtil';
import { QuizType } from '../../../commons/model/DataTypes';
import InstantResultQuiz from './InstantResultQuiz';
import ScoredQuiz from './ScoredQuiz';

// Styled components
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.shape.borderRadius * 2,
    maxWidth: 800,
    width: '90vw',
    maxHeight: '90vh',
    overflow: 'hidden',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: 0,
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  color: '#fff',
}));

const HeaderContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: alpha(theme.palette.text.primary, 0.1),
    borderRadius: 3,
  },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  backgroundColor: theme.palette.background.paper,
  justifyContent: 'space-between',
}));

const ActionButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'variant',
})<{ variant?: 'primary' | 'secondary' | 'text' }>(({ theme, variant = 'text' }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  ...(variant === 'primary' && {
    backgroundColor: theme.palette.primary.main,
    color: '#fff',
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      transform: 'translateY(-1px)',
    },
  }),
  ...(variant === 'secondary' && {
    backgroundColor: alpha(theme.palette.primary.main, 0.1),
    color: theme.palette.primary.main,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.15),
    },
  }),
  ...(variant === 'text' && {
    backgroundColor: 'transparent',
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: alpha(theme.palette.text.primary, 0.05),
    },
  }),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(6),
  textAlign: 'center',
}));

function QuizModal({
  open,
  quizProblems,
  callback,
}: {
  open: boolean;
  quizProblems: QuizProblem[];
  callback: () => void;
}) {
  const theme = useTheme();
  const [opened, setOpened] = useState(open);
  const [surveyProblems, setSurveyProblems] = useState(null);
  const [quizType, setQuizType] = useState(QuizType.InstantResultQuiz);
  const [isLoading, setIsLoading] = useState(false);
  const [shuffledProblems, setShuffledProblems] = useState<QuizProblem[]>([]);

  useEffect(() => {
    if (!quizProblems || quizProblems.length === 0) return;
    setShuffledProblems([...quizProblems]);
  }, [quizProblems]);

  useEffect(() => {
    if (!shuffledProblems || shuffledProblems.length === 0) {
      setSurveyProblems(null);
      return;
    }
    async function loadQuiz() {
      setIsLoading(true);
      try {
        const r = await quizToSurveyJs(shuffledProblems);
        setSurveyProblems(r);
        const qt = await customStorage.getItem('quiz_type');
        setQuizType(qt || QuizType.InstantResultQuiz);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuiz();
  }, [shuffledProblems]);

  useEffect(() => {
    setOpened(open);
    if (open && quizProblems) {
      setShuffledProblems([...quizProblems]);
    }
  }, [open, quizProblems]);

  function close() {
    setOpened(false);
    setSurveyProblems(null);
    callback();
  }

  function handleShuffle() {
    const shuffled = [...shuffledProblems].sort(() => Math.random() - 0.5);
    setShuffledProblems(shuffled);
  }

  function handleQuizTypeChange(
    _event: React.MouseEvent<HTMLElement>,
    newType: string | null
  ) {
    if (newType) {
      setQuizType(newType as QuizType);
      customStorage.setItem('quiz_type', newType);
    }
  }

  const questionCount = shuffledProblems?.length || 0;

  return (
    <StyledDialog
      open={opened}
      onClose={close}
      aria-labelledby="quiz-dialog-title"
      TransitionComponent={Fade}
      transitionDuration={300}
    >
      <StyledDialogTitle id="quiz-dialog-title">
        <HeaderContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.2)',
              }}
            >
              <QuizIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Quiz Session
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {questionCount} question{questionCount !== 1 ? 's' : ''} to answer
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={close}
            sx={{
              color: '#fff',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </HeaderContent>
        {isLoading && (
          <LinearProgress
            sx={{
              height: 3,
              '& .MuiLinearProgress-bar': {
                bgcolor: 'rgba(255,255,255,0.8)',
              },
            }}
          />
        )}
      </StyledDialogTitle>

      <StyledDialogContent>
        {surveyProblems ? (
          <Fade in>
            <Box>
              {quizType === QuizType.InstantResultQuiz ? (
                <InstantResultQuiz
                  quizJson={surveyProblems}
                  quizProblems={shuffledProblems}
                />
              ) : (
                <ScoredQuiz
                  quizJson={surveyProblems}
                  quizProblems={shuffledProblems}
                />
              )}
            </Box>
          </Fade>
        ) : (
          <EmptyState>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                mb: 3,
              }}
            >
              <PlayArrowIcon
                sx={{ fontSize: 40, color: theme.palette.primary.main }}
              />
            </Box>
            <Typography
              variant="h6"
              sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}
            >
              {isLoading ? 'Preparing Quiz...' : 'Ready to Start'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isLoading
                ? 'Loading your questions'
                : 'Configure your quiz settings below and start learning'}
            </Typography>
          </EmptyState>
        )}
      </StyledDialogContent>

      <StyledDialogActions>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Shuffle questions">
            <span>
              <IconButton
                onClick={handleShuffle}
                disabled={isLoading}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                }}
              >
                <ShuffleIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>

          <ToggleButtonGroup
            value={quizType}
            exclusive
            onChange={handleQuizTypeChange}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                textTransform: 'none',
                fontSize: '0.8rem',
                fontWeight: 500,
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  borderColor: theme.palette.primary.main,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.15),
                  },
                },
              },
            }}
          >
            <ToggleButton value={QuizType.InstantResultQuiz}>
              <SpeedIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Instant
            </ToggleButton>
            <ToggleButton value={QuizType.ScoredQuiz}>
              <EmojiEventsIcon sx={{ fontSize: 18, mr: 0.5 }} />
              Scored
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <ActionButton variant="primary" onClick={close}>
          <CloseIcon sx={{ fontSize: 18 }} />
          Close Quiz
        </ActionButton>
      </StyledDialogActions>
    </StyledDialog>
  );
}

export default QuizModal;
