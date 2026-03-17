/* eslint-disable no-loop-func */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  IconButton,
  InputBase,
  Chip,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  LinearProgress,
  Collapse,
  Fade,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { v4 as uuid } from 'uuid';

// Icons
import SendIcon from '@mui/icons-material/Send';
import TranslateIcon from '@mui/icons-material/Translate';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import GradeIcon from '@mui/icons-material/Grade';
import SchoolIcon from '@mui/icons-material/School';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import customStorage from '../../store/customStorage';
import { LanguageModel, ReaderLevel } from '../../../commons/model/DataTypes';
import {
  getNLPAnnotationPrompt,
  getTranslatePrompt,
} from '../../../commons/utils/AIPrompts';
import { getTokenAndDependencies } from './DependencyUtil';
import DependencyTree from './DependencyTree';
import StepOneSVOCard from './StepOneSVOCard';
import StepTwoVerbCard from './StepTwoVerbCard';
import StepThreeSentenceStructureCard from './StepThreeSentenceStructureCard';
import StepFourSentenceScaffoldCard from './StepFourSentenceScaffoldCard';
import StepFiveFinalCard from './StepFiveFinalCard';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

// Styled components matching Bookmark view
const SearchContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  borderRadius: theme.shape.borderRadius * 2,
  padding: '8px 16px',
  transition: 'all 0.2s ease',
  border: `1px solid transparent`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
  },
  '&:focus-within': {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
}));

const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const QuickFilterChip = styled(Chip)(({ theme, selected }) => ({
  height: 32,
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  border: `1px solid ${selected
    ? theme.palette.primary.main
    : alpha(theme.palette.divider, 0.3)}`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

const StepCard = styled(Box)(({ theme, active, completed }) => ({
  borderRadius: 12,
  padding: theme.spacing(2),
  marginBottom: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.divider, active ? 0.2 : 0.08)}`,
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'hidden',
  ...(active && {
    boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.15)}`,
    borderColor: alpha(theme.palette.primary.main, 0.3),
  }),
  ...(completed && {
    borderLeftWidth: 4,
    borderLeftColor: theme.palette.success.main,
  }),
  '&::before': active ? {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  } : {},
}));

const StepNumber = styled(Box)(({ theme, active, completed }) => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: 700,
  transition: 'all 0.2s ease',
  backgroundColor: completed
    ? theme.palette.success.main
    : active
    ? theme.palette.primary.main
    : alpha(theme.palette.text.primary, 0.1),
  color: completed || active ? '#fff' : theme.palette.text.secondary,
}));

const InputPanel = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2.5),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  boxShadow: `0 -4px 20px ${alpha(theme.palette.common.black, 0.05)}`,
}));

const SendButton = styled(IconButton)(({ theme, disabled }) => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: disabled
    ? alpha(theme.palette.primary.main, 0.1)
    : theme.palette.primary.main,
  color: disabled ? theme.palette.text.disabled : '#fff',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: disabled
      ? alpha(theme.palette.primary.main, 0.1)
      : theme.palette.primary.dark,
    transform: disabled ? 'none' : 'scale(1.05)',
  },
}));

const LanguageSelector = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: '6px 12px',
  borderRadius: 8,
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.12),
  },
}));

const DependencyContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: 16,
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  backdropFilter: 'blur(10px)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.08)}`,
  marginBottom: theme.spacing(3),
  overflow: 'hidden',
}));

const EmptyState = ({ icon: Icon, title, subtitle }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        textAlign: 'center',
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          mb: 3,
          position: 'relative',
        }}
      >
        <Icon sx={{ fontSize: 48, color: theme.palette.primary.main, opacity: 0.7 }} />
        <AutoAwesomeIcon
          sx={{
            position: 'absolute',
            top: -5,
            right: -5,
            fontSize: 24,
            color: theme.palette.warning.main,
          }}
        />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5, color: theme.palette.text.primary }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 360, lineHeight: 1.6 }}>
        {subtitle}
      </Typography>
    </Box>
  );
};

// Step titles for progress indicator
const STEP_TITLES = [
  { title: 'Analysis', subtitle: 'Parsing sentence structure' },
  { title: 'Subject-Verb-Object', subtitle: 'Identifying core components' },
  { title: 'Verb Analysis', subtitle: 'Exploring verb options' },
  { title: 'Sentence Scaffolds', subtitle: 'Building translation options' },
  { title: 'Structure Selection', subtitle: 'Choosing sentence type' },
  { title: 'Final Translation', subtitle: 'Complete English sentence' },
];

function TranslateMainPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');

  const [content, setContent] = useState('');
  const [readerLevel, setReaderLevel] = useState('');

  const [sentence, setSentence] = useState('');
  const [annotationJsonOriginal, setAnnotationJsonOriginal] = useState(null);
  const [dependenciesOriginal, setDependenciesOriginal] = useState([]);
  const [tokensOriginal, setTokensOriginal] = useState([]);

  const [translateProcess, setTranslateProcess] = useState(null);

  const [annotationJsonTranslated, setAnnotationJsonTranslated] = useState(null);
  const [dependenciesTranslated, setDependenciesTranslated] = useState([]);
  const [tokensTranslated, setTokensTranslated] = useState([]);

  const [curStep, setCurStep] = useState(0);
  const [stepId, setStepId] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [languageModel, setLanguageModel] = useState(LanguageModel.Chinese);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDependency, setShowDependency] = useState(true);
  const [history, setHistory] = useState([]);

  const componentRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    async function t() {
      const r = await customStorage.getReaderLevel();
      setReaderLevel(r);
    }
    t();
  }, []);

  // Auto-scroll to latest step
  useEffect(() => {
    if (contentRef.current && curStep > 0) {
      setTimeout(() => {
        contentRef.current.scrollTo({
          top: contentRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 300);
    }
  }, [curStep]);

  const clearChat = () => {
    setSentence('');
    setContent('');
    setAnnotationJsonOriginal(null);
    setTranslateProcess(null);
    setDependenciesOriginal([]);
    setTokensOriginal([]);
    setDependenciesTranslated([]);
    setTokensTranslated([]);
    setCurStep(0);
  };

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const annotateSentence = async (input, isOriginal) => {
    const prompt = getNLPAnnotationPrompt(input.trim());
    const jsonData = await aiProviderManager.generateContentWithJson(
      prompt,
      true,
      'sentence',
    );
    if (!jsonData) return false;
    if (isOriginal) {
      setAnnotationJsonOriginal(jsonData);
      const { t, d } = getTokenAndDependencies(jsonData);
      setTokensOriginal(t);
      setDependenciesOriginal(d);
    } else {
      setAnnotationJsonTranslated(jsonData);
      const { t, d } = getTokenAndDependencies(jsonData);
      setTokensTranslated(t);
      setDependenciesTranslated(d);
    }
    return true;
  };

  const startInterval = () => {
    const intervalId = setInterval(() => {
      setCurStep((prevStep) => {
        if (prevStep >= 5) {
          clearInterval(intervalId);
          return prevStep;
        }
        return prevStep + 1;
      });
    }, 2000);
    setStepId(intervalId);
  };

  const submit = async () => {
    if (submitting) return;
    if (!content.trim()) {
      showMessage('Please enter a sentence to translate', 'warning');
      return;
    }

    clearChat();

    try {
      setSubmitting(true);
      setSentence(content.trim());

      // Add to history
      setHistory((prev) => [
        { id: uuid(), text: content.trim(), timestamp: new Date() },
        ...prev.slice(0, 9),
      ]);

      const success = await annotateSentence(content.trim(), true);
      if (success) {
        const prompt2 = getTranslatePrompt(content.trim(), languageModel);
        const jsonData2 = await aiProviderManager.generateContentWithJson(
          prompt2,
          true,
          'input-sentence',
        );
        if (jsonData2) {
          setTranslateProcess(jsonData2);
          startInterval();
          annotateSentence(jsonData2['step-5'].output, false);
        }
      }

      setSubmitting(false);
    } catch (error) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showMessage('No internet connection.', 'error');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showMessage(message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onContentChange = (event) => {
    const { value } = event.currentTarget;
    setContent(value);
  };

  const handleLanguageToggle = () => {
    setLanguageModel((prev) =>
      prev === LanguageModel.Chinese ? LanguageModel.Japanese : LanguageModel.Chinese
    );
  };

  const handleHistoryClick = (text) => {
    setContent(text);
  };

  const languageLabels = {
    [LanguageModel.Chinese]: { from: '中文', to: 'English', flag: '🇨🇳' },
    [LanguageModel.Japanese]: { from: '日本語', to: 'English', flag: '🇯🇵' },
  };

  const currentLang = languageLabels[languageModel];

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
        <SidebarSection sx={{ py: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              <TranslateIcon sx={{ color: '#fff', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Translation
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Step-by-step learning
              </Typography>
            </Box>
          </Box>
        </SidebarSection>

        {/* Language Selection */}
        <SidebarSection>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1.5,
            }}
          >
            Translation Direction
          </Typography>
          <LanguageSelector onClick={handleLanguageToggle}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {currentLang.flag} {currentLang.from}
            </Typography>
            <SwapHorizIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              🇬🇧 {currentLang.to}
            </Typography>
          </LanguageSelector>
        </SidebarSection>

        {/* Progress Steps */}
        <SidebarSection sx={{ flex: 0 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1.5,
            }}
          >
            Progress
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {STEP_TITLES.map((step, index) => {
              const isCompleted = curStep > index;
              const isActive = curStep === index && submitting;
              return (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1.5,
                    bgcolor: isActive
                      ? alpha(theme.palette.primary.main, 0.08)
                      : 'transparent',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <StepNumber active={isActive} completed={isCompleted}>
                    {isCompleted ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : index + 1}
                  </StepNumber>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isActive || isCompleted ? 600 : 500,
                        color: isCompleted
                          ? theme.palette.success.main
                          : isActive
                          ? theme.palette.primary.main
                          : theme.palette.text.secondary,
                        fontSize: '0.8rem',
                      }}
                    >
                      {step.title}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </SidebarSection>

        {/* History */}
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
            <HistoryIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
            Recent
          </Typography>
          {history.length === 0 ? (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ px: 0.5, fontSize: '0.8rem' }}
            >
              No recent translations
            </Typography>
          ) : (
            history.map((item) => (
              <Box
                key={item.id}
                onClick={() => handleHistoryClick(item.text)}
                sx={{
                  p: 1,
                  mb: 0.5,
                  borderRadius: 1,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.8rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.text}
                </Typography>
              </Box>
            ))
          )}
        </Box>
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
        {sidebarCollapsed ? (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />
        )}
      </IconButton>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {sentence ? 'Translation Analysis' : 'New Translation'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {sentence
                ? `Analyzing: "${sentence.slice(0, 30)}${sentence.length > 30 ? '...' : ''}"`
                : 'Enter a sentence below to begin'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {sentence && (
              <Tooltip title="Toggle dependency tree">
                <Chip
                  icon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
                  label="Parse Tree"
                  size="small"
                  onClick={() => setShowDependency(!showDependency)}
                  sx={{
                    bgcolor: showDependency
                      ? alpha(theme.palette.primary.main, 0.1)
                      : 'transparent',
                    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                    cursor: 'pointer',
                  }}
                />
              </Tooltip>
            )}
            {sentence && (
              <Tooltip title="Clear and start over">
                <IconButton size="small" onClick={clearChat}>
                  <ClearIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Progress Bar */}
        {submitting && (
          <LinearProgress
            sx={{
              height: 3,
              '& .MuiLinearProgress-bar': {
                background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              },
            }}
          />
        )}

        {/* Content Area */}
        <Box
          ref={contentRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 3,
          }}
        >
          {!sentence && !submitting ? (
            <EmptyState
              icon={TranslateIcon}
              title="Start Your Translation Journey"
              subtitle={
                languageModel === LanguageModel.Chinese
                  ? 'Enter a Chinese sentence below and watch as AI breaks it down step-by-step into English'
                  : 'Enter a Japanese sentence below and watch as AI breaks it down step-by-step into English'
              }
            />
          ) : (
            <Box sx={{ maxWidth: 900, mx: 'auto', overflow: 'hidden' }}>
              {/* Dependency Trees */}
              <Collapse in={showDependency}>
                {sentence && tokensOriginal.length > 0 && (
                  <DependencyContainer>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AccountTreeIcon
                        sx={{ fontSize: 20, color: theme.palette.primary.main }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        Original Sentence Structure
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4, pb: 2, overflowX: 'auto', overflowY: 'hidden' }}>
                      <DependencyTree
                        tokens={tokensOriginal}
                        dependencies={dependenciesOriginal}
                      />
                    </Box>
                  </DependencyContainer>
                )}

                {sentence && tokensTranslated.length > 0 && (
                  <DependencyContainer>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AccountTreeIcon
                        sx={{ fontSize: 20, color: theme.palette.success.main }}
                      />
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        English Sentence Structure
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4, pb: 2, overflowX: 'auto', overflowY: 'hidden' }}>
                      <DependencyTree
                        tokens={tokensTranslated}
                        dependencies={dependenciesTranslated}
                      />
                    </Box>
                  </DependencyContainer>
                )}
              </Collapse>

              {/* Translation Steps */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {translateProcess && curStep > 0 && (
                  <Fade in timeout={500}>
                    <Box>
                      <StepCard active={curStep === 1} completed={curStep > 1}>
                        <StepOneSVOCard
                          originalTokens={tokensOriginal}
                          title={translateProcess['step-1'].title}
                          subVerbObjList={translateProcess['step-1']['sub-verb-obj-list']}
                          explain={translateProcess['step-1'].explain}
                        />
                      </StepCard>
                    </Box>
                  </Fade>
                )}

                {translateProcess && curStep > 1 && (
                  <Fade in timeout={500}>
                    <Box>
                      <StepCard active={curStep === 2} completed={curStep > 2}>
                        <StepTwoVerbCard
                          language={languageModel}
                          originalTokens={tokensOriginal}
                          title={translateProcess['step-2'].title}
                          inputVerbList={translateProcess['step-2']['input-verb-list']}
                          explain={translateProcess['step-2'].explain}
                        />
                      </StepCard>
                    </Box>
                  </Fade>
                )}

                {translateProcess && curStep > 2 && (
                  <Fade in timeout={500}>
                    <Box>
                      <StepCard active={curStep === 3} completed={curStep > 3}>
                        <StepFourSentenceScaffoldCard
                          title={translateProcess['step-3'].title}
                          scaffoldOptions={translateProcess['step-3']['scaffold-options']}
                          explain={translateProcess['step-3'].explain}
                        />
                      </StepCard>
                    </Box>
                  </Fade>
                )}

                {translateProcess && curStep > 3 && (
                  <Fade in timeout={500}>
                    <Box>
                      <StepCard active={curStep === 4} completed={curStep > 4}>
                        <StepThreeSentenceStructureCard
                          title={translateProcess['step-4'].title}
                          sentenceStructure={translateProcess['step-4']['sentence-structure']}
                          explain={translateProcess['step-4'].explain}
                        />
                      </StepCard>
                    </Box>
                  </Fade>
                )}

                {translateProcess && curStep > 4 && (
                  <Fade in timeout={500}>
                    <Box>
                      <StepCard active={false} completed>
                        <StepFiveFinalCard
                          title={translateProcess['step-5'].title}
                          output={translateProcess['step-5'].output}
                          explain={translateProcess['step-5'].explain}
                        />
                      </StepCard>
                    </Box>
                  </Fade>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* Input Panel */}
        <InputPanel>
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  maxRows={4}
                  disabled={submitting}
                  value={content}
                  onChange={onContentChange}
                  placeholder={
                    languageModel === LanguageModel.Chinese
                      ? '输入需要翻译的中文句子...'
                      : '翻訳が必要な日本語の文を入力してください...'
                  }
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      bgcolor: alpha(theme.palette.text.primary, 0.02),
                      '&:hover': {
                        bgcolor: alpha(theme.palette.text.primary, 0.04),
                      },
                      '&.Mui-focused': {
                        bgcolor: theme.palette.background.paper,
                      },
                    },
                  }}
                  onKeyDown={async (event) => {
                    if (event.code === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  Press Enter to translate, Shift+Enter for new line
                </Typography>
              </Box>
              <Tooltip title="Translate">
                <SendButton onClick={submit} disabled={submitting || !content.trim()}>
                  {submitting ? (
                    <AutoAwesomeIcon sx={{ fontSize: 22, animation: 'pulse 1s infinite' }} />
                  ) : (
                    <SendIcon sx={{ fontSize: 22 }} />
                  )}
                </SendButton>
              </Tooltip>
            </Box>
          </Box>
        </InputPanel>
      </Box>

      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%', borderRadius: 2 }}
          elevation={6}
        >
          {alertMessage}
        </Alert>
      </Snackbar>

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </Box>
  );
}

export default TranslateMainPage;
