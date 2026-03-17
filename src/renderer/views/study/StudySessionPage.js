/**
 * StudySessionPage.js
 *
 * Main container for study sessions. Provides an immersive,
 * focused learning experience for reviewing learning points.
 */

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Tooltip,
  LinearProgress,
  Chip,
  CircularProgress,
  Alert,
  Fade,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
  SkipNext as SkipIcon,
  Lightbulb as HintIcon,
  Timer as TimerIcon,
  LocalFire as StreakIcon,
  Whatshot as FireIcon,
  VolumeUp as SoundIcon,
  VolumeOff as MuteIcon,
} from '@mui/icons-material';

import useStudySession, { RATINGS, SESSION_MODES } from './hooks/useStudySession';
import useStudyHints from './hooks/useStudyHints';
import useStudySounds from './hooks/useStudySounds';
import useStudyAnalytics from './hooks/useStudyAnalytics';
import StudyCard from './components/StudyCard';
import StudyControls from './components/StudyControls';
import SessionSummary from './components/SessionSummary';
import PauseOverlay from './components/PauseOverlay';
import { recordEvent, EPISODE_TYPES } from '../../api/brainApi';
import { UniversalCard } from '../../components/UniversalCard';
import { ITEM_TYPES } from '../../api/unifiedLearningApi';

// Styled components
const PageContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(180deg, #1a1d21 0%, #0d0f12 100%)'
    : 'linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%)',
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  background: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(10px)',
}));

const ProgressSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

const StatChip = styled(Chip)(({ theme }) => ({
  fontWeight: 600,
  '& .MuiChip-icon': {
    color: 'inherit',
  },
}));

const MainContent = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(3),
  minHeight: 0,
}));

const CardContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  maxWidth: 600,
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4),
}));

// Format time as MM:SS
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

function StudySessionPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get user token from Redux
  const userInfo = useSelector((state) => state.user?.userInfo);
  const token = userInfo?.token;

  // Parse search params
  const mode = searchParams.get('mode') || SESSION_MODES.STANDARD;
  const dateParam = searchParams.get('date');
  const date = useMemo(() => dateParam || new Date().toISOString().split('T')[0], [dateParam]);
  const tagsParam = searchParams.get('tags');
  const tags = useMemo(() => (tagsParam ? tagsParam.split(',') : []), [tagsParam]);
  const maxItemsParam = searchParams.get('maxItems');
  const maxItems = useMemo(() => (maxItemsParam ? parseInt(maxItemsParam, 10) : null), [maxItemsParam]);
  const maxMinutesParam = searchParams.get('maxMinutes');
  const maxMinutes = useMemo(() => (maxMinutesParam ? parseInt(maxMinutesParam, 10) : null), [maxMinutesParam]);

  // Unified API params
  const useUnifiedParam = searchParams.get('unified');
  const useUnifiedApi = useMemo(() => useUnifiedParam === 'true', [useUnifiedParam]);
  const itemTypesParam = searchParams.get('itemTypes');
  const itemTypes = useMemo(() => {
    if (!itemTypesParam) return [ITEM_TYPES.ALL];
    return itemTypesParam.split(',').filter(t => Object.values(ITEM_TYPES).includes(t));
  }, [itemTypesParam]);

  // Session hook
  const {
    session,
    currentItem,
    isLoading,
    error,
    isComplete,
    startSession,
    rateAnswer,
    skipItem,
    pauseSession,
    resumeSession,
    endSession,
    progress,
    accuracy,
    timeRemaining,
    summary,
  } = useStudySession({
    planId: planId || 'all',
    mode,
    date,
    tags,
    maxItems,
    maxMinutes,
    token,
    useUnifiedApi,
    itemTypes,
  });

  // Enhanced hints with AI caching
  const {
    currentHint,
    hintLevel,
    isLoading: hintLoading,
    requestHint,
    resetHint,
    getHintAvailability,
  } = useStudyHints({ useAI: true, token });

  // Configurable sound effects
  const {
    playFlip,
    playCorrect,
    playIncorrect,
    playStreak,
    playComplete,
    playLevelUp,
    speak,
    isEnabled: soundEnabled,
    toggleSounds,
    resumeAudioContext,
  } = useStudySounds();

  // Analytics tracking
  const {
    startSessionTracking,
    recordReview,
    recordHintUsed,
    recordPause,
    endSessionAndRecord,
  } = useStudyAnalytics({ token });

  // Local state
  const [isFlipped, setIsFlipped] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  // Hint availability for current item
  const hintAvailability = useMemo(() => {
    return getHintAvailability(currentItem);
  }, [currentItem, getHintAvailability]);

  // Start session on mount (run ONCE only)
  useEffect(() => {
    startSession();
    // Resume audio context on user interaction
    resumeAudioContext();
    // Start analytics tracking
    startSessionTracking();
    // Record episode for Learning Brain
    recordEvent.sessionStarted({
      planId: planId || 'all',
      mode,
      date,
      tags,
      maxItems,
      maxMinutes,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount only - dependencies are stable from URL params

  // Show summary when complete and record analytics
  useEffect(() => {
    if (isComplete && !showSummary && summary) {
      playComplete();
      setShowSummary(true);

      // Record session analytics
      if (session?.id) {
        endSessionAndRecord(session.id, {
          topicId: planId || 'all',
          durationMinutes: Math.round(session.elapsedTime / 60),
          masteryStart: summary.masteryStart,
          masteryEnd: summary.masteryEnd,
        });

        // Record episode for Learning Brain
        recordEvent.sessionEnded({
          sessionId: session.id,
          planId: planId || 'all',
          itemsReviewed: summary.itemsReviewed,
          correctCount: summary.correctCount,
          incorrectCount: summary.incorrectCount,
          accuracy: summary.accuracy,
          durationMinutes: Math.round(session.elapsedTime / 60),
          masteryChange: summary.masteryEnd - summary.masteryStart,
          bestStreak: summary.bestStreak,
        });
      }
    }
  }, [isComplete, showSummary, summary, playComplete, session?.id, session?.elapsedTime, planId, endSessionAndRecord]);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
    resetHint();
  }, [currentItem?.id, resetHint]);

  // Handle flip
  const handleFlip = useCallback(() => {
    playFlip();
    setIsFlipped(prev => !prev);
  }, [playFlip]);

  // Handle rating
  const handleRate = useCallback((rating) => {
    const wasCorrect = rating >= RATINGS.GOOD;

    // Play appropriate sound
    if (wasCorrect) {
      playCorrect();
      // Check for streak milestones
      playStreak(session.streak + 1);
      // Check for level up (box promotion)
      if (rating === RATINGS.EASY && currentItem?.box < 5) {
        playLevelUp();
      }
    } else {
      playIncorrect();
    }

    // Record review for analytics
    recordReview({
      itemId: currentItem?.id,
      wasCorrect,
      rating,
      responseTimeMs: Date.now() - (session.itemStartTime || Date.now()),
    });

    // Calculate days overdue for scheduling insights
    const calculateDaysOverdue = (item) => {
      if (!item?.nextReview) return 0;
      const now = new Date();
      const nextReview = new Date(item.nextReview);
      if (nextReview > now) return 0;
      return Math.floor((now - nextReview) / (1000 * 60 * 60 * 24));
    };

    // Record episode for Learning Brain
    recordEvent.reviewCompleted({
      conceptId: currentItem?.id,
      conceptName: currentItem?.front,
      rating,
      responseTimeMs: Date.now() - (session.itemStartTime || Date.now()),
      hintUsed: hintLevel > 0,
      previousBox: currentItem?.box,
      newBox: wasCorrect ? Math.min((currentItem?.box || 1) + 1, 5) : 1,
      daysOverdue: calculateDaysOverdue(currentItem),
      wasOverdue: currentItem?.nextReview ? new Date(currentItem.nextReview) < new Date() : false,
      sourceContext: {
        planId: planId || 'all',
        sessionId: session?.id,
        view: 'study',
      },
    });

    // Record mastery change if box changed
    if (wasCorrect || currentItem?.box > 1) {
      recordEvent.masteryChanged({
        itemId: currentItem?.id,
        itemType: 'learningPoint',
        direction: wasCorrect ? 'improved' : 'regressed',
        fromBox: currentItem?.box,
        toBox: wasCorrect ? Math.min((currentItem?.box || 1) + 1, 5) : 1,
      });
    }

    rateAnswer(rating);
    setIsFlipped(false);
  }, [rateAnswer, playCorrect, playIncorrect, playStreak, playLevelUp, session.streak, currentItem?.box, currentItem?.id, currentItem?.front, session.itemStartTime, session?.id, planId, hintLevel, recordReview]);

  // Handle skip
  const handleSkip = useCallback(() => {
    skipItem();
    setIsFlipped(false);
  }, [skipItem]);

  // Handle hint request (progressive, with AI caching)
  const handleHint = useCallback(async () => {
    if (currentItem && hintAvailability.available) {
      await requestHint(currentItem);
      // Record hint usage for analytics
      recordHintUsed();
    }
  }, [currentItem, hintAvailability.available, requestHint, recordHintUsed]);

  // Handle pronunciation (TTS)
  const handlePronounce = useCallback(() => {
    if (currentItem?.front) {
      speak(currentItem.front);
    }
  }, [currentItem?.front, speak]);

  // Handle close
  const handleClose = useCallback(async () => {
    await endSession();
    navigate(-1);
  }, [endSession, navigate]);

  // Handle pause toggle
  const handleTogglePause = useCallback(() => {
    if (session.isPaused) {
      resumeSession();
    } else {
      pauseSession();
      // Record pause for analytics
      recordPause();
    }
  }, [session.isPaused, pauseSession, resumeSession, recordPause]);

  // Handle summary close
  const handleSummaryClose = useCallback(() => {
    setShowSummary(false);
    navigate(-1);
  }, [navigate]);

  // Handle review mistakes
  const handleReviewMistakes = useCallback(() => {
    // TODO: Implement review mistakes mode
    setShowSummary(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if paused or loading
      if (session.isPaused || isLoading || !currentItem) return;

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (!isFlipped) {
            handleFlip();
          }
          break;
        case '1':
          if (isFlipped) handleRate(RATINGS.AGAIN);
          break;
        case '2':
          if (isFlipped) handleRate(RATINGS.HARD);
          break;
        case '3':
          if (isFlipped) handleRate(RATINGS.GOOD);
          break;
        case '4':
          if (isFlipped) handleRate(RATINGS.EASY);
          break;
        case 'h':
          handleHint();
          break;
        case 'r': // Read/pronounce
          handlePronounce();
          break;
        case 's':
          handleSkip();
          break;
        case 'p':
          handleTogglePause();
          break;
        case 'escape':
          handleClose();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session.isPaused, isLoading, currentItem, isFlipped, handleFlip, handleRate, handleHint, handleSkip, handleTogglePause, handleClose, handlePronounce]);

  // Loading state
  if (isLoading) {
    return (
      <PageContainer>
        <MainContent>
          <CircularProgress size={48} />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Loading study session...
          </Typography>
        </MainContent>
      </PageContainer>
    );
  }

  // Error state
  if (error) {
    return (
      <PageContainer>
        <Header>
          <Typography variant="h6">Study Session</Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Header>
        <MainContent>
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            {error}
          </Alert>
          <Button onClick={handleClose} sx={{ mt: 2 }}>
            Go Back
          </Button>
        </MainContent>
      </PageContainer>
    );
  }

  // Empty state
  if (session.items.length === 0) {
    return (
      <PageContainer>
        <Header>
          <Typography variant="h6">Study Session</Typography>
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        </Header>
        <MainContent>
          <EmptyState>
            <Typography variant="h5" gutterBottom>
              🎉 All caught up!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              No items due for review right now.
            </Typography>
            <Button variant="contained" onClick={handleClose}>
              Go Back
            </Button>
          </EmptyState>
        </MainContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Header */}
      <Header>
        <ProgressSection>
          <Typography variant="subtitle2" color="text.secondary">
            {session.currentIndex + 1} / {session.items.length}
          </Typography>
          <Box sx={{ width: 120 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                },
              }}
            />
          </Box>
        </ProgressSection>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <StatChip
            icon={<TimerIcon />}
            label={formatTime(session.elapsedTime)}
            size="small"
            variant="outlined"
          />
          {session.streak > 0 && (
            <Fade in>
              <StatChip
                icon={<FireIcon />}
                label={session.streak}
                size="small"
                color="warning"
                sx={{ color: '#ff9800' }}
              />
            </Fade>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}>
            <IconButton onClick={toggleSounds} size="small">
              {soundEnabled ? <SoundIcon fontSize="small" /> : <MuteIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={session.isPaused ? 'Resume (P)' : 'Pause (P)'}>
            <IconButton onClick={handleTogglePause}>
              {session.isPaused ? <PlayIcon /> : <PauseIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="End session (Esc)">
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Header>

      {/* Time remaining indicator */}
      {timeRemaining !== null && (
        <Box sx={{ px: 3, py: 1, bgcolor: alpha('#ff9800', 0.1) }}>
          <Typography variant="caption" sx={{ color: '#ff9800' }}>
            Time remaining: {formatTime(timeRemaining)}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={(timeRemaining / (maxMinutes * 60)) * 100}
            sx={{
              mt: 0.5,
              height: 4,
              borderRadius: 2,
              bgcolor: alpha('#ff9800', 0.2),
              '& .MuiLinearProgress-bar': {
                bgcolor: '#ff9800',
              },
            }}
          />
        </Box>
      )}

      {/* Main Content */}
      <MainContent>
        <CardContainer>
          {currentItem && (
            <>
              {/* Study Card - use UniversalCard for unified items, StudyCard for legacy */}
              {currentItem.isUnified ? (
                <UniversalCard
                  item={currentItem}
                  isFlipped={isFlipped}
                  onFlip={handleFlip}
                  hint={currentHint}
                  hintLevel={hintLevel}
                  hintLoading={hintLoading}
                  onPronounce={handlePronounce}
                />
              ) : (
                <StudyCard
                  item={currentItem}
                  isFlipped={isFlipped}
                  onFlip={handleFlip}
                  hint={currentHint}
                  hintLevel={hintLevel}
                  hintLoading={hintLoading}
                  onPronounce={handlePronounce}
                />
              )}

              {/* Controls */}
              <StudyControls
                isFlipped={isFlipped}
                onFlip={handleFlip}
                onRate={handleRate}
                onSkip={handleSkip}
                onHint={handleHint}
                onPronounce={handlePronounce}
                disabled={session.isPaused}
                hintAvailable={hintAvailability.available}
                hintLevel={hintLevel}
                maxHintLevels={hintAvailability.maxLevels}
              />
            </>
          )}
        </CardContainer>
      </MainContent>

      {/* Box indicator */}
      {currentItem && (
        <Box
          sx={{
            py: 1,
            px: 3,
            borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Box {currentItem.box || 1}
          </Typography>
          {currentItem.tags?.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {currentItem.tags.slice(0, 2).join(', ')}
            </Typography>
          )}
        </Box>
      )}

      {/* Pause Overlay */}
      <PauseOverlay
        open={session.isPaused}
        onResume={resumeSession}
        onEnd={handleClose}
        stats={{
          progress,
          accuracy,
          streak: session.streak,
          elapsedTime: session.elapsedTime,
        }}
      />

      {/* Session Summary */}
      <SessionSummary
        open={showSummary}
        summary={summary}
        onClose={handleSummaryClose}
        onReviewMistakes={handleReviewMistakes}
      />
    </PageContainer>
  );
}

export default StudySessionPage;
