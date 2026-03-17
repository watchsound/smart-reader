import { useState, useEffect, useCallback } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Fade,
  Chip,
} from '@mui/material';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import SlideshowIcon from '@mui/icons-material/Slideshow';

import NoteUI from '../note/NoteUI';

// Styled components
const PresentationContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    : 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
  position: 'relative',
  overflow: 'hidden',
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  background: alpha('#000', 0.2),
  backdropFilter: 'blur(10px)',
  zIndex: 10,
}));

const SlideContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  position: 'relative',
});

const SlideCard = styled(Box)(({ theme }) => ({
  maxWidth: 600,
  maxHeight: '75vh',
  width: '100%',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: `0 25px 80px ${alpha('#000', 0.4)}`,
  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease',
  background: theme.palette.background.paper,
}));

const NavButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 56,
  height: 56,
  background: alpha('#fff', 0.15),
  backdropFilter: 'blur(10px)',
  color: '#fff',
  border: `1px solid ${alpha('#fff', 0.2)}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    background: alpha('#fff', 0.25),
    transform: 'translateY(-50%) scale(1.05)',
  },
  '&:disabled': {
    opacity: 0.3,
    background: alpha('#fff', 0.05),
  },
}));

const ProgressContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  background: alpha('#000', 0.2),
  backdropFilter: 'blur(10px)',
}));

const ProgressDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isActive' && prop !== 'isCompleted',
})(({ theme, isActive, isCompleted }) => ({
  width: isActive ? 32 : 10,
  height: 10,
  borderRadius: 5,
  background: isActive
    ? '#fff'
    : isCompleted
      ? alpha('#fff', 0.6)
      : alpha('#fff', 0.25),
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    background: isActive ? '#fff' : alpha('#fff', 0.5),
    transform: 'scale(1.1)',
  },
}));

const SlideNumber = styled(Chip)(({ theme }) => ({
  background: alpha('#fff', 0.15),
  backdropFilter: 'blur(10px)',
  color: '#fff',
  fontWeight: 600,
  border: `1px solid ${alpha('#fff', 0.2)}`,
  '& .MuiChip-label': {
    padding: '0 12px',
  },
}));

const HeaderButton = styled(IconButton)(({ theme }) => ({
  color: '#fff',
  background: alpha('#fff', 0.1),
  border: `1px solid ${alpha('#fff', 0.15)}`,
  '&:hover': {
    background: alpha('#fff', 0.2),
  },
}));

export default function NotesSliderView({ notes, open, callback }) {
  const theme = useTheme();
  const [opened, setOpened] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slideDirection, setSlideDirection] = useState('none');
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setOpened(open);
    if (open) {
      setCurrentIndex(0);
    }
  }, [open]);

  const close = () => {
    setOpened(false);
    callback();
  };

  const goToSlide = useCallback((index) => {
    if (isAnimating || index === currentIndex) return;
    if (index < 0 || index >= notes.length) return;

    setIsAnimating(true);
    setSlideDirection(index > currentIndex ? 'left' : 'right');

    setTimeout(() => {
      setCurrentIndex(index);
      setSlideDirection('none');
      setIsAnimating(false);
    }, 200);
  }, [currentIndex, isAnimating, notes.length]);

  const goNext = useCallback(() => {
    if (currentIndex < notes.length - 1) {
      goToSlide(currentIndex + 1);
    }
  }, [currentIndex, notes.length, goToSlide]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  }, [currentIndex, goToSlide]);

  // Keyboard navigation
  useEffect(() => {
    if (!opened) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        close();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened, goNext, goPrev]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (!notes || notes.length === 0) return null;

  const currentNote = notes[currentIndex];

  return (
    <Dialog
      open={opened}
      onClose={close}
      fullScreen
      TransitionComponent={Fade}
      transitionDuration={300}
      PaperProps={{
        sx: {
          background: 'transparent',
          boxShadow: 'none',
        },
      }}
    >
      <PresentationContainer>
        {/* Header */}
        <Header>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SlideshowIcon sx={{ color: '#fff', fontSize: 28 }} />
            <Typography
              variant="h6"
              sx={{
                color: '#fff',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}
            >
              Presentation Mode
            </Typography>
            <SlideNumber
              label={`${currentIndex + 1} / ${notes.length}`}
              size="small"
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}>
              <HeaderButton onClick={toggleFullscreen} size="small">
                {isFullscreen ? (
                  <FullscreenExitIcon sx={{ fontSize: 20 }} />
                ) : (
                  <FullscreenIcon sx={{ fontSize: 20 }} />
                )}
              </HeaderButton>
            </Tooltip>
            <Tooltip title="Close (Esc)">
              <HeaderButton onClick={close} size="small">
                <CloseIcon sx={{ fontSize: 20 }} />
              </HeaderButton>
            </Tooltip>
          </Box>
        </Header>

        {/* Main slide area */}
        <SlideContainer>
          {/* Previous button */}
          <NavButton
            onClick={goPrev}
            disabled={currentIndex === 0 || isAnimating}
            sx={{ left: 24 }}
          >
            <ChevronLeftIcon sx={{ fontSize: 32 }} />
          </NavButton>

          {/* Current slide */}
          <Fade in={slideDirection === 'none'} timeout={300}>
            <SlideCard
              sx={{
                transform: slideDirection === 'left'
                  ? 'translateX(-20px)'
                  : slideDirection === 'right'
                    ? 'translateX(20px)'
                    : 'translateX(0)',
                opacity: slideDirection === 'none' ? 1 : 0,
              }}
            >
              {currentNote && (
                <NoteUI
                  key={currentNote.id}
                  selectedNoteKey={currentNote.id}
                  selectHandler={() => {}}
                  customAction={() => {}}
                  customActionName=""
                  deleteAction={() => {}}
                  showQuizHandler={() => {}}
                  deleteActionName=""
                  cardWidth={560}
                  cardHeight={620}
                  useBgColor
                  compactView
                />
              )}
            </SlideCard>
          </Fade>

          {/* Next button */}
          <NavButton
            onClick={goNext}
            disabled={currentIndex === notes.length - 1 || isAnimating}
            sx={{ right: 24 }}
          >
            <ChevronRightIcon sx={{ fontSize: 32 }} />
          </NavButton>
        </SlideContainer>

        {/* Progress indicators */}
        <ProgressContainer>
          {notes.length <= 15 ? (
            // Show dots for small number of slides
            notes.map((note, index) => (
              <Tooltip key={note.id} title={`Slide ${index + 1}`}>
                <ProgressDot
                  isActive={index === currentIndex}
                  isCompleted={index < currentIndex}
                  onClick={() => goToSlide(index)}
                />
              </Tooltip>
            ))
          ) : (
            // Show mini progress bar for many slides
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', maxWidth: 400 }}>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.7) }}>
                {currentIndex + 1}
              </Typography>
              <Box
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: alpha('#fff', 0.2),
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${((currentIndex + 1) / notes.length) * 100}%`,
                    height: '100%',
                    background: '#fff',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }}
                />
              </Box>
              <Typography variant="caption" sx={{ color: alpha('#fff', 0.7) }}>
                {notes.length}
              </Typography>
            </Box>
          )}
        </ProgressContainer>

        {/* Keyboard hints */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 2,
            opacity: 0.5,
          }}
        >
          <Typography variant="caption" sx={{ color: '#fff' }}>
            ← → Navigate
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff' }}>
            •
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff' }}>
            Space: Next
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff' }}>
            •
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff' }}>
            F: Fullscreen
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff' }}>
            •
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff' }}>
            Esc: Close
          </Typography>
        </Box>
      </PresentationContainer>
    </Dialog>
  );
}
