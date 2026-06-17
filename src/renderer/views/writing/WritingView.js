import React, { useState, useEffect, useMemo } from 'react';
import { styled, useTheme, alpha } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  LinearProgress,
  Collapse,
  Divider,
  CircularProgress,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SchoolIcon from '@mui/icons-material/School';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';

import { steps, stepsInfo } from './config';
import ParagraphWithHiddenWords from './ParagraphWithHiddenWords';
import MultilineTextField from './MultilineTextField';
import {
  langstudyAnnotatePrompt,
  langstudyGrammarCheckPrompt,
  langstudyComparisonExercise,
  langstudy5wPrompt,
} from '../../../commons/utils/AIPrompts';
import AnnotatedText from './AnnotatedText';
import ParagraphComparer from './ParagraphComparer';
import spineApi from '../../api/spineApi';
import ComparisonExercise from './ComparisonExercise';

// Step icons mapping
const stepIcons = {
  Prepare: EditIcon,
  Noun: SpellcheckIcon,
  Verb: AutoFixHighIcon,
  Prepositions: CompareArrowsIcon,
  Collocations: LightbulbIcon,
  Structure: SchoolIcon,
};

// Color palette for steps (matching bookmark style)
const STEP_COLORS = [
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' }, // Blue - Prepare
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' }, // Green - Noun
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' }, // Orange - Verb
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' }, // Purple - Prepositions
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' }, // Cyan - Collocations
  { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' }, // Pink - Structure
];

const STEP_COLORS_DARK = [
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
  { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
];

// Styled Components
const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const StepItem = styled(Box)(({ theme, active, completed, colors }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  position: 'relative',
  marginBottom: theme.spacing(0.5),
  backgroundColor: active ? alpha(colors.accent, 0.12) : 'transparent',
  borderLeft: active ? `3px solid ${colors.accent}` : '3px solid transparent',
  '&:hover': {
    backgroundColor: alpha(colors.accent, 0.08),
  },
  '&::before': active
    ? {
        content: '""',
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 3,
        backgroundColor: colors.accent,
        borderRadius: '0 2px 2px 0',
      }
    : {},
}));

const StepIconWrapper = styled(Box)(({ theme, colors, active, completed }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: completed
    ? colors.accent
    : active
      ? alpha(colors.accent, 0.15)
      : alpha(theme.palette.text.primary, 0.04),
  transition: 'all 0.2s ease',
}));

const ContentCard = styled(Box)(({ theme, colors }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
  transition: 'all 0.2s ease',
  '&:hover': {
    boxShadow:
      theme.palette.mode === 'dark'
        ? `0 4px 20px ${alpha('#000', 0.4)}`
        : `0 4px 20px ${alpha('#000', 0.08)}`,
  },
}));

const CardHeader = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(2, 3),
  backgroundColor: alpha(colors?.accent || theme.palette.primary.main, 0.06),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
}));

const ActionButton = styled(IconButton)(({ theme, variant }) => ({
  backgroundColor:
    variant === 'primary'
      ? theme.palette.primary.main
      : alpha(theme.palette.primary.main, 0.08),
  color: variant === 'primary' ? '#fff' : theme.palette.primary.main,
  '&:hover': {
    backgroundColor:
      variant === 'primary'
        ? theme.palette.primary.dark
        : alpha(theme.palette.primary.main, 0.16),
  },
  transition: 'all 0.2s ease',
}));

const EmptyState = ({ icon: Icon, title, subtitle, colors }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        textAlign: 'center',
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(colors?.accent || theme.palette.primary.main, 0.1),
          mb: 3,
        }}
      >
        <Icon
          sx={{
            fontSize: 40,
            color: colors?.accent || theme.palette.primary.main,
            opacity: 0.8,
          }}
        />
      </Box>
      <Typography
        variant="h6"
        sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 320, lineHeight: 1.6 }}
      >
        {subtitle}
      </Typography>
    </Box>
  );
};

// 5W Display Component
function SceneAnalysisDisplay({ data, colors }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!data?.data) return null;

  const labels = [
    { key: 'who', label: 'Who', icon: '👤' },
    { key: 'what', label: 'What', icon: '📝' },
    { key: 'when', label: 'When', icon: '🕐' },
    { key: 'where', label: 'Where', icon: '📍' },
    { key: 'why', label: 'Why', icon: '💡' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {data.data.map((item, index) => (
        <ContentCard key={index} colors={colors}>
          <CardHeader colors={colors}>
            <Chip
              label={`Scene ${item.sentenceIndex}`}
              size="small"
              sx={{
                bgcolor: colors.accent,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </CardHeader>
          <Box sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 1.5,
              }}
            >
              {labels.map(({ key, label, icon }) => (
                <Box
                  key={key}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(colors.accent, 0.06),
                    border: `1px solid ${alpha(colors.accent, 0.15)}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      color: colors.accent,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    {icon} {label}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.primary,
                      fontSize: '0.8rem',
                    }}
                  >
                    {item[key] || '—'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </ContentCard>
      ))}
    </Box>
  );
}

function WritingView() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? STEP_COLORS_DARK : STEP_COLORS;

  const [activeStep, setActiveStep] = useState(0);
  const [text, setText] = useState('');
  const [decorText, setDecorText] = useState(['', '', '', '', '', '']);
  const [lang5w, setLang5w] = useState('');
  const [mywriting, setMywriting] = useState('');
  const [mywritingCheck, setMywritingCheck] = useState('');
  const [mywritingComparison, setMywritingComparison] = useState('');
  const [letmetry, setLetmetry] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const curStep = steps[activeStep];
  const colors = colorPalette[activeStep];

  useEffect(() => {
    async function loadAnnotation() {
      if (!text || decorText[activeStep]) return;
      setIsLoading(true);
      try {
        const prompt = langstudyAnnotatePrompt(curStep);
        const mapped = await spineApi.generateContentWithJson(
          `${prompt}\n ${text}`,
          null,
          { label: 'writing-mapping' },
        );
        setDecorText((prev) =>
          prev.map((value, index) => (index === activeStep ? mapped : value)),
        );
      } catch (error) {
        console.error('Failed to load annotation:', error);
      }
      setIsLoading(false);
    }
    if (activeStep > 0) loadAnnotation();
  }, [activeStep, text]);

  const resetText = (content) => {
    setText(content);
    setDecorText(['', '', '', '', '', '']);
    setLang5w('');
    setLetmetry(false);
    setMywriting('');
    setMywritingCheck('');
    setMywritingComparison('');
    setActiveStep(0);
  };

  const handleStepClick = (index) => {
    if (index === 0 || text) {
      setActiveStep(index);
    }
  };

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const tryLetmetry = async () => {
    setLetmetry(true);
    if (!text || lang5w) return;
    setIsLoading(true);
    try {
      const r = await spineApi.generateContentWithJson(
        `${langstudy5wPrompt}\n  ${text}`,
        null,
        { label: 'writing-view' },
      );
      setLang5w(r);
    } catch (error) {
      console.error('Failed to analyze 5W:', error);
    }
    setIsLoading(false);
  };

  const tryGrammarComparison = async () => {
    if (!mywriting) return;
    const prompt = langstudyComparisonExercise(text, mywriting);
    const r = await spineApi.generateContentWithJson(prompt, null, { label: 'writing-view' });
    setMywritingComparison(r);
  };

  const tryGrammarChecking = async () => {
    if (!mywriting) return;
    setIsLoading(true);
    try {
      const r = await spineApi.generateContentWithJson(
        `${langstudyGrammarCheckPrompt}\n please do grammar checking for: \n${mywriting}`,
        null,
        { label: 'writing-view' },
      );
      setMywritingCheck(r);
      await tryGrammarComparison();
    } catch (error) {
      console.error('Failed grammar check:', error);
    }
    setIsLoading(false);
  };

  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: sidebarCollapsed ? 0 : 280,
          minWidth: sidebarCollapsed ? 0 : 280,
          height: '100%',
          bgcolor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar Header */}
        <SidebarSection sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              }}
            >
              <EditIcon sx={{ color: theme.palette.primary.main }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Writing Practice
            </Typography>
          </Box>

          {/* Progress */}
          <Box sx={{ mb: 1 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                mb: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Progress
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: colors.accent }}
              >
                {activeStep + 1}/{steps.length}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(colors.accent, 0.15),
                '& .MuiLinearProgress-bar': {
                  bgcolor: colors.accent,
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        </SidebarSection>

        {/* Steps List */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
              px: 0.5,
            }}
          >
            Learning Steps
          </Typography>

          {steps.map((step, index) => {
            const StepIcon = stepIcons[step];
            const stepColors = colorPalette[index];
            const isActive = index === activeStep;
            const isCompleted = index < activeStep;
            const isDisabled = index > 0 && !text;

            return (
              <StepItem
                key={step}
                active={isActive}
                completed={isCompleted}
                colors={stepColors}
                onClick={() => !isDisabled && handleStepClick(index)}
                sx={{
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <StepIconWrapper
                  colors={stepColors}
                  active={isActive}
                  completed={isCompleted}
                >
                  {isCompleted ? (
                    <CheckCircleIcon
                      sx={{ fontSize: 20, color: '#fff' }}
                    />
                  ) : (
                    <StepIcon
                      sx={{
                        fontSize: 20,
                        color: isActive
                          ? stepColors.accent
                          : theme.palette.text.secondary,
                      }}
                    />
                  )}
                </StepIconWrapper>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: isActive ? 600 : 500,
                      color: isActive
                        ? stepColors.accent
                        : theme.palette.text.primary,
                    }}
                  >
                    {step}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.text.disabled,
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {stepsInfo[index]}
                  </Typography>
                </Box>

                {isActive && (
                  <ChevronRightIcon
                    sx={{ fontSize: 18, color: stepColors.accent }}
                  />
                )}
              </StepItem>
            );
          })}
        </Box>

        {/* Sidebar Footer */}
        {text && (
          <SidebarSection>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Previous Step">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleBack}
                    disabled={activeStep === 0}
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.16),
                      },
                    }}
                  >
                    <ChevronRightIcon
                      sx={{ transform: 'rotate(180deg)', fontSize: 20 }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Next Step">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleNext}
                    disabled={activeStep === steps.length - 1}
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.16),
                      },
                    }}
                  >
                    <ChevronRightIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Start Over">
                <IconButton
                  size="small"
                  onClick={() => resetText('')}
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    color: theme.palette.error.main,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.16),
                    },
                  }}
                >
                  <RefreshIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </SidebarSection>
        )}
      </Box>

      {/* Toggle Sidebar Button */}
      <IconButton
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        sx={{
          position: 'absolute',
          left: sidebarCollapsed ? 8 : 268,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: 24,
          height: 48,
          borderRadius: '0 4px 4px 0',
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderLeft: 'none',
          transition: 'left 0.2s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        <ChevronRightIcon
          sx={{
            fontSize: 16,
            transform: sidebarCollapsed ? 'none' : 'rotate(180deg)',
          }}
        />
      </IconButton>

      {/* Main Content */}
      <Box
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header Bar */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {curStep}
              </Typography>
              <Chip
                label={`Step ${activeStep + 1}`}
                size="small"
                sx={{
                  bgcolor: alpha(colors.accent, 0.12),
                  color: colors.accent,
                  fontWeight: 600,
                  fontSize: '0.7rem',
                }}
              />
              {isLoading && (
                <CircularProgress size={18} sx={{ color: colors.accent }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {stepsInfo[activeStep]}
            </Typography>
          </Box>

          {text && activeStep === 0 && !letmetry && (
            <Tooltip title="Try writing your own version">
              <span>
                <ActionButton variant="primary" onClick={tryLetmetry}>
                  <PlayArrowIcon />
                </ActionButton>
              </span>
            </Tooltip>
          )}
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
          }}
        >
          {/* Prepare Step - Text Input */}
          {activeStep === 0 && (
            <Box sx={{ maxWidth: 800 }}>
              {!text ? (
                <>
                  <EmptyState
                    icon={TipsAndUpdatesIcon}
                    title="Start Your Writing Journey"
                    subtitle="Enter a paragraph you'd like to learn from. We'll guide you through analyzing nouns, verbs, prepositions, collocations, and sentence structure."
                    colors={colors}
                  />
                  <MultilineTextField
                    initialText={text}
                    placeholder="Paste or type a paragraph you want to learn from..."
                    onTextChange={(t) => setText(t)}
                    colors={colors}
                  />
                </>
              ) : (
                <>
                  <ContentCard colors={colors} sx={{ mb: 3 }}>
                    <CardHeader colors={colors}>
                      <EditIcon sx={{ color: colors.accent, fontSize: 20 }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Source Paragraph
                      </Typography>
                    </CardHeader>
                    <Box sx={{ p: 3 }}>
                      <Typography
                        variant="body1"
                        sx={{ lineHeight: 1.8, color: theme.palette.text.primary }}
                      >
                        {text}
                      </Typography>
                    </Box>
                  </ContentCard>

                  <Collapse in={letmetry}>
                    {/* 5W Analysis */}
                    {lang5w && (
                      <Box sx={{ mb: 3 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            mb: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <LightbulbIcon
                            sx={{ fontSize: 18, color: colors.accent }}
                          />
                          Scene Analysis (5W)
                        </Typography>
                        <SceneAnalysisDisplay data={lang5w} colors={colors} />
                      </Box>
                    )}

                    {/* My Writing Input */}
                    <ContentCard colors={colors} sx={{ mb: 3 }}>
                      <CardHeader colors={colors}>
                        <EditIcon sx={{ color: colors.accent, fontSize: 20 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Your Version
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Tooltip title="Check Grammar">
                          <span>
                            <ActionButton
                              size="small"
                              onClick={tryGrammarChecking}
                              disabled={!mywriting || isLoading}
                            >
                              <SpellcheckIcon sx={{ fontSize: 18 }} />
                            </ActionButton>
                          </span>
                        </Tooltip>
                      </CardHeader>
                      <Box sx={{ p: 2 }}>
                        <MultilineTextField
                          initialText={mywriting}
                          placeholder="Write your own paragraph based on the scene analysis..."
                          onTextChange={(t) => setMywriting(t)}
                          colors={colors}
                          minimal
                        />
                      </Box>
                    </ContentCard>

                    {/* Grammar Check Results */}
                    {mywritingCheck && (
                      <AnnotatedText fullText={mywritingCheck} colors={colors} />
                    )}

                    {/* Comparison Exercise */}
                    {mywritingComparison && (
                      <ComparisonExercise
                        mywritingComparison={mywritingComparison}
                        colors={colors}
                      />
                    )}

                    {/* Paragraph Comparison */}
                    {mywritingCheck && (
                      <Box sx={{ mt: 3 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 600,
                            mb: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <CompareArrowsIcon
                            sx={{ fontSize: 18, color: colors.accent }}
                          />
                          Side-by-Side Comparison
                        </Typography>
                        <ParagraphComparer
                          paragraph1={text}
                          paragraph2={mywriting}
                          colors={colors}
                        />
                      </Box>
                    )}
                  </Collapse>
                </>
              )}
            </Box>
          )}

          {/* Other Steps - Cloze Exercise */}
          {activeStep > 0 && (
            <Box sx={{ maxWidth: 800 }}>
              {isLoading ? (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: 8,
                    gap: 2,
                  }}
                >
                  <CircularProgress sx={{ color: colors.accent }} />
                  <Typography variant="body2" color="text.secondary">
                    Preparing exercise...
                  </Typography>
                </Box>
              ) : decorText[activeStep] ? (
                <ParagraphWithHiddenWords
                  inputText={decorText[activeStep]}
                  colors={colors}
                />
              ) : (
                <EmptyState
                  icon={stepIcons[curStep]}
                  title="No Content Available"
                  subtitle="Please enter a paragraph in the Prepare step first."
                  colors={colors}
                />
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default WritingView;
