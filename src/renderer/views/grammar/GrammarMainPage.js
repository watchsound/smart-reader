/* eslint-disable no-loop-func */
/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Divider,
  Chip,
  Tooltip,
  Paper,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  Alert,
  Snackbar,
  CircularProgress,
  Fade,
  Collapse,
  LinearProgress,
} from '@mui/material';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import SendIcon from '@mui/icons-material/Send';
import ClearIcon from '@mui/icons-material/Clear';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import TranslateIcon from '@mui/icons-material/Translate';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';

import { TextAnnotateBlend } from 'react-text-annotate-blend';

import customStorage from '../../store/customStorage';
import { LanguageModel } from '../../../commons/model/DataTypes';
import {
  getGrammarCorrectionPrompt,
  getLangSystemMessage,
} from './PromptUtil';
import CorrectionCard from './CorrectionCard';
import {
  getGrammarOriginalToAnnotation,
  getGrammarCorrectedToAnnotation,
} from './GrammarUtil';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

// Styled Components - Matching BookmarksPage style
const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const InputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius * 2,
  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
  transition: 'all 0.2s ease',
  overflow: 'hidden',
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.3),
  },
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
}));

const QuickFilterChip = styled(Chip)(({ theme, selected }) => ({
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  border: `1px solid ${
    selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.3)
  }`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

const LanguageChip = styled(Chip)(({ theme, selected }) => ({
  height: 32,
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  backgroundColor: selected
    ? theme.palette.primary.main
    : alpha(theme.palette.primary.main, 0.08),
  color: selected ? '#fff' : theme.palette.primary.main,
  border: 'none',
  '&:hover': {
    backgroundColor: selected
      ? theme.palette.primary.dark
      : alpha(theme.palette.primary.main, 0.16),
  },
}));

const StatsCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius * 1.5,
  backgroundColor: alpha(theme.palette.background.paper, 0.6),
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

// Empty State Component
const EmptyState = ({ icon: Icon, title, subtitle }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '50vh',
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
        }}
      >
        <Icon
          sx={{ fontSize: 48, color: theme.palette.primary.main, opacity: 0.7 }}
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

// Annotation Display Component with better styling
const AnnotationDisplay = ({ content, annotations, label, type }) => {
  const theme = useTheme();
  const isOriginal = type === 'original';

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${alpha(
          isOriginal ? theme.palette.error.main : theme.palette.success.main,
          0.2
        )}`,
        bgcolor: alpha(
          isOriginal ? theme.palette.error.main : theme.palette.success.main,
          0.02
        ),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: alpha(
            isOriginal ? theme.palette.error.main : theme.palette.success.main,
            0.08
          ),
          borderBottom: `1px solid ${alpha(
            isOriginal ? theme.palette.error.main : theme.palette.success.main,
            0.1
          )}`,
        }}
      >
        {isOriginal ? (
          <ErrorOutlineIcon
            sx={{ fontSize: 18, color: theme.palette.error.main }}
          />
        ) : (
          <CheckCircleOutlineIcon
            sx={{ fontSize: 18, color: theme.palette.success.main }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isOriginal
              ? theme.palette.error.main
              : theme.palette.success.main,
          }}
        >
          {label}
        </Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        <TextAnnotateBlend
          content={content}
          value={annotations}
          style={{
            fontSize: '1rem',
            lineHeight: 1.8,
            fontFamily: theme.typography.fontFamily,
          }}
        />
      </Box>
    </Box>
  );
};

function GrammarMainPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // State
  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');
  const [content, setContent] = useState('');
  const [readerLevel, setReaderLevel] = useState('');
  const [sentence, setSentence] = useState('');
  const [corrected, setCorrected] = useState('');
  const [originalAnnotation, setOriginalAnnotation] = useState([]);
  const [correctedAnnotation, setCorrectedAnnotation] = useState([]);
  const [grammarCorrection, setGrammarCorrection] = useState(null);
  const [grammarCorrectionList, setGrammarCorrectionList] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [languageModel, setLanguageModel] = useState(LanguageModel.English);
  const [history, setHistory] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Load reader level on mount
  useEffect(() => {
    async function loadSettings() {
      const r = await customStorage.getReaderLevel();
      setReaderLevel(r);
    }
    loadSettings();
  }, []);

  const clearChat = () => {
    setSentence('');
    setGrammarCorrection(null);
    setContent('');
    setCorrected('');
    setOriginalAnnotation([]);
    setCorrectedAnnotation([]);
    setGrammarCorrectionList([]);
  };

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const submit = async () => {
    if (submitting) return;
    if (!content.trim()) {
      showMessage('Please enter some text to check', 'warning');
      return;
    }

    clearChat();

    try {
      setSubmitting(true);
      const trimmedContent = content.trim();
      setSentence(trimmedContent);

      const prompt = getGrammarCorrectionPrompt(trimmedContent, languageModel);
      const jsonData = await aiProviderManager.generateContentWithJson(
        prompt,
        true,
        'data'
      );

      if (jsonData && jsonData.data) {
        setGrammarCorrection(jsonData);
        let a = getGrammarOriginalToAnnotation(jsonData);
        setOriginalAnnotation(a);

        a = getGrammarCorrectedToAnnotation(jsonData);
        setCorrectedAnnotation(a);

        let c = '';
        jsonData.data.forEach((item) => {
          c += `${item['correct-sentence']} `;
        });
        setCorrected(c);

        const cc = [];
        jsonData.data.forEach((item, index) => {
          item.explanations.forEach((item2, index2) => {
            cc.push({ ...item2, id: `${index}-${index2}` });
          });
        });
        setGrammarCorrectionList(cc);

        // Add to history
        setHistory((prev) => [
          {
            id: Date.now(),
            text: trimmedContent,
            errorCount: cc.length,
            timestamp: new Date(),
          },
          ...prev.slice(0, 9),
        ]);

        // Scroll to results
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
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

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setContent(text);
    } catch (err) {
      showMessage('Failed to paste from clipboard', 'error');
    }
  };

  const handleHistoryClick = (item) => {
    setContent(item.text);
  };

  const handleDeleteHistory = (id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const errorCount = grammarCorrectionList.length;
  const hasResults = grammarCorrection !== null;
  const isSuccess = hasResults && errorCount === 0;

  const languageOptions = [
    { value: LanguageModel.English, label: 'English', flag: '🇬🇧' },
    { value: LanguageModel.Chinese, label: '中文', flag: '🇨🇳' },
    { value: LanguageModel.Japanese, label: '日本語', flag: '🇯🇵' },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        position: 'relative',
        bgcolor: theme.palette.background.default,
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
              <SpellcheckIcon sx={{ color: theme.palette.primary.main }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Grammar Check
            </Typography>
          </Box>

          {/* Language Selection */}
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
            }}
          >
            Explanation Language
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {languageOptions.map((lang) => (
              <LanguageChip
                key={lang.value}
                label={`${lang.flag} ${lang.label}`}
                selected={languageModel === lang.value}
                onClick={() => setLanguageModel(lang.value)}
              />
            ))}
          </Box>
        </SidebarSection>

        {/* Quick Tips */}
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
            Tips
          </Typography>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.warning.main, 0.08),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TipsAndUpdatesIcon
                sx={{ fontSize: 18, color: theme.palette.warning.main }}
              />
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: theme.palette.warning.dark }}
              >
                Pro Tip
              </Typography>
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ lineHeight: 1.5 }}
            >
              Paste or type your text, then click the check button. The AI will
              identify grammar errors and explain corrections in your chosen
              language.
            </Typography>
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
            Recent Checks
          </Typography>

          {history.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 4,
                color: theme.palette.text.disabled,
              }}
            >
              <HistoryIcon sx={{ fontSize: 32, opacity: 0.5, mb: 1 }} />
              <Typography variant="body2">No history yet</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {history.map((item) => (
                <Box
                  key={item.id}
                  onClick={() => handleHistoryClick(item)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '& .delete-btn': { opacity: 1 },
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor:
                        item.errorCount === 0
                          ? alpha(theme.palette.success.main, 0.15)
                          : alpha(theme.palette.error.main, 0.15),
                      flexShrink: 0,
                    }}
                  >
                    {item.errorCount === 0 ? (
                      <CheckCircleOutlineIcon
                        sx={{
                          fontSize: 14,
                          color: theme.palette.success.main,
                        }}
                      />
                    ) : (
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: theme.palette.error.main,
                          fontSize: '0.65rem',
                        }}
                      >
                        {item.errorCount}
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '0.8rem',
                    }}
                  >
                    {item.text}
                  </Typography>
                  <IconButton
                    size="small"
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteHistory(item.id);
                    }}
                    sx={{
                      opacity: 0,
                      transition: 'opacity 0.15s',
                      p: 0.5,
                    }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
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
        <KeyboardArrowDownIcon
          sx={{
            fontSize: 16,
            transform: sidebarCollapsed ? 'rotate(-90deg)' : 'rotate(90deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </IconButton>

      {/* Main Content */}
      <Box
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
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
            flexShrink: 0,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Check Your Writing
            </Typography>
            <Typography variant="body2" color="text.secondary">
              AI-powered grammar and spelling analysis
            </Typography>
          </Box>

          {hasResults && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <StatsCard>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isSuccess
                      ? alpha(theme.palette.success.main, 0.15)
                      : alpha(theme.palette.error.main, 0.15),
                  }}
                >
                  {isSuccess ? (
                    <CheckCircleOutlineIcon
                      sx={{ color: theme.palette.success.main }}
                    />
                  ) : (
                    <ErrorOutlineIcon sx={{ color: theme.palette.error.main }} />
                  )}
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {isSuccess ? 'Perfect!' : `${errorCount} Issue${errorCount > 1 ? 's' : ''}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isSuccess ? 'No errors found' : 'Found in your text'}
                  </Typography>
                </Box>
              </StatsCard>
            </Box>
          )}
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            px: 3,
            py: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.5),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            flexShrink: 0,
          }}
        >
          <InputContainer>
            <InputBase
              ref={inputRef}
              multiline
              minRows={3}
              maxRows={6}
              placeholder="Type or paste your English text here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              sx={{
                p: 2,
                fontSize: '1rem',
                lineHeight: 1.6,
                '& textarea': {
                  '&::placeholder': {
                    color: theme.palette.text.disabled,
                    opacity: 1,
                  },
                },
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.ctrlKey) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <Divider />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 1,
                bgcolor: alpha(theme.palette.background.default, 0.5),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Paste from clipboard">
                  <IconButton size="small" onClick={handlePaste}>
                    <ContentPasteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clear text">
                  <IconButton
                    size="small"
                    onClick={() => setContent('')}
                    disabled={!content}
                  >
                    <ClearIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Typography variant="caption" color="text.disabled">
                  {content.length} characters
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ mr: 1 }}
                >
                  Ctrl + Enter to check
                </Typography>
                <Tooltip title="Check Grammar">
                  <Box
                    component="button"
                    onClick={submit}
                    disabled={submitting || !content.trim()}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      border: 'none',
                      borderRadius: 1.5,
                      bgcolor: theme.palette.primary.main,
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: submitting || !content.trim() ? 0.6 : 1,
                      '&:hover': {
                        bgcolor: theme.palette.primary.dark,
                        transform: 'translateY(-1px)',
                      },
                      '&:active': {
                        transform: 'translateY(0)',
                      },
                      '&:disabled': {
                        cursor: 'not-allowed',
                      },
                    }}
                  >
                    {submitting ? (
                      <>
                        <CircularProgress size={16} sx={{ color: '#fff' }} />
                        Checking...
                      </>
                    ) : (
                      <>
                        <AutoFixHighIcon sx={{ fontSize: 18 }} />
                        Check Grammar
                      </>
                    )}
                  </Box>
                </Tooltip>
              </Box>
            </Box>
            {submitting && (
              <LinearProgress
                sx={{
                  height: 2,
                  '& .MuiLinearProgress-bar': {
                    bgcolor: theme.palette.primary.main,
                  },
                }}
              />
            )}
          </InputContainer>
        </Box>

        {/* Results Area */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 3,
          }}
        >
          {!hasResults && !submitting && (
            <EmptyState
              icon={SpellcheckIcon}
              title="Ready to Check"
              subtitle="Enter your text above and click 'Check Grammar' to get AI-powered grammar corrections with detailed explanations."
            />
          )}

          {submitting && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '50vh',
                gap: 2,
              }}
            >
              <CircularProgress size={48} />
              <Typography variant="body1" color="text.secondary">
                Analyzing your text...
              </Typography>
            </Box>
          )}

          {hasResults && (
            <Fade in={hasResults}>
              <Box
                ref={resultsRef}
                sx={{ maxWidth: 900, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                {/* Original vs Corrected comparison */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                    gap: 2,
                  }}
                >
                  <AnnotationDisplay
                    content={sentence}
                    annotations={originalAnnotation}
                    label="Original Text"
                    type="original"
                  />
                  <AnnotationDisplay
                    content={corrected}
                    annotations={correctedAnnotation}
                    label="Corrected Text"
                    type="corrected"
                  />
                </Box>

                {/* Success State */}
                {isSuccess && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      p: 4,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.success.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                    }}
                  >
                    <CheckCircleOutlineIcon
                      sx={{ fontSize: 48, color: theme.palette.success.main }}
                    />
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 600, color: theme.palette.success.main }}
                      >
                        Excellent Writing!
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        No grammar or spelling errors were found in your text.
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Error Cards */}
                {!isSuccess && (
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        mb: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <LightbulbIcon
                        sx={{ fontSize: 20, color: theme.palette.warning.main }}
                      />
                      Detailed Explanations
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {grammarCorrection &&
                        grammarCorrection.data.map((item, index) =>
                          item.explanations.map((item2, index2) => (
                            <CorrectionCard
                              key={`${index}-${index2}`}
                              type={item2.type}
                              originalSentence={item['original-sentence']}
                              correctedSentence={item['correct-sentence']}
                              original={item2.original}
                              corrected={item2.corrected}
                              explain={item2.explain}
                              example={item2['similar-examples']}
                              language={languageModel}
                            />
                          ))
                        )}
                    </Box>
                  </Box>
                )}
              </Box>
            </Fade>
          )}
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
          variant="filled"
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default GrammarMainPage;
