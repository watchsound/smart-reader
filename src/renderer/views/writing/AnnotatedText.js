import React, { useState } from 'react';
import { Box, Typography, Chip, Divider, Tooltip } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import TouchAppIcon from '@mui/icons-material/TouchApp';

const ContentCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
  marginBottom: theme.spacing(3),
}));

const CardHeader = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: alpha(colors?.accent || theme.palette.warning.main, 0.06),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const HighlightedWord = styled('span')(({ theme, active, colors }) => ({
  cursor: 'pointer',
  padding: '2px 6px',
  margin: '0 2px',
  borderRadius: 4,
  fontWeight: 500,
  transition: 'all 0.2s ease',
  backgroundColor: active
    ? alpha(theme.palette.error.main, 0.2)
    : alpha(theme.palette.error.main, 0.08),
  color: theme.palette.error.main,
  textDecoration: 'underline',
  textDecorationStyle: 'wavy',
  textDecorationColor: alpha(theme.palette.error.main, 0.5),
  '&:hover': {
    backgroundColor: alpha(theme.palette.error.main, 0.2),
    transform: 'scale(1.02)',
  },
}));

const AnnotationCard = styled(Box)(({ theme, active }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: 8,
  marginBottom: theme.spacing(1),
  backgroundColor: active
    ? alpha(theme.palette.warning.main, 0.12)
    : alpha(theme.palette.background.default, 0.5),
  border: `1px solid ${active ? alpha(theme.palette.warning.main, 0.3) : 'transparent'}`,
  transition: 'all 0.2s ease',
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1.5),
}));

function AnnotatedText({ fullText, colors }) {
  const theme = useTheme();
  const [highlighted, setHighlighted] = useState(null);

  if (!fullText) return null;

  // Parse the text to separate content and annotations
  const parseTextAndAnnotations = (text) => {
    const annotationPattern = /^\[\d{1,2}\]\s.*$/gm;
    const annotations = text.match(annotationPattern) || [];
    const mainText = text.replace(annotationPattern, '').trim();

    const cleanedAnnotations = annotations.map((line) => {
      const firstSpaceIndex = line.indexOf(' ');
      return line.substring(firstSpaceIndex + 1).trim();
    });

    return { mainText, annotations: cleanedAnnotations };
  };

  const { mainText, annotations } = parseTextAndAnnotations(fullText);

  // Function to parse and display main text with interactive words
  const displayText = () => {
    const regex = /\${(.*?)}\[(\d+)\]/g;
    const result = [];
    let lastIndex = 0;

    mainText.replace(regex, (match, word, index, offset) => {
      // Push preceding text
      if (lastIndex < offset) {
        result.push(
          <span key={`text-${offset}`}>{mainText.slice(lastIndex, offset)}</span>,
        );
      }
      // Push highlighted word
      result.push(
        <Tooltip
          key={`word-${word}-${index}`}
          title={`Click to see correction #${parseInt(index) + 1}`}
          placement="top"
          arrow
        >
          <HighlightedWord
            colors={colors}
            active={highlighted === index}
            onClick={() => setHighlighted(highlighted === index ? null : index)}
          >
            {word}
          </HighlightedWord>
        </Tooltip>,
      );
      lastIndex = offset + match.length;
    });

    // Push remaining text
    if (lastIndex < mainText.length) {
      result.push(<span key="last">{mainText.slice(lastIndex)}</span>);
    }
    return result;
  };

  const errorCount = annotations.length;

  return (
    <ContentCard>
      <CardHeader colors={{ accent: theme.palette.warning.main }}>
        <SpellcheckIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
          Grammar Check Results
        </Typography>
        <Chip
          label={`${errorCount} ${errorCount === 1 ? 'issue' : 'issues'}`}
          size="small"
          sx={{
            height: 22,
            bgcolor:
              errorCount > 0
                ? alpha(theme.palette.error.main, 0.12)
                : alpha(theme.palette.success.main, 0.12),
            color:
              errorCount > 0
                ? theme.palette.error.main
                : theme.palette.success.main,
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        />
      </CardHeader>

      {/* Main Text with Annotations */}
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 1.5,
          }}
        >
          <TouchAppIcon
            sx={{ fontSize: 16, color: theme.palette.text.disabled }}
          />
          <Typography variant="caption" color="text.disabled">
            Click on highlighted words to see corrections
          </Typography>
        </Box>
        <Typography
          variant="body1"
          component="div"
          sx={{
            lineHeight: 2,
            color: theme.palette.text.primary,
          }}
        >
          {displayText()}
        </Typography>
      </Box>

      {/* Annotations List */}
      {annotations.length > 0 && (
        <>
          <Divider sx={{ opacity: 0.5 }} />
          <Box sx={{ p: 2 }}>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.disabled,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'block',
                mb: 1.5,
                px: 0.5,
              }}
            >
              Corrections
            </Typography>
            {annotations.map((note, index) => (
              <AnnotationCard
                key={index}
                active={highlighted === `${index}`}
                onClick={() =>
                  setHighlighted(highlighted === `${index}` ? null : `${index}`)
                }
                sx={{ cursor: 'pointer' }}
              >
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.warning.main, 0.15),
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: theme.palette.warning.main,
                      fontSize: '0.7rem',
                    }}
                  >
                    {index + 1}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.primary,
                    lineHeight: 1.5,
                    flex: 1,
                  }}
                >
                  {note}
                </Typography>
              </AnnotationCard>
            ))}
          </Box>
        </>
      )}
    </ContentCard>
  );
}

export default AnnotatedText;
