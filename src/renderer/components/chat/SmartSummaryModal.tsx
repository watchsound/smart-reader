/**
 * SmartSummaryModal - Full-screen modal with flying word animations
 *
 * Features:
 * - Full-screen overlay with dimmed background
 * - Source text with words that glow and fly to form summary
 * - Vocabulary words highlighted in gold
 * - Save to note functionality
 * - Close button
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Fade from '@mui/material/Fade';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckIcon from '@mui/icons-material/Check';
import Tooltip from '@mui/material/Tooltip';

// Types
interface SmartSummaryResult {
  summary: string;
  words: string[];
  vocabularyUsed: string[];
  sourceWordCount: number;
  summaryWordCount: number;
}

interface SmartSummaryModalProps {
  open: boolean;
  onClose: () => void;
  sourceText: string;
  summaryResult: SmartSummaryResult | null;
  isLoading: boolean;
  onSave?: (summary: string) => void;
}

// Styled Components
const Overlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: alpha('#000', 0.85),
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backdropFilter: 'blur(8px)',
}));

const CloseButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 20,
  right: 20,
  color: '#fff',
  backgroundColor: alpha('#fff', 0.1),
  '&:hover': {
    backgroundColor: alpha('#fff', 0.2),
  },
}));

const ContentContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '90%',
  maxWidth: 900,
  height: '80%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const SourcePanel = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(3),
  backgroundColor: alpha('#fff', 0.05),
  borderRadius: 16,
  border: `1px solid ${alpha('#fff', 0.1)}`,
  overflow: 'auto',
  position: 'relative',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha('#fff', 0.2),
    borderRadius: 3,
  },
}));

const SummaryPanel = styled(Box)(({ theme }) => ({
  minHeight: 120,
  padding: theme.spacing(3),
  backgroundColor: alpha('#00BCD4', 0.15),
  borderRadius: 16,
  border: `2px solid ${alpha('#00BCD4', 0.4)}`,
  position: 'relative',
}));

const SummaryHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(2),
}));

const WordSlot = styled('span', {
  shouldForwardProp: (prop) => !['isVocab', 'isMatched', 'isVisible'].includes(prop as string),
})<{ isVocab?: boolean; isMatched?: boolean; isVisible?: boolean }>(
  ({ theme, isVocab, isMatched, isVisible }) => ({
    display: 'inline-block',
    padding: '2px 6px',
    margin: '2px',
    borderRadius: 4,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'scale(1)' : 'scale(0.8)',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    backgroundColor: isVocab
      ? alpha('#FFD700', 0.3)
      : isMatched
        ? alpha('#00BCD4', 0.2)
        : 'transparent',
    color: isVocab ? '#FFD700' : '#fff',
    fontWeight: isVocab ? 600 : 400,
  })
);

const SourceWord = styled('span', {
  shouldForwardProp: (prop) => !['isVocab', 'isMatched', 'isFlying', 'glowColor'].includes(prop as string),
})<{ isVocab?: boolean; isMatched?: boolean; isFlying?: boolean; glowColor?: string }>(
  ({ theme, isVocab, isMatched, isFlying, glowColor }) => ({
    display: 'inline',
    padding: '1px 2px',
    borderRadius: 2,
    transition: 'all 0.3s ease',
    opacity: isFlying ? 0.3 : 1,
    ...(isMatched && {
      textShadow: `0 0 10px ${glowColor || '#00BCD4'}, 0 0 20px ${glowColor || '#00BCD4'}`,
      color: isVocab ? '#FFD700' : '#00BCD4',
    }),
  })
);

const FlyingWord = styled('span')(({ theme }) => ({
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 10001,
  fontSize: '1rem',
  fontWeight: 500,
  color: '#fff',
  textShadow: '0 0 15px #00BCD4, 0 0 30px #00BCD4',
  transition: 'none',
}));

const MetaInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginTop: theme.spacing(2),
  paddingTop: theme.spacing(2),
  borderTop: `1px solid ${alpha('#fff', 0.1)}`,
}));

const MetaBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color?: string }>(({ theme, color }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: '4px 12px',
  borderRadius: 20,
  backgroundColor: alpha(color || '#00BCD4', 0.2),
  color: color || '#00BCD4',
  fontSize: '0.8rem',
  fontWeight: 500,
}));

const ActionButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'variant',
})<{ variant?: 'save' | 'close' }>(({ theme, variant }) => ({
  width: 40,
  height: 40,
  backgroundColor: variant === 'save' ? alpha('#4CAF50', 0.2) : alpha('#fff', 0.1),
  color: variant === 'save' ? '#4CAF50' : '#fff',
  '&:hover': {
    backgroundColor: variant === 'save' ? alpha('#4CAF50', 0.3) : alpha('#fff', 0.2),
  },
  '&.Mui-disabled': {
    backgroundColor: alpha('#fff', 0.05),
    color: alpha('#fff', 0.3),
  },
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(4),
}));

function SmartSummaryModal({
  open,
  onClose,
  sourceText,
  summaryResult,
  isLoading,
  onSave,
}: SmartSummaryModalProps) {
  const theme = useTheme();
  const [visibleWords, setVisibleWords] = useState<Set<number>>(new Set());
  const [flyingWords, setFlyingWords] = useState<Array<{
    word: string;
    id: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    isVocab: boolean;
  }>>([]);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [saved, setSaved] = useState(false);
  const sourceRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const wordSlotsRef = useRef<Map<number, HTMLSpanElement>>(new Map());
  const sourceWordsRef = useRef<Map<string, HTMLSpanElement[]>>(new Map());

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setVisibleWords(new Set());
      setFlyingWords([]);
      setAnimationComplete(false);
      setSaved(false);
      wordSlotsRef.current.clear();
      sourceWordsRef.current.clear();
    }
  }, [open]);

  // Start animation when summary result is available
  useEffect(() => {
    if (!summaryResult || !open || animationComplete) return;

    const startAnimation = async () => {
      await new Promise((resolve) => setTimeout(resolve, 500)); // Initial delay

      const summaryWords = summaryResult.words || summaryResult.summary.split(/\s+/);
      const vocabSet = new Set(summaryResult.vocabularyUsed.map((w) => w.toLowerCase()));

      // Animate words one by one
      for (let i = 0; i < summaryWords.length; i++) {
        const word = summaryWords[i];
        const wordLower = word.toLowerCase().replace(/[^\w]/g, '');
        const isVocab = vocabSet.has(wordLower);

        // Find source word position
        const sourceWordElements = sourceWordsRef.current.get(wordLower);
        const targetSlot = wordSlotsRef.current.get(i);

        if (sourceWordElements && sourceWordElements.length > 0 && targetSlot) {
          const sourceEl = sourceWordElements[0];
          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetSlot.getBoundingClientRect();

          // Create flying word
          const flyingWord = {
            word,
            id: i,
            startX: sourceRect.left + sourceRect.width / 2,
            startY: sourceRect.top + sourceRect.height / 2,
            endX: targetRect.left + targetRect.width / 2,
            endY: targetRect.top + targetRect.height / 2,
            isVocab,
          };

          setFlyingWords((prev) => [...prev, flyingWord]);

          // After animation delay, show the word in slot
          await new Promise((resolve) => setTimeout(resolve, 150));
          setVisibleWords((prev) => new Set([...prev, i]));
          setFlyingWords((prev) => prev.filter((fw) => fw.id !== i));
        } else {
          // No source match, just fade in
          await new Promise((resolve) => setTimeout(resolve, 80));
          setVisibleWords((prev) => new Set([...prev, i]));
        }
      }

      setAnimationComplete(true);
    };

    startAnimation();
  }, [summaryResult, open, animationComplete]);

  // Register source word ref
  const registerSourceWord = useCallback((word: string, el: HTMLSpanElement | null) => {
    if (!el) return;
    const wordLower = word.toLowerCase().replace(/[^\w]/g, '');
    if (!sourceWordsRef.current.has(wordLower)) {
      sourceWordsRef.current.set(wordLower, []);
    }
    const existing = sourceWordsRef.current.get(wordLower)!;
    if (!existing.includes(el)) {
      existing.push(el);
    }
  }, []);

  // Register word slot ref
  const registerWordSlot = useCallback((index: number, el: HTMLSpanElement | null) => {
    if (el) {
      wordSlotsRef.current.set(index, el);
    }
  }, []);

  const handleSave = () => {
    if (onSave && summaryResult) {
      onSave(summaryResult.summary);
      setSaved(true);
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  // Parse source text into words with refs
  const renderSourceText = () => {
    if (!sourceText) return null;

    const summaryWordsSet = new Set(
      (summaryResult?.words || []).map((w) => w.toLowerCase().replace(/[^\w]/g, ''))
    );
    const vocabSet = new Set(
      (summaryResult?.vocabularyUsed || []).map((w) => w.toLowerCase())
    );

    // Split into words and non-words (preserve spacing/punctuation)
    const tokens = sourceText.split(/(\s+|[.,!?;:'"()-])/);

    return tokens.map((token, idx) => {
      const wordLower = token.toLowerCase().replace(/[^\w]/g, '');
      if (!wordLower) {
        // Non-word token (whitespace or punctuation)
        return <span key={idx}>{token}</span>;
      }

      const isMatched = summaryWordsSet.has(wordLower);
      const isVocab = vocabSet.has(wordLower);

      return (
        <SourceWord
          key={idx}
          ref={(el) => registerSourceWord(token, el)}
          isMatched={isMatched}
          isVocab={isVocab}
          glowColor={isVocab ? '#FFD700' : '#00BCD4'}
        >
          {token}
        </SourceWord>
      );
    });
  };

  // Render summary with word slots
  const renderSummarySlots = () => {
    if (!summaryResult) return null;

    const summaryWords = summaryResult.words || summaryResult.summary.split(/\s+/);
    const vocabSet = new Set(summaryResult.vocabularyUsed.map((w) => w.toLowerCase()));

    return summaryWords.map((word, idx) => {
      const wordLower = word.toLowerCase().replace(/[^\w]/g, '');
      const isVocab = vocabSet.has(wordLower);
      const isVisible = visibleWords.has(idx);

      return (
        <WordSlot
          key={idx}
          ref={(el) => registerWordSlot(idx, el)}
          isVocab={isVocab}
          isMatched
          isVisible={isVisible}
        >
          {word}
        </WordSlot>
      );
    });
  };

  return (
    <Fade in={open} timeout={300}>
      <Overlay>
        <CloseButton onClick={onClose} size="large">
          <CloseIcon fontSize="large" />
        </CloseButton>

        <ContentContainer>
          {/* Source Text Panel */}
          <SourcePanel ref={sourceRef}>
            <Typography
              variant="caption"
              sx={{ color: alpha('#fff', 0.5), mb: 1, display: 'block' }}
            >
              SOURCE TEXT
            </Typography>
            <Box
              sx={{
                fontSize: '1rem',
                lineHeight: 1.8,
                color: alpha('#fff', 0.8),
              }}
            >
              {renderSourceText()}
            </Box>
          </SourcePanel>

          {/* Summary Panel */}
          <SummaryPanel ref={summaryRef}>
            <SummaryHeader>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon sx={{ color: '#00BCD4' }} />
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
                  Smart Summary
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title={saved ? 'Saved!' : 'Save as Note'}>
                  <ActionButton
                    variant="save"
                    onClick={handleSave}
                    disabled={!animationComplete || saved}
                  >
                    {saved ? <CheckIcon /> : <SaveIcon />}
                  </ActionButton>
                </Tooltip>
              </Box>
            </SummaryHeader>

            {isLoading ? (
              <LoadingContainer>
                <CircularProgress sx={{ color: '#00BCD4' }} />
                <Typography sx={{ color: alpha('#fff', 0.7) }}>
                  Generating smart summary...
                </Typography>
              </LoadingContainer>
            ) : summaryResult ? (
              <>
                <Box sx={{ minHeight: 48 }}>{renderSummarySlots()}</Box>
                <MetaInfo>
                  <MetaBadge color="#00BCD4">
                    {summaryResult.sourceWordCount} → {summaryResult.summaryWordCount} words
                  </MetaBadge>
                  {summaryResult.vocabularyUsed.length > 0 && (
                    <MetaBadge color="#FFD700">
                      {summaryResult.vocabularyUsed.length} vocabulary words
                    </MetaBadge>
                  )}
                </MetaInfo>
              </>
            ) : null}
          </SummaryPanel>
        </ContentContainer>

        {/* Flying Words */}
        {flyingWords.map((fw) => (
          <FlyingWordAnimation
            key={fw.id}
            word={fw.word}
            startX={fw.startX}
            startY={fw.startY}
            endX={fw.endX}
            endY={fw.endY}
            isVocab={fw.isVocab}
          />
        ))}
      </Overlay>
    </Fade>
  );
}

// Flying word animation component
function FlyingWordAnimation({
  word,
  startX,
  startY,
  endX,
  endY,
  isVocab,
}: {
  word: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isVocab: boolean;
}) {
  const [position, setPosition] = useState({ x: startX, y: startY });
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const duration = 600;
    const startTime = performance.now();

    // Control point for Bezier curve
    const ctrlX = (startX + endX) / 2;
    const ctrlY = Math.min(startY, endY) - 60 - Math.random() * 40;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const t = 1 - Math.pow(1 - progress, 3);

      // Quadratic Bezier
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * ctrlX + t * t * endX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * ctrlY + t * t * endY;

      setPosition({ x, y });
      setOpacity(1 - progress * 0.5);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [startX, startY, endX, endY]);

  return (
    <FlyingWord
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        opacity,
        color: isVocab ? '#FFD700' : '#fff',
        textShadow: isVocab
          ? '0 0 15px #FFD700, 0 0 30px #FFD700'
          : '0 0 15px #00BCD4, 0 0 30px #00BCD4',
      }}
    >
      {word}
    </FlyingWord>
  );
}

export default SmartSummaryModal;
