import React, { useState, useEffect } from 'react';
import { Typography, Box, Fade, Tooltip } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TouchAppIcon from '@mui/icons-material/TouchApp';

const ContentCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
  transition: 'all 0.2s ease',
}));

const CardHeader = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: alpha(colors?.accent || theme.palette.primary.main, 0.06),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const HiddenWordSlot = styled('span')(({ theme, colors, revealed }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 40,
  padding: '4px 12px',
  margin: '2px 4px',
  borderRadius: 8,
  cursor: revealed ? 'default' : 'pointer',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  verticalAlign: 'middle',
  fontWeight: 500,
  ...(revealed
    ? {
        backgroundColor: alpha(colors?.accent || theme.palette.success.main, 0.12),
        color: colors?.accent || theme.palette.success.main,
        border: `1px solid ${alpha(colors?.accent || theme.palette.success.main, 0.3)}`,
      }
    : {
        backgroundColor: alpha(theme.palette.primary.main, 0.08),
        color: theme.palette.primary.main,
        border: `1px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.15),
          transform: 'scale(1.05)',
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
        },
        '&:active': {
          transform: 'scale(0.98)',
        },
      }),
}));

const ProgressIndicator = styled(Box)(({ theme, colors, progress }) => ({
  height: 4,
  borderRadius: 2,
  backgroundColor: alpha(colors?.accent || theme.palette.primary.main, 0.15),
  overflow: 'hidden',
  position: 'relative',
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: `${progress}%`,
    backgroundColor: colors?.accent || theme.palette.primary.main,
    borderRadius: 2,
    transition: 'width 0.5s ease',
  },
}));

function ParagraphWithHiddenWords({ inputText, colors }) {
  const theme = useTheme();
  const [words, setWords] = useState([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [totalHidden, setTotalHidden] = useState(0);

  const parseText = (text) => {
    const regex = /\${(.*?)}/g;
    let match;
    const parsedWords = [];
    let lastIndex = 0;
    let hiddenCount = 0;

    while ((match = regex.exec(text)) !== null) {
      if (lastIndex < match.index) {
        parsedWords.push(text.substring(lastIndex, match.index));
      }
      parsedWords.push({ word: match[1], revealed: false, id: hiddenCount });
      hiddenCount++;
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      parsedWords.push(text.substring(lastIndex));
    }

    return { parsedWords, hiddenCount };
  };

  useEffect(() => {
    if (!inputText) return;
    const { parsedWords, hiddenCount } = parseText(inputText);
    setWords(parsedWords);
    setTotalHidden(hiddenCount);
    setRevealedCount(0);
  }, [inputText]);

  const handleRevealWord = (index) => {
    setWords((prevWords) =>
      prevWords.map((item, idx) => {
        if (idx === index && typeof item === 'object' && !item.revealed) {
          setRevealedCount((prev) => prev + 1);
          return { ...item, revealed: true };
        }
        return item;
      }),
    );
  };

  const handleRevealAll = () => {
    setWords((prevWords) =>
      prevWords.map((item) =>
        typeof item === 'object' ? { ...item, revealed: true } : item,
      ),
    );
    setRevealedCount(totalHidden);
  };

  const handleReset = () => {
    setWords((prevWords) =>
      prevWords.map((item) =>
        typeof item === 'object' ? { ...item, revealed: false } : item,
      ),
    );
    setRevealedCount(0);
  };

  const progress = totalHidden > 0 ? (revealedCount / totalHidden) * 100 : 0;
  const isComplete = revealedCount === totalHidden && totalHidden > 0;

  return (
    <ContentCard>
      <CardHeader colors={colors}>
        <TouchAppIcon sx={{ color: colors?.accent, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          Fill in the Blanks
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: isComplete ? colors?.accent : theme.palette.text.secondary,
              fontWeight: 600,
            }}
          >
            {revealedCount}/{totalHidden}
          </Typography>
          {isComplete && (
            <CheckCircleOutlineIcon
              sx={{ fontSize: 18, color: colors?.accent }}
            />
          )}
        </Box>
      </CardHeader>

      {/* Progress Bar */}
      <Box sx={{ px: 3, pt: 2 }}>
        <ProgressIndicator colors={colors} progress={progress} />
      </Box>

      {/* Content */}
      <Box sx={{ p: 3 }}>
        <Typography
          component="div"
          sx={{
            lineHeight: 2.2,
            fontSize: '1.1rem',
            color: theme.palette.text.primary,
          }}
        >
          {words.map((item, index) =>
            typeof item === 'string' ? (
              <span key={`text-${index}`}>{item}</span>
            ) : (
              <Tooltip
                key={`word-${index}`}
                title={item.revealed ? '' : 'Click to reveal'}
                placement="top"
                arrow
              >
                <HiddenWordSlot
                  colors={colors}
                  revealed={item.revealed}
                  onClick={() => !item.revealed && handleRevealWord(index)}
                >
                  <Fade in={true} timeout={300}>
                    <span>
                      {item.revealed ? item.word : '_'.repeat(Math.max(item.word.length, 3))}
                    </span>
                  </Fade>
                </HiddenWordSlot>
              </Tooltip>
            ),
          )}
        </Typography>
      </Box>

      {/* Action Footer */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          onClick={handleReset}
          sx={{
            color: theme.palette.text.secondary,
            cursor: 'pointer',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            '&:hover': {
              bgcolor: alpha(theme.palette.text.primary, 0.04),
            },
          }}
        >
          Reset
        </Typography>
        <Typography
          variant="caption"
          onClick={handleRevealAll}
          sx={{
            color: colors?.accent || theme.palette.primary.main,
            cursor: 'pointer',
            fontWeight: 600,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            '&:hover': {
              bgcolor: alpha(colors?.accent || theme.palette.primary.main, 0.08),
            },
          }}
        >
          Reveal All
        </Typography>
      </Box>
    </ContentCard>
  );
}

export default ParagraphWithHiddenWords;
