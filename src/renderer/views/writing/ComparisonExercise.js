import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Tooltip,
} from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SchoolIcon from '@mui/icons-material/School';

import { langstudyComparisonExerciseMore } from '../../../commons/utils/AIPrompts';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

const ContentCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
  marginBottom: theme.spacing(2),
}));

const CardHeader = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: alpha(colors?.accent || theme.palette.primary.main, 0.06),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const IssueCard = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.error.main, 0.04),
  border: `1px solid ${alpha(theme.palette.error.main, 0.12)}`,
  marginBottom: theme.spacing(1.5),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.error.main, 0.08),
    borderColor: alpha(theme.palette.error.main, 0.2),
  },
}));

const ExerciseCardWrapper = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(2),
  borderRadius: 12,
  backgroundColor: alpha(colors?.accent || theme.palette.primary.main, 0.04),
  border: `1px solid ${alpha(colors?.accent || theme.palette.primary.main, 0.12)}`,
  marginBottom: theme.spacing(1.5),
  transition: 'all 0.2s ease',
}));

const LabelBadge = styled(Box)(({ theme, variant }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 10px',
  borderRadius: 6,
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  ...(variant === 'error' && {
    backgroundColor: alpha(theme.palette.error.main, 0.12),
    color: theme.palette.error.main,
  }),
  ...(variant === 'exercise' && {
    backgroundColor: alpha(theme.palette.info.main, 0.12),
    color: theme.palette.info.main,
  }),
  ...(variant === 'example' && {
    backgroundColor: alpha(theme.palette.success.main, 0.12),
    color: theme.palette.success.main,
  }),
}));

const ActionChip = styled(Chip)(({ theme }) => ({
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.2)}`,
  },
}));

function ExerciseCard({ exercise, colors, index }) {
  const theme = useTheme();
  const [isExampleVisible, setIsExampleVisible] = useState(false);
  const [additionalExamples, setAdditionalExamples] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const toggleExampleVisibility = () => {
    setIsExampleVisible(!isExampleVisible);
  };

  const fetchMoreExamples = async (e) => {
    e.stopPropagation();
    if (isLoading) return;
    setIsLoading(true);
    try {
      const prompt = langstudyComparisonExerciseMore(exercise);
      const moreExamples = await aiProviderManager.generateContentWithJson(
        prompt,
        true,
      );
      if (moreExamples && moreExamples.data) {
        setAdditionalExamples(moreExamples.data);
      }
    } catch (error) {
      console.error('Failed to fetch more examples:', error);
    }
    setIsLoading(false);
  };

  return (
    <ExerciseCardWrapper colors={colors}>
      {/* Exercise Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(colors?.accent || theme.palette.primary.main, 0.15),
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: colors?.accent || theme.palette.primary.main,
            }}
          >
            {index + 1}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <LabelBadge variant="exercise">{exercise.type}</LabelBadge>
        </Box>
      </Box>

      {/* Original Text */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.disabled,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'block',
            mb: 0.5,
          }}
        >
          Original
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.primary,
            lineHeight: 1.6,
            p: 1.5,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.default, 0.5),
          }}
        >
          {exercise.original}
        </Typography>
      </Box>

      {/* Rewrite Exercise */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.disabled,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            display: 'block',
            mb: 0.5,
          }}
        >
          Exercise
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: colors?.accent || theme.palette.primary.main,
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {exercise.rewriteExercise}
        </Typography>
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <ActionChip
          icon={isExampleVisible ? <VisibilityOffIcon sx={{ fontSize: 16 }} /> : <VisibilityIcon sx={{ fontSize: 16 }} />}
          label={isExampleVisible ? 'Hide Example' : 'Show Example'}
          variant="outlined"
          size="small"
          onClick={toggleExampleVisibility}
          sx={{
            borderColor: alpha(
              colors?.accent || theme.palette.primary.main,
              0.3,
            ),
            color: colors?.accent || theme.palette.primary.main,
          }}
        />
        {isExampleVisible && (
          <ActionChip
            icon={<MoreHorizIcon sx={{ fontSize: 16 }} />}
            label={isLoading ? 'Loading...' : 'More Examples'}
            variant="outlined"
            size="small"
            onClick={fetchMoreExamples}
            disabled={isLoading}
            sx={{
              borderColor: alpha(theme.palette.success.main, 0.3),
              color: theme.palette.success.main,
            }}
          />
        )}
      </Box>

      {/* Example */}
      <Collapse in={isExampleVisible}>
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LightbulbIcon
              sx={{ fontSize: 16, color: theme.palette.success.main }}
            />
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.success.main,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Example
            </Typography>
          </Box>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.success.main, 0.08),
              border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: theme.palette.text.primary, lineHeight: 1.6 }}
            >
              {exercise.example}
            </Typography>
          </Box>

          {/* Additional Examples */}
          {additionalExamples.length > 0 && (
            <Box sx={{ mt: 2, pl: 2, borderLeft: `2px solid ${alpha(theme.palette.success.main, 0.3)}` }}>
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.disabled,
                  fontWeight: 600,
                  display: 'block',
                  mb: 1,
                }}
              >
                More Examples
              </Typography>
              {additionalExamples.map((ad, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.background.default, 0.5),
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    {ad.example || ad.original}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </ExerciseCardWrapper>
  );
}

function ComparisonExercise({ mywritingComparison, colors }) {
  const theme = useTheme();

  if (!mywritingComparison) return null;

  const { issues = [], exercises = [] } = mywritingComparison;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Issues Section */}
      {issues.length > 0 && (
        <ContentCard>
          <CardHeader colors={{ accent: theme.palette.error.main }}>
            <ErrorOutlineIcon
              sx={{ color: theme.palette.error.main, fontSize: 20 }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              Issues Found
            </Typography>
            <Chip
              label={issues.length}
              size="small"
              sx={{
                height: 22,
                bgcolor: alpha(theme.palette.error.main, 0.12),
                color: theme.palette.error.main,
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </CardHeader>
          <Box sx={{ p: 2 }}>
            {issues.map((issue, index) => (
              <IssueCard key={index} colors={colors}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.error.main, 0.15),
                      flexShrink: 0,
                      mt: 0.25,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, color: theme.palette.error.main }}
                    >
                      {index + 1}
                    </Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <LabelBadge variant="error" sx={{ mb: 1 }}>
                      {issue.type}
                    </LabelBadge>
                    <Typography
                      variant="body2"
                      sx={{
                        color: theme.palette.text.primary,
                        lineHeight: 1.6,
                      }}
                    >
                      {issue.explain}
                    </Typography>
                  </Box>
                </Box>
              </IssueCard>
            ))}
          </Box>
        </ContentCard>
      )}

      {/* Exercises Section */}
      {exercises.length > 0 && (
        <ContentCard>
          <CardHeader colors={colors}>
            <SchoolIcon sx={{ color: colors?.accent, fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              Practice Exercises
            </Typography>
            <Chip
              label={exercises.length}
              size="small"
              sx={{
                height: 22,
                bgcolor: alpha(colors?.accent || theme.palette.primary.main, 0.12),
                color: colors?.accent || theme.palette.primary.main,
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </CardHeader>
          <Box sx={{ p: 2 }}>
            {exercises.map((exercise, index) => (
              <ExerciseCard
                key={index}
                exercise={exercise}
                colors={colors}
                index={index}
              />
            ))}
          </Box>
        </ContentCard>
      )}
    </Box>
  );
}

export default ComparisonExercise;
