/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ArrowRightAltOutlinedIcon from '@mui/icons-material/ArrowRightAltOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

import { getVerbComparisonPrompt, getVerbExplainedPrompt } from '../../../commons/utils/AIPrompts';
import { parseMarkdownToHtmlNoCallback } from '../../components/note/NoteUtil';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

/**
  "input-verb-list" : [
          {
            "input-verb" : "有",
            "english-verb-options": [ "has", "there are" ],
          },
        ],
 */
function StepTwoVerbCard({
  originalTokens,
  title,
  inputVerbList,
  explain,
  language,
}) {
  const theme = useTheme();
  const [colors, setColors] = React.useState([]);
  const [expanded, setExpanded] = React.useState(false);
  const [detailedExplanation, setDetailedExplanation] = React.useState('');
  const [htmlCode, setHtmlCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    async function t() {
      const html = await parseMarkdownToHtmlNoCallback(detailedExplanation);
      setHtmlCode(html);
    }
    if (detailedExplanation) t();
  }, [detailedExplanation]);

  const fetchDetailedData = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let prompt = '';
      const vbs = inputVerbList[0]['english-verb-options'];
      if (vbs.length > 1) {
        prompt = getVerbComparisonPrompt(vbs[0], vbs[1], language);
      } else {
        prompt = getVerbExplainedPrompt(vbs[0], language);
      }
      const r = await aiProviderManager.generateContent(prompt);
      setDetailedExplanation(r || '');
      setExpanded(true);
    } catch (e) {
      console.log(e);
    } finally {
      setSubmitting(false);
    }
  };

  function findToken(text) {
    const item = originalTokens.filter((item) => item.text === text);
    return item && item.length > 0 ? item[0] : null;
  }

  React.useEffect(() => {
    const cs = [];
    inputVerbList.forEach((item, index) => {
      const iv = findToken(item['input-verb']);
      if (iv) {
        cs.push(iv.color);
      } else {
        cs.push(alpha(theme.palette.error.main, 0.1));
      }
    });
    setColors(cs);
  }, [inputVerbList]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.error.main, 0.1),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
            2
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title || 'Verb Analysis'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Exploring verb translation options
          </Typography>
        </Box>
        {!detailedExplanation && (
          <Chip
            icon={submitting ? <CircularProgress size={14} /> : <AutoAwesomeIcon sx={{ fontSize: 14 }} />}
            label={submitting ? 'Loading...' : 'Deep Dive'}
            size="small"
            onClick={fetchDetailedData}
            disabled={submitting}
            sx={{
              cursor: 'pointer',
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              color: theme.palette.warning.dark,
              '&:hover': {
                bgcolor: alpha(theme.palette.warning.main, 0.2),
              },
            }}
          />
        )}
      </Box>

      {/* Verb Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        {inputVerbList.map((pair, index) => (
          <Box
            key={index}
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.default, 0.5),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              {/* Original Verb */}
              <Box
                sx={{
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: colors[index] || alpha(theme.palette.error.main, 0.1),
                  border: `2px solid ${alpha(theme.palette.error.main, 0.3)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.15)}`,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textDecorationStyle: 'wavy',
                    textDecorationColor: theme.palette.error.main,
                  }}
                >
                  {pair['input-verb']}
                </Typography>
              </Box>

              <ArrowRightAltOutlinedIcon
                sx={{ fontSize: 28, color: theme.palette.text.disabled }}
              />

              {/* English Options */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {Array.isArray(pair['english-verb-options']) ? (
                  pair['english-verb-options'].map((t, i) => (
                    <Chip
                      key={i}
                      label={t}
                      sx={{
                        height: 36,
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        bgcolor: theme.palette.primary.main,
                        color: '#fff',
                        '&:hover': {
                          bgcolor: theme.palette.primary.dark,
                        },
                      }}
                    />
                  ))
                ) : (
                  <Chip
                    label={pair['english-verb-options']}
                    sx={{
                      height: 36,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      bgcolor: theme.palette.primary.main,
                      color: '#fff',
                    }}
                  />
                )}
              </Box>
            </Box>

            {/* Comparison hint */}
            {Array.isArray(pair['english-verb-options']) && pair['english-verb-options'].length > 1 && (
              <Box
                sx={{
                  mt: 2,
                  pt: 1.5,
                  borderTop: `1px dashed ${alpha(theme.palette.divider, 0.2)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                }}
              >
                <CompareArrowsIcon sx={{ fontSize: 16, color: theme.palette.text.disabled }} />
                <Typography variant="caption" color="text.disabled">
                  Multiple translation options available
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Explanation */}
      {explain && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.info.main, 0.04),
            borderLeft: `3px solid ${theme.palette.info.main}`,
            mb: detailedExplanation ? 2 : 0,
          }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, lineHeight: 1.6 }}>
            {explain}
          </Typography>
        </Box>
      )}

      {/* Detailed Explanation */}
      <Collapse in={!!detailedExplanation}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.warning.main, 0.04),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <AutoAwesomeIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.warning.dark }}>
              Deep Dive Analysis
            </Typography>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{ ml: 'auto' }}
            >
              <ExpandMoreIcon
                sx={{
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </IconButton>
          </Box>
          <Collapse in={expanded}>
            <Box
              className="note__body"
              sx={{
                fontSize: '0.875rem',
                lineHeight: 1.7,
                '& p': { mb: 1.5 },
                '& ul, & ol': { pl: 3 },
                '& li': { mb: 0.5 },
                '& code': {
                  bgcolor: alpha(theme.palette.text.primary, 0.06),
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  fontSize: '0.8rem',
                },
              }}
              dangerouslySetInnerHTML={{ __html: htmlCode }}
            />
          </Collapse>
        </Box>
      </Collapse>
    </Box>
  );
}

export default StepTwoVerbCard;
