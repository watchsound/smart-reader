/* eslint-disable jsx-a11y/no-static-element-interactions */
import { useMemo, useEffect, useState, useCallback } from 'react';
import { styled, useTheme, alpha } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Fade from '@mui/material/Fade';
import { deepOrange, deepPurple, green, blue, purple } from '@mui/material/colors';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import PasswordIcon from '@mui/icons-material/Password';
import QuizIcon from '@mui/icons-material/Quiz';
import CoPresentIcon from '@mui/icons-material/CoPresent';
import PersonIcon from '@mui/icons-material/Person';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SummarizeIcon from '@mui/icons-material/Summarize';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import 'highlight.js/styles/github.css'; // Import the desired highlight.js CSS style
// import OpenAI from 'openai';
import { v4 as uuid } from 'uuid';
import { debounce } from 'lodash';
import { Message } from '../../../commons/model/chat';
import CreatePromptModal from './CreatePromptModal';
import { LogoIcon } from './Logo';
import ScrollIntoView from './ScrollIntoView';
import CopyToClipboardButton from './CopyToClipboardButton';
import CreateNoteModal from './CreateNoteModal';
import parseMarkdownToHtml, {
  parseMarkdownToHtmlNoCallback,
} from '../note/NoteUtil';
import { StudyMode } from '../../../commons/model/DataTypes';
import { NoteType } from '../../../commons/model/Note';
import customStorage from '../../store/customStorage';
import { getQuizChatHistoryPrompt } from '../../../commons/utils/AIPrompts';
import { generateImpressHTML } from '../impressjs';
import ImpressModal from '../impressjs/ImpressModal';
import QuizModal from '../surveyjs/QuizModal';
import { QuizProblem } from '../../../commons/model/Quiz';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import RichTextActionMenu from '../richtext/RichTextActionMenu';
import RichTextCard from '../richtext/RichTextCard';
import skillApi from '../../api/skillApi';
import SmartSummaryModal from './SmartSummaryModal';

// Color palette matching BookmarkUI style
const MESSAGE_COLORS = {
  user: { bg: '#2196F3', accent: '#1976D2', icon: '#fff' },
  assistant: { bg: '#F5F5F5', accent: '#4CAF50', icon: '#2E7D32' },
};

const MESSAGE_COLORS_DARK = {
  user: { bg: '#1976D2', accent: '#1565C0', icon: '#fff' },
  assistant: { bg: '#2D2D2D', accent: '#4CAF50', icon: '#81C784' },
};

// Container for message layout
const MessageContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isUser' && prop !== 'colors',
})<{ isUser?: boolean; colors?: any }>(({ theme, isUser }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: isUser ? 'flex-end' : 'flex-start',
  maxWidth: '100%',
  marginBottom: theme.spacing(2),
}));

// User message - pill/chip style like LearnAbout
const UserMessageChip = styled(Box)(({ theme }) => ({
  maxWidth: '80%',
  padding: theme.spacing(1.25, 2.5),
  borderRadius: '20px 20px 4px 20px',
  backgroundColor: theme.palette.primary.main,
  color: '#fff',
  fontWeight: 500,
  fontSize: '0.925rem',
  lineHeight: 1.5,
  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`,
    transform: 'translateY(-1px)',
  },
}));

// Assistant message - card style with left accent
const AssistantMessageBubble = styled(Box)(({ theme }) => ({
  position: 'relative',
  maxWidth: '90%',
  padding: theme.spacing(2, 2.5),
  paddingLeft: theme.spacing(3),
  borderRadius: 16,
  backgroundColor: theme.palette.mode === 'dark' ? '#2D2D2D' : '#FAFAFA',
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    boxShadow: theme.palette.mode === 'dark'
      ? `0 4px 20px ${alpha('#000', 0.4)}`
      : `0 4px 20px ${alpha('#000', 0.06)}`,
  },
  // Left accent stripe
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    backgroundColor: theme.palette.success.main,
    borderRadius: 2,
  },
}));

// Small label above message
const MessageLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: theme.spacing(0.5),
  color: theme.palette.text.disabled,
}));

const AvatarBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colors',
})<{ colors?: any }>(({ theme, colors }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(colors?.accent || '#2196F3', 0.15),
  flexShrink: 0,
}));

const ActionBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: theme.spacing(1.5),
  paddingTop: theme.spacing(1),
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  opacity: 0,
  transition: 'opacity 0.2s ease',
  '.message-bubble:hover &': {
    opacity: 1,
  },
}));

// Pill-style action toolbar container
const ActionToolbar = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  padding: '4px 6px',
  borderRadius: 20,
  backgroundColor: alpha(theme.palette.background.default, 0.8),
  border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
  backdropFilter: 'blur(8px)',
}));

// Unified action button with consistent sizing
const ActionButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'accentColor',
})<{ accentColor?: string }>(({ theme, accentColor }) => ({
  width: 30,
  height: 30,
  borderRadius: 8,
  transition: 'all 0.15s ease-in-out',
  '& .MuiSvgIcon-root': {
    fontSize: 16,
  },
  '&:hover': {
    backgroundColor: alpha(accentColor || theme.palette.primary.main, 0.12),
    color: accentColor || theme.palette.primary.main,
    transform: 'scale(1.08)',
  },
  '&.Mui-disabled': {
    opacity: 0.5,
  },
}));

// Divider between action groups
const ActionDivider = styled(Box)(({ theme }) => ({
  width: 1,
  height: 20,
  backgroundColor: alpha(theme.palette.divider, 0.2),
  margin: '0 4px',
}));

const WordCountChip = styled(Chip)(({ theme }) => ({
  height: 20,
  fontSize: '0.65rem',
  fontWeight: 500,
  backgroundColor: alpha(theme.palette.text.secondary, 0.08),
  color: theme.palette.text.secondary,
  '& .MuiChip-label': {
    padding: '0 8px',
  },
}));

// Floating summary panel for in-situ smart summary
const FloatingSummaryPanel = styled(Box)(({ theme }) => ({
  position: 'relative',
  marginTop: theme.spacing(2),
  padding: theme.spacing(2),
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.info.main, 0.08),
  border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: theme.palette.info.main,
    borderRadius: '12px 0 0 12px',
  },
}));

const SummaryHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(1.5),
  paddingBottom: theme.spacing(1),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
}));

const SummaryActions = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));


function MessageItem({ message }: { message: Message }) {
  const [htmlCode, setHtmlCode] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [showImpressModal, setShowImpressModal] = useState(false);
  const [impressContent, setImpressContent] = useState<string | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizProblems, setQuizProblems] = useState<QuizProblem[]>([]);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false);
  const [emphasis, setEmphasis] = useState('');
  const [entry, setEntry] = useState('');
  const [wordCount, setWordCount] = useState(0);
  // Smart Summary state (modal version)
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summarySourceText, setSummarySourceText] = useState('');
  const [summaryResult, setSummaryResult] = useState<{
    summary: string;
    words: string[];
    vocabularyUsed: string[];
    sourceWordCount: number;
    summaryWordCount: number;
  } | null>(null);

  // In-situ Smart Summary state (flying words version)
  const [showInSituSummary, setShowInSituSummary] = useState(false);
  const [isInSituSummarizing, setIsInSituSummarizing] = useState(false);
  const [inSituSummaryResult, setInSituSummaryResult] = useState<{
    summary: string;
    words: string[];
    vocabularyUsed: string[];
  } | null>(null);
  const [sourceTokens, setSourceTokens] = useState<any[]>([]);
  const [summaryTokens, setSummaryTokens] = useState<any[]>([]);
  const [sourceParentLoc, setSourceParentLoc] = useState({ top: 0, left: 0 });
  const [summaryParentLoc, setSummaryParentLoc] = useState({ top: 0, left: 0 });
  const [animationTriggered, setAnimationTriggered] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // const wordCount = useMemo(() => {
  //   const matches = message.content.match(/[\w\d\’\'-\(\)]+/gi);
  //   return matches ? matches.length : 0;
  // }, [message.content]);

  // const openai = useMemo(() => {
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  // useEffect(() => {
  //   async function t() {
  //     const id = await customStorage.getOpenAIKey();
  //     setApiKey(id);
  //     const m = await customStorage.getChatGPTModel();
  //     setModel(m);
  //   }
  //   t();
  // }, []);

  const handleMouseUp = () => {
    const s = window.getSelection() || '';
    const text = s.toString();
    setSelectedText(text);
  };
  const addToKeyWordList = async () => {
    if (!selectedText) return;
    const studyMode = (await customStorage.getStudyMode()) || StudyMode.General;
    customStorage.addToKeyWordList(studyMode, selectedText);
  };

  const createQuiz = async () => {
    const v = selectedText || message.content;
    if (!v || v.length < 10) return;

    setIsCreatingQuiz(true);
    try {
      const newPrompt = getQuizChatHistoryPrompt(v);
      const quizJson = await aiProviderManager.sendChatMessage(
        newPrompt,
        '',
        {},
        true,
      );
      if (quizJson && quizJson.quiz && quizJson.quiz.length > 0) {
        const problems: QuizProblem[] = [];
        for (let i = 0; i < quizJson.quiz.length; i++) {
          const quizProblem = quizJson.quiz[i];
          if (quizProblem) {
            quizProblem.sourceKey = message.id;
            quizProblem.sourceType = 'chat';
            quizProblem.id = uuid();
            quizProblem.correct = false;
            customStorage.createQuizProblem(quizProblem);
            problems.push(quizProblem);
          }
        }
        // Show quiz modal with the generated problems
        setQuizProblems(problems);
        setShowQuizModal(true);
      }
    } catch (error) {
      console.error('Error creating quiz:', error);
    } finally {
      setIsCreatingQuiz(false);
    }
  };
  const maybeKeywords = () => {
    if (!selectedText) return false;
    const p0 = selectedText.indexOf(' ');
    if (p0 < 0) return true;
    const p1 = selectedText.indexOf(' ', p0 + 2);
    if (p1 < 0) return true;
    const p2 = selectedText.indexOf(' ', p1 + 2);
    if (p2 < 0) return true;
    return false;
  };

  const openPresentation = async () => {
    const content = selectedText || message.content;
    const html = await generateImpressHTML({ paragraph: content });
    if (html) {
      setImpressContent(html);
      setShowImpressModal(true);
    }
  };

  const createSmartSummary = async () => {
    const content = selectedText || message.content;
    if (!content || content.length < 20) return;

    // Open modal immediately and start loading
    setSummarySourceText(content);
    setShowSummaryModal(true);
    setIsSummarizing(true);
    setSummaryResult(null);

    try {
      // Get user's vocabulary words for context
      const studyMode = (await customStorage.getStudyMode()) || StudyMode.General;
      const keywordList = customStorage.getKeyWordList(studyMode);
      // keywordList is already an array from the IPC call
      const vocabularyWords = Array.isArray(keywordList) ? keywordList.filter((w: string) => w && w.trim()) : [];

      const result = await skillApi.executeSkill('smart_summary', {
        text: content,
        vocabularyWords,
        maxWords: 30,
      });

      if (result.success && result.result) {
        setSummaryResult(result.result);
      } else {
        console.error('Smart summary failed:', result.error);
        setShowSummaryModal(false);
      }
    } catch (error) {
      console.error('Error creating smart summary:', error);
      setShowSummaryModal(false);
    } finally {
      setIsSummarizing(false);
    }
  };

  const closeSummaryModal = () => {
    setShowSummaryModal(false);
    setSummaryResult(null);
    setSummarySourceText('');
  };

  const handleSaveSummaryAsNote = async (summary: string) => {
    // Create a note from the summary
    try {
      await customStorage.createNote({
        content: summary,
        sourceType: NoteType.Chat,
        sourceKey: message.id,
        title: 'Smart Summary',
      });
    } catch (error) {
      console.error('Error saving summary as note:', error);
    }
  };

  // In-situ Smart Summary with flying words
  const createInSituSummary = async () => {
    const content = selectedText || message.content;
    if (!content || content.length < 20) return;

    // Activate RichTextCard mode to capture tokens
    setShowInSituSummary(true);
    setIsInSituSummarizing(true);
    setInSituSummaryResult(null);
    setAnimationTriggered(false);
    setNoteSaved(false);

    try {
      // Get user's vocabulary words for context
      const studyMode = (await customStorage.getStudyMode()) || StudyMode.General;
      const keywordList = customStorage.getKeyWordList(studyMode);
      const vocabularyWords = Array.isArray(keywordList) ? keywordList.filter((w: string) => w && w.trim()) : [];

      const result = await skillApi.executeSkill('smart_summary', {
        text: content,
        vocabularyWords,
        maxWords: 30,
      });

      if (result.success && result.result) {
        setInSituSummaryResult(result.result);
      } else {
        console.error('In-situ smart summary failed:', result.error);
        setShowInSituSummary(false);
      }
    } catch (error) {
      console.error('Error creating in-situ smart summary:', error);
      setShowInSituSummary(false);
    } finally {
      setIsInSituSummarizing(false);
    }
  };

  const closeInSituSummary = () => {
    setShowInSituSummary(false);
    setInSituSummaryResult(null);
    setSourceTokens([]);
    setSummaryTokens([]);
    setAnimationTriggered(false);
    setNoteSaved(false);
  };

  const handleSourceTokens = useCallback((data: { parentLoc: { top: number; left: number }; tokens: any[] }) => {
    setSourceParentLoc(data.parentLoc);
    setSourceTokens(data.tokens);
  }, []);

  const handleSummaryTokens = useCallback((data: { parentLoc: { top: number; left: number }; tokens: any[] }) => {
    setSummaryParentLoc(data.parentLoc);
    setSummaryTokens(data.tokens);
  }, []);

  // Custom flying animation that works across containers using fixed positioning
  const flyWordsToSummary = useCallback(() => {
    if (sourceTokens.length === 0 || summaryTokens.length === 0) return;

    // Build a map of summary words to their target positions
    const summaryWordMap: { [key: string]: { top: number; left: number; used: boolean }[] } = {};
    summaryTokens.forEach((token) => {
      const word = token.text.toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (!summaryWordMap[word]) {
        summaryWordMap[word] = [];
      }
      // Get the actual viewport position of the summary token element
      if (token.el) {
        const rect = token.el.getBoundingClientRect();
        summaryWordMap[word].push({ top: rect.top, left: rect.left, used: false });
      }
    });

    // For each source token, if it matches a summary word, create a flying clone
    const flyingClones: HTMLElement[] = [];
    let animationDelay = 0;

    sourceTokens.forEach((sourceToken) => {
      const word = sourceToken.text.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const targets = summaryWordMap[word];

      if (targets) {
        // Find an unused target
        const target = targets.find((t) => !t.used);
        if (target && sourceToken.el) {
          target.used = true;

          // Get source position in viewport
          const sourceRect = sourceToken.el.getBoundingClientRect();

          // Create a flying clone at document body level
          const flyingClone = document.createElement('span');
          flyingClone.textContent = sourceToken.text;
          flyingClone.style.cssText = `
            position: fixed;
            top: ${sourceRect.top}px;
            left: ${sourceRect.left}px;
            font-size: inherit;
            font-family: inherit;
            color: #1976d2;
            text-shadow: 0 0 8px rgba(33, 150, 243, 0.8), 0 0 16px rgba(33, 150, 243, 0.4);
            z-index: 10000;
            pointer-events: none;
            transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            opacity: 1;
          `;
          document.body.appendChild(flyingClone);
          flyingClones.push(flyingClone);

          // Dim the source word
          sourceToken.el.style.opacity = '0.3';

          // Trigger the animation after a staggered delay
          setTimeout(() => {
            flyingClone.style.top = `${target.top}px`;
            flyingClone.style.left = `${target.left}px`;
            flyingClone.style.textShadow = 'none';
            flyingClone.style.color = 'inherit';
          }, animationDelay);

          animationDelay += 50; // Stagger each word by 50ms
        }
      }
    });

    // Clean up flying clones after animation completes
    setTimeout(() => {
      flyingClones.forEach((clone) => {
        clone.style.opacity = '0';
        setTimeout(() => clone.remove(), 300);
      });
      // Restore source word opacity
      sourceTokens.forEach((token) => {
        if (token.el) {
          token.el.style.opacity = '1';
        }
      });
      console.log('Flying animation complete');
    }, animationDelay + 1000);
  }, [sourceTokens, summaryTokens]);

  // Trigger flying animation when both source and summary tokens are ready
  useEffect(() => {
    if (
      showInSituSummary &&
      inSituSummaryResult &&
      sourceTokens.length > 0 &&
      summaryTokens.length > 0 &&
      !animationTriggered
    ) {
      setAnimationTriggered(true);
      // Delay to ensure DOM is ready
      setTimeout(() => {
        flyWordsToSummary();
      }, 200);
    }
  }, [showInSituSummary, inSituSummaryResult, sourceTokens, summaryTokens, animationTriggered, flyWordsToSummary]);

  const saveInSituSummaryAsNote = async () => {
    if (!inSituSummaryResult) return;
    try {
      await customStorage.createNote({
        content: inSituSummaryResult.summary,
        sourceType: NoteType.Chat,
        sourceKey: message.id,
        title: 'Smart Summary',
      });
      setNoteSaved(true);
    } catch (error) {
      console.error('Error saving in-situ summary as note:', error);
    }
  };

  const debouncedFilter = useCallback(
    debounce(() => {
      async function t() {
        console.log(` log it ${message.content}`);
        const html = await parseMarkdownToHtmlNoCallback(message.content);
        setHtmlCode(html);
        const matches = message.content.match(/[\w\d\’\'-\(\)]+/gi);
        setWordCount(matches ? matches.length : 0);
      }
      t();
    }, 500),
    [message.content],
  );

  useEffect(() => {
    if (!message.content) return;
    debouncedFilter();
  }, [message.content, debouncedFilter]);

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isUser = message.role === 'user';
  const colorPalette = isDark ? MESSAGE_COLORS_DARK : MESSAGE_COLORS;
  const colors = isUser ? colorPalette.user : colorPalette.assistant;
  const [showActions, setShowActions] = useState(false);

  return (
    <ScrollIntoView>
      <Fade in timeout={300}>
        <Box sx={{ mb: 2 }}>
          {/* USER MESSAGE - Simple pill/chip style */}
          {isUser && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
              }}
              onMouseEnter={() => setShowActions(true)}
              onMouseLeave={() => setShowActions(false)}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <UserMessageChip>
                  {message.content}
                </UserMessageChip>
                {/* User action bar - subtle */}
                {showActions && (
                  <Fade in={showActions}>
                    <Box sx={{ mt: 0.5 }}>
                      <ActionToolbar sx={{ py: 0.25, px: 1 }}>
                        <CreatePromptModal content={selectedText || message.content} />
                      </ActionToolbar>
                    </Box>
                  </Fade>
                )}
              </Box>
            </Box>
          )}

          {/* ASSISTANT MESSAGE - Rich card style with accent */}
          {!isUser && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                width: '100%',
              }}
              onMouseEnter={() => setShowActions(true)}
              onMouseLeave={() => setShowActions(false)}
            >
              {/* AI Avatar */}
              <AvatarBadge colors={colors}>
                <AutoAwesomeIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
              </AvatarBadge>

              {/* Message Content */}
              <AssistantMessageBubble className="message-bubble">
                {/* Message Body */}
                <Box>
                  {/* Normal view - no effects active */}
                  {!emphasis && !entry && !showInSituSummary && (
                    <Box
                      className="note__body"
                      sx={{
                        overflowX: 'auto',
                        fontSize: '0.925rem',
                        lineHeight: 1.7,
                        color: 'text.primary',
                        '& p': { margin: 0, marginBottom: 1 },
                        '& p:last-child': { marginBottom: 0 },
                        '& pre': {
                          borderRadius: 2,
                          padding: 1.5,
                          backgroundColor: alpha(theme.palette.common.black, isDark ? 0.3 : 0.05),
                          overflow: 'auto',
                        },
                        '& code': {
                          fontSize: '0.85em',
                          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        },
                        '& ul, & ol': {
                          paddingLeft: 2.5,
                          marginTop: 0.5,
                          marginBottom: 0.5,
                        },
                        '& li': { marginBottom: 0.25 },
                        '& a': {
                          color: theme.palette.primary.main,
                          textDecoration: 'none',
                          '&:hover': { textDecoration: 'underline' },
                        },
                      }}
                      onMouseUp={handleMouseUp}
                      dangerouslySetInnerHTML={{ __html: htmlCode }}
                    />
                  )}

                  {/* Animation effects mode (emphasis/entry) */}
                  {(emphasis !== '' || entry !== '') && !showInSituSummary && (
                    <RichTextCard
                      input={htmlCode}
                      isHtml
                      tokenCallback={() => {}}
                      showToken
                      entryEffect={entry}
                      emphasisEffect={emphasis}
                    />
                  )}

                  {/* In-situ Smart Summary mode - source tokens */}
                  {showInSituSummary && (
                    <>
                      <RichTextCard
                        input={htmlCode}
                        isHtml
                        tokenCallback={handleSourceTokens}
                        showToken
                        entryEffect=""
                        emphasisEffect=""
                      />

                      {/* Floating Summary Panel */}
                      <FloatingSummaryPanel>
                        <SummaryHeader>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BubbleChartIcon sx={{ fontSize: 18, color: 'info.main' }} />
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'info.main' }}>
                              Smart Summary
                            </Typography>
                            {isInSituSummarizing && (
                              <CircularProgress size={14} sx={{ ml: 1 }} />
                            )}
                          </Box>
                          <SummaryActions>
                            {inSituSummaryResult && (
                              <Tooltip title={noteSaved ? "Saved!" : "Save as Note"}>
                                <ActionButton
                                  size="small"
                                  onClick={saveInSituSummaryAsNote}
                                  accentColor={noteSaved ? '#4CAF50' : '#2196F3'}
                                  disabled={noteSaved}
                                >
                                  {noteSaved ? <CheckIcon /> : <SaveIcon />}
                                </ActionButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Close">
                              <ActionButton
                                size="small"
                                onClick={closeInSituSummary}
                                accentColor="#f44336"
                              >
                                <CloseIcon />
                              </ActionButton>
                            </Tooltip>
                          </SummaryActions>
                        </SummaryHeader>

                        {/* Summary content with RichTextCard for token tracking */}
                        {inSituSummaryResult ? (
                          <Box sx={{
                            '& .token': {
                              transition: 'all 0.5s ease-out',
                            }
                          }}>
                            <RichTextCard
                              input={inSituSummaryResult.summary}
                              isHtml={false}
                              tokenCallback={handleSummaryTokens}
                              showToken
                              entryEffect=""
                              emphasisEffect=""
                            />
                            {inSituSummaryResult.vocabularyUsed.length > 0 && (
                              <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', mr: 0.5 }}>
                                  Vocabulary used:
                                </Typography>
                                {inSituSummaryResult.vocabularyUsed.map((word, idx) => (
                                  <Chip
                                    key={idx}
                                    label={word}
                                    size="small"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      backgroundColor: alpha('#FFD700', 0.2),
                                      color: '#B8860B',
                                      '& .MuiChip-label': { px: 1 },
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Box sx={{ py: 2, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Generating summary...
                            </Typography>
                          </Box>
                        )}
                      </FloatingSummaryPanel>
                    </>
                  )}
                </Box>

                {/* Action Bar for Assistant */}
                <ActionBar sx={{ opacity: showActions ? 1 : 0 }}>
                  {wordCount > 0 && (
                    <WordCountChip
                      size="small"
                      label={`${wordCount} words`}
                    />
                  )}

                  <Box sx={{ flex: 1 }} />

                  <ActionToolbar>
                    {/* Copy Action */}
                    <CopyToClipboardButton content={selectedText || message.content} />

                    {/* Smart Summary Actions */}
                    {(selectedText || message.content).length > 30 && (
                      <>
                        <ActionDivider />
                        <Tooltip title="Smart Summary (Modal)">
                          <ActionButton
                            size="small"
                            onClick={createSmartSummary}
                            aria-label="smart summary modal"
                            accentColor="#00BCD4"
                          >
                            <SummarizeIcon />
                          </ActionButton>
                        </Tooltip>
                        <Tooltip title={isInSituSummarizing ? "Generating..." : "Smart Summary (In-situ)"}>
                          <span>
                            <ActionButton
                              size="small"
                              onClick={createInSituSummary}
                              aria-label="smart summary in-situ"
                              accentColor="#9C27B0"
                              disabled={isInSituSummarizing || showInSituSummary}
                            >
                              {isInSituSummarizing ? (
                                <CircularProgress size={14} color="inherit" />
                              ) : (
                                <BubbleChartIcon />
                              )}
                            </ActionButton>
                          </span>
                        </Tooltip>
                      </>
                    )}

                    {/* Presentation Action */}
                    {(selectedText || message.content).length > 50 && (
                      <Tooltip title="Presentation">
                        <ActionButton
                          size="small"
                          onClick={openPresentation}
                          aria-label="presentation"
                          accentColor="#9C27B0"
                        >
                          <CoPresentIcon />
                        </ActionButton>
                      </Tooltip>
                    )}

                    {/* Quiz Action */}
                    <Tooltip title={isCreatingQuiz ? "Generating Quiz..." : "Create Quiz"}>
                      <span>
                        <ActionButton
                          size="small"
                          onClick={() => createQuiz()}
                          aria-label="create quiz"
                          disabled={isCreatingQuiz}
                          accentColor="#FF9800"
                        >
                          {isCreatingQuiz ? (
                            <CircularProgress size={14} color="inherit" />
                          ) : (
                            <QuizIcon />
                          )}
                        </ActionButton>
                      </span>
                    </Tooltip>

                    <ActionDivider />

                    {/* Animation Effects */}
                    <RichTextActionMenu
                      asIconButton
                      emphasisCallback={setEmphasis}
                      entryCallback={setEntry}
                    />

                    {/* Save Note Action */}
                    <CreateNoteModal
                      sourceType={NoteType.Chat}
                      sourceKey={message.id}
                      content={selectedText || message.content}
                      imageData=""
                      cfi=""
                      url=""
                      emoji=""
                      color=""
                      highlightType=""
                      showButton
                      openDialog={false}
                    />

                    {/* Add Keyword Action */}
                    {maybeKeywords() && (
                      <>
                        <ActionDivider />
                        <Tooltip title="Add To Keyword List">
                          <ActionButton
                            size="small"
                            onClick={() => addToKeyWordList()}
                            aria-label="add keyword"
                            accentColor="#4CAF50"
                          >
                            <PasswordIcon />
                          </ActionButton>
                        </Tooltip>
                      </>
                    )}
                  </ActionToolbar>
                </ActionBar>
              </AssistantMessageBubble>
            </Box>
          )}

          {/* Impress.js Presentation Modal */}
          <ImpressModal
            open={showImpressModal}
            onClose={() => {
              setShowImpressModal(false);
              setImpressContent(null);
            }}
            htmlContent={impressContent}
          />

          {/* Quiz Modal */}
          <QuizModal
            open={showQuizModal}
            quizProblems={quizProblems}
            callback={() => {
              setShowQuizModal(false);
              setQuizProblems([]);
            }}
          />

          {/* Smart Summary Modal */}
          <SmartSummaryModal
            open={showSummaryModal}
            onClose={closeSummaryModal}
            sourceText={summarySourceText}
            summaryResult={summaryResult}
            isLoading={isSummarizing}
            onSave={handleSaveSummaryAsNote}
          />
        </Box>
      </Fade>
    </ScrollIntoView>
  );
}

export default MessageItem;
