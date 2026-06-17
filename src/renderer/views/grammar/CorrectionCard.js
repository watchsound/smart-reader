import React from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import SchoolIcon from '@mui/icons-material/School';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TextAnnotator from 'text-annotator-v2';

import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
import { getGrammarCorrectionExtraPrompt } from './PromptUtil';
import { parseMarkdownToHtmlNoCallback } from '../../components/note/NoteUtil';
import spineApi from '../../api/spineApi';

// Color palette for error type ribbons (matching BookmarkUI style)
const ERROR_TYPE_COLORS = {
  'Subject-Verb Agreement': { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },
  'Tense': { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' },
  'Article': { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },
  'Punctuation': { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' },
  'Spelling': { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },
  'Word Choice': { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' },
  'Preposition': { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' },
  'Capitalization': { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' },
  'Sentence Structure': { bg: '#E8EAF6', accent: '#3F51B5', icon: '#283593' },
  'Pronoun': { bg: '#F1F8E9', accent: '#8BC34A', icon: '#558B2F' },
  default: { bg: '#ECEFF1', accent: '#607D8B', icon: '#455A64' },
};

// Dark mode color palette
const ERROR_TYPE_COLORS_DARK = {
  'Subject-Verb Agreement': { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  'Tense': { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  'Article': { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  'Punctuation': { bg: '#2D1515', accent: '#F44336', icon: '#E57373' },
  'Spelling': { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  'Word Choice': { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
  'Preposition': { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
  'Capitalization': { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
  'Sentence Structure': { bg: '#1A1D2E', accent: '#3F51B5', icon: '#7986CB' },
  'Pronoun': { bg: '#1D2A15', accent: '#8BC34A', icon: '#AED581' },
  default: { bg: '#263238', accent: '#607D8B', icon: '#90A4AE' },
};

// Get color scheme for error type
function getColorsForType(type, isDark) {
  const colorMap = isDark ? ERROR_TYPE_COLORS_DARK : ERROR_TYPE_COLORS;
  // Try exact match first, then partial match
  const exactMatch = colorMap[type];
  if (exactMatch) return exactMatch;

  // Partial match
  const lowerType = type.toLowerCase();
  for (const [key, value] of Object.entries(colorMap)) {
    if (key !== 'default' && lowerType.includes(key.toLowerCase())) {
      return value;
    }
  }

  return colorMap.default;
}

// Styled expand button
const ExpandButton = styled(IconButton)(({ theme, expanded }) => ({
  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
  padding: 6,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

function CorrectionCard({
  originalSentence,
  correctedSentence,
  type,
  original,
  corrected,
  explain,
  example,
  language,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colors = getColorsForType(type, isDark);

  const [expanded, setExpanded] = React.useState(false);
  const [detailedExplanation, setDetailedExplanation] = React.useState('');
  const [htmlCode, setHtmlCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  React.useEffect(() => {
    async function processHtml() {
      let html = await parseMarkdownToHtmlNoCallback(detailedExplanation);
      const annotator = new TextAnnotator(html);
      let ar = annotator.searchAll(type);
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_blue' });
      }
      ar = annotator.searchAll(original);
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_red' });
      }
      ar = annotator.searchAll(corrected);
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_green' });
      }
      ar = annotator.searchAll('correct:');
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_green' });
      }
      ar = annotator.searchAll('incorrect:');
      if (ar.length > 0) {
        html = annotator.annotateAll(ar, { tagName: 'b', baseClassName: '_bg_red' });
      }
      setHtmlCode(html);
    }
    if (detailedExplanation) processHtml();
  }, [detailedExplanation, type, original, corrected]);

  const fetchDetailedData = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const prompt = getGrammarCorrectionExtraPrompt(
        originalSentence,
        correctedSentence,
        original,
        corrected,
        explain,
        language,
      );
      const r = await spineApi.generateContent(prompt, { label: 'grammar-correction-card' });
      setDetailedExplanation(r || '');
    } catch (e) {
      console.log(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(corrected);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 80,
        borderRadius: 2,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateX(4px)',
          boxShadow: isDark
            ? `0 4px 20px ${alpha('#000', 0.4)}`
            : `0 4px 20px ${alpha('#000', 0.1)}`,
          borderColor: alpha(colors.accent, 0.4),
        },
      }}
    >
      {/* Left ribbon section - error type indicator */}
      <Box
        sx={{
          width: 80,
          minWidth: 80,
          height: '100%',
          minHeight: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          borderRadius: '8px 0 0 8px',
          bgcolor: colors.bg,
          p: 1,
        }}
      >
        {/* Accent stripe on the left edge */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: colors.accent,
            borderRadius: '8px 0 0 8px',
          }}
        />

        {/* Error type icon */}
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(colors.accent, 0.15),
            mb: 0.5,
          }}
        >
          <SchoolIcon sx={{ fontSize: 20, color: colors.icon }} />
        </Box>

        {/* Error type label */}
        <Typography
          variant="caption"
          sx={{
            fontSize: '0.6rem',
            fontWeight: 600,
            textAlign: 'center',
            color: colors.icon,
            lineHeight: 1.2,
            px: 0.5,
          }}
        >
          {type}
        </Typography>
      </Box>

      {/* Main content section */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          px: 2,
          py: 1.5,
          minWidth: 0,
        }}
      >
        {/* Original → Corrected row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            mb: 1.5,
          }}
        >
          {/* Original word - strikethrough */}
          <Chip
            label={original}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.error.main, 0.1),
              color: theme.palette.error.main,
              fontWeight: 600,
              fontSize: '0.85rem',
              height: 28,
              textDecoration: 'line-through',
              '& .MuiChip-label': {
                px: 1.5,
              },
            }}
          />

          <ArrowForwardIcon
            sx={{
              fontSize: 18,
              color: theme.palette.text.disabled,
            }}
          />

          {/* Corrected word */}
          <Chip
            label={corrected}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.success.main, 0.12),
              color: theme.palette.success.main,
              fontWeight: 600,
              fontSize: '0.85rem',
              height: 28,
              border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
              '& .MuiChip-label': {
                px: 1.5,
              },
            }}
          />

          {/* Copy button */}
          <Tooltip title={copied ? 'Copied!' : 'Copy correction'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.15s',
                ml: 'auto',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                },
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Explanation */}
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            lineHeight: 1.6,
            fontSize: '0.875rem',
          }}
        >
          {explain}
        </Typography>

        {/* Expandable section */}
        <Collapse in={expanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            {/* Example section */}
            {example && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.info.main, 0.04),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.12)}`,
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AutoStoriesIcon
                    sx={{ fontSize: 16, color: theme.palette.info.main }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.info.main,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Similar Examples
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: '0.8rem',
                    lineHeight: 1.6,
                    fontStyle: 'italic',
                  }}
                >
                  {example}
                </Typography>
              </Box>
            )}

            {/* Deep dive button */}
            {!detailedExplanation && (
              <Box
                component="button"
                onClick={fetchDetailedData}
                disabled={submitting}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  border: `1px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    borderColor: theme.palette.primary.main,
                  },
                  '&:disabled': {
                    opacity: 0.6,
                    cursor: 'not-allowed',
                  },
                }}
              >
                {submitting ? (
                  <>
                    <CircularProgress size={14} sx={{ color: 'inherit' }} />
                    Loading detailed explanation...
                  </>
                ) : (
                  <>
                    <LightbulbOutlinedIcon sx={{ fontSize: 16 }} />
                    Get detailed explanation with AI
                  </>
                )}
              </Box>
            )}

            {/* Detailed explanation content */}
            {detailedExplanation && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1.5,
                  bgcolor: alpha(theme.palette.warning.main, 0.04),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.15)}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <LightbulbOutlinedIcon
                    sx={{ fontSize: 18, color: theme.palette.warning.main }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.warning.main,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Detailed Explanation
                  </Typography>
                </Box>
                <Box
                  className="note__body"
                  sx={{
                    fontSize: '0.85rem',
                    lineHeight: 1.7,
                    color: theme.palette.text.primary,
                    '& p': {
                      margin: '0.5em 0',
                    },
                    '& b._bg_blue': {
                      backgroundColor: alpha(theme.palette.info.main, 0.15),
                      color: theme.palette.info.main,
                      padding: '1px 4px',
                      borderRadius: '3px',
                    },
                    '& b._bg_red': {
                      backgroundColor: alpha(theme.palette.error.main, 0.15),
                      color: theme.palette.error.main,
                      padding: '1px 4px',
                      borderRadius: '3px',
                      textDecoration: 'line-through',
                    },
                    '& b._bg_green': {
                      backgroundColor: alpha(theme.palette.success.main, 0.15),
                      color: theme.palette.success.main,
                      padding: '1px 4px',
                      borderRadius: '3px',
                    },
                  }}
                  dangerouslySetInnerHTML={{ __html: htmlCode }}
                />
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* Right action section */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pr: 1,
        }}
      >
        <Tooltip title={expanded ? 'Show less' : 'Show more'}>
          <ExpandButton
            expanded={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
          >
            <ExpandMoreIcon sx={{ fontSize: 20 }} />
          </ExpandButton>
        </Tooltip>
      </Box>

      {/* Decorative right edge - like a bookmark ribbon tail */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flex: 1, bgcolor: colors.accent, opacity: 0.6 }} />
        <Box
          sx={{
            width: 0,
            height: 0,
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: `5px solid ${theme.palette.background.default}`,
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </Box>
    </Box>
  );
}

export default CorrectionCard;
