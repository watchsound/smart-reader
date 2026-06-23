/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Box,
  Card,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Snackbar,
  IconButton,
  Chip,
  Collapse,
  Fade,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Paper from '@mui/material/Paper';
import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import SendIcon from '@mui/icons-material/Send';
import SendAndArchiveIcon from '@mui/icons-material/SendAndArchive';
// import OpenAI from 'openai';
import { useSelector, useDispatch } from 'react-redux';
import Tooltip from '@mui/material/Tooltip';
import ButtonGroup from '@mui/material/ButtonGroup';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import Avatar from '@mui/material/Avatar';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import JSON5 from 'json5';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TuneIcon from '@mui/icons-material/Tune';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorageIcon from '@mui/icons-material/Storage';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CloseIcon from '@mui/icons-material/Close';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import BrushIcon from '@mui/icons-material/Brush';
import ArticleIcon from '@mui/icons-material/Article';
import BuildIcon from '@mui/icons-material/Build';
import SummarizeIcon from '@mui/icons-material/Summarize';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import QuizIcon from '@mui/icons-material/Quiz';
import SearchIcon from '@mui/icons-material/Search';
import TranslateIcon from '@mui/icons-material/Translate';
import PsychologyIcon from '@mui/icons-material/Psychology';

import customStorage from '../../store/customStorage';
import MessageItem from '../../components/chat/MessageItem';
import parseMarkdownToHtml from '../../components/note/NoteUtil';
import {
  getMessagesByChatId,
  getChatById,
  createMessage,
  updateMessage,
  updateChat,
  createChat,
} from '../../api/chatApi';
import SmallButton from '../../components/Button/SmallButton';

import { chatHandled, chatAdded, messageUpdated, messageAdded, messageHandled, messageQueried, chatUpdated } from '../../store/reducers/chatSlice';
import { stripJsonWrap } from '../../../commons/utils/commonUtil';
import { mapToNewJsonSchema, createReaderLevelPrompt } from '../../../commons/utils/AIPrompts';
import JsonSchemaManager from '../../utils/json/JsonSchemaManager';
import mindMapSchema, {mindMapSchema0} from '../../utils/json/mindmapSchema';
import { convertToReactFlow, convertToReactFlow0 } from '../../../commons/utils/content/mindmapUtil';
import MindmapSurface from '../../components/mindmap/MindmapSurface';
import { AIProvider, StudyMode } from '../../../commons/model/DataTypes';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import StringPicker from '../../components/Picker/StringPicker';
import promptSettingList, { None } from '../../constants/promptSettingList';
import skillApi from '../../api/skillApi';
import SlashCommandMenu from '../../components/chat/SlashCommandMenu';
import spineApi from '../../api/spineApi';

// Color palette for AI Assistant (matching BookmarkUI style)
const ASSISTANT_COLORS = {
  primary: { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },    // Green - Success/AI
  secondary: { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },  // Blue - User
  accent: { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },     // Purple - Special
  warning: { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' },    // Amber - Local Data
};

const ASSISTANT_COLORS_DARK = {
  primary: { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  secondary: { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  accent: { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  warning: { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
};

// Writing Settings color palette (each category has its own color)
const SETTINGS_COLORS = {
  character: { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },  // Green
  tone: { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },       // Blue
  style: { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' },      // Orange
  format: { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },     // Purple
};

const SETTINGS_COLORS_DARK = {
  character: { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  tone: { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  style: { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  format: { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
};

// Styled components for modern UI
const StyledInputArea = styled(Box)(({ theme }) => ({
  position: 'relative',
  borderRadius: 16,
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.8)
    : theme.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.3),
    boxShadow: theme.palette.mode === 'dark'
      ? `0 4px 20px ${alpha('#000', 0.3)}`
      : `0 4px 20px ${alpha('#000', 0.08)}`,
  },
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
}));

const ActionButton = styled(IconButton)(({ theme, color = 'primary' }) => ({
  width: 40,
  height: 40,
  borderRadius: 12,
  backgroundColor: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1),
  color: theme.palette[color]?.main || theme.palette.primary.main,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.2),
    transform: 'scale(1.05)',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
  '&.Mui-disabled': {
    backgroundColor: alpha(theme.palette.action.disabled, 0.1),
    color: theme.palette.action.disabled,
  },
}));

const SettingsChip = styled(Chip)(({ theme, active }) => ({
  borderRadius: 8,
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: active
    ? alpha(theme.palette.primary.main, 0.15)
    : alpha(theme.palette.divider, 0.5),
  color: active ? theme.palette.primary.main : theme.palette.text.secondary,
  border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.3) : 'transparent'}`,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
  },
}));

const WelcomeCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(6),
  textAlign: 'center',
  minHeight: 300,
}));

// Settings Panel Styled Components
const SettingsPanel = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  borderRadius: 16,
  backgroundColor: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.default, 0.6)
    : alpha(theme.palette.background.default, 0.8),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  overflow: 'hidden',
}));

const SettingsHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
}));

const SettingsCategoryBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'categoryColor',
})(({ theme, categoryColor }) => ({
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
    backgroundColor: categoryColor || theme.palette.primary.main,
  },
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const CategoryLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

const OptionChipsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.75),
  maxHeight: 80,
  overflowY: 'auto',
  paddingRight: theme.spacing(0.5),
  '&::-webkit-scrollbar': {
    width: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
    borderRadius: 2,
  },
}));

const OptionChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'chipColor',
})(({ theme, selected, chipColor }) => ({
  height: 26,
  fontSize: '0.72rem',
  fontWeight: selected ? 600 : 400,
  borderRadius: 13,
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',
  backgroundColor: selected
    ? alpha(chipColor || theme.palette.primary.main, 0.15)
    : 'transparent',
  color: selected
    ? chipColor || theme.palette.primary.main
    : theme.palette.text.secondary,
  border: `1px solid ${selected
    ? alpha(chipColor || theme.palette.primary.main, 0.4)
    : alpha(theme.palette.divider, 0.3)}`,
  '&:hover': {
    backgroundColor: alpha(chipColor || theme.palette.primary.main, 0.12),
    borderColor: alpha(chipColor || theme.palette.primary.main, 0.5),
    transform: 'translateY(-1px)',
  },
  '& .MuiChip-label': {
    padding: '0 10px',
  },
}));

// Skill Mode styled components
const SkillModeChip = styled(Chip)(({ theme, active }) => ({
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '0.7rem',
  height: '26px',
  backgroundColor: active ? alpha('#6366f1', 0.15) : 'transparent',
  color: active ? '#6366f1' : theme.palette.text.secondary,
  border: `1px solid ${active ? '#6366f1' : theme.palette.divider}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: alpha('#6366f1', 0.1),
    borderColor: '#6366f1',
  },
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: '14px',
  },
}));

const QuickActionChip = styled(Chip)(({ theme, chipcolor }) => ({
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  fontWeight: 500,
  fontSize: '0.7rem',
  height: '26px',
  backgroundColor: chipcolor ? alpha(chipcolor, 0.1) : alpha(theme.palette.primary.main, 0.08),
  color: chipcolor || theme.palette.primary.main,
  border: '1px solid transparent',
  '&:hover': {
    backgroundColor: chipcolor ? alpha(chipcolor, 0.18) : alpha(theme.palette.primary.main, 0.15),
    borderColor: chipcolor ? alpha(chipcolor, 0.4) : alpha(theme.palette.primary.main, 0.3),
    transform: 'translateY(-1px)',
  },
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: '14px',
  },
}));

const ToolUsageBadge = styled(Chip)(({ theme }) => ({
  height: '18px',
  fontSize: '0.6rem',
  fontWeight: 500,
  backgroundColor: alpha('#10b981', 0.12),
  color: '#10b981',
  border: `1px solid ${alpha('#10b981', 0.3)}`,
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: '12px',
  },
}));

const QuickActionsBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  padding: '8px 12px',
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  background: theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.default, 0.4)
    : alpha(theme.palette.background.default, 0.6),
}));

// Quick action definitions
const QUICK_ACTIONS = [
  { id: 'summarize', label: 'Summarize', icon: SummarizeIcon, color: '#3b82f6', skill: 'summarize' },
  { id: 'explain', label: 'Explain', icon: LightbulbIcon, color: '#f59e0b', skill: 'explain' },
  { id: 'grammar', label: 'Grammar', icon: SpellcheckIcon, color: '#10b981', skill: 'grammar_check' },
  { id: 'quiz', label: 'Quiz', icon: QuizIcon, color: '#8b5cf6', skill: 'quiz_generate' },
  { id: 'translate', label: 'Translate', icon: TranslateIcon, color: '#ec4899', skill: 'translate' },
  { id: 'search', label: 'My Notes', icon: SearchIcon, color: '#06b6d4', skill: 'search_notes' },
];

function ChatDetailPanel({ chatId }) {
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');
  // const [apiKey, setApiKey] = useState('');
  // const [model, setModel] = useState('');
  const [userMessages, setUserMessages] = useState([]);
  const [userMsgIndex, setUserMsgIndex] = useState(0);
  const [content, setContent] = useState('');
  const [imageData, setImageData] = useState('');
  const [multiline, setMultiline] = useState(false);

  // const [contentDraft, setContentDraft] = useState('');
  // const [responseContent, setResponseContent] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [, forceUpdate] = useState();
  const [chat, setChat] = useState();

  const [mindMapData, setMindMapData] = useState(null);
  const [mindMapDataLarge, setMindMapDataLarge] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [keywordExercisePrompt, setKeywordExercisePrompt] = useState('');
  const [readerLevelPrompt, setReaderLevelPrompt] = useState('');
  const [writingCharacter, setWritingCharacter] = useState(promptSettingList.writingCharacters[0]);
  const [writingTone, setWritingTone] = useState(promptSettingList.writingTones[0]);
  const [writingStyle, setWritingStyle] = useState(promptSettingList.writingStyles[0]);
  const [writingFormat, setWritingFormat] = useState(promptSettingList.writingFormats[0]);
  const [showSettings, setShowSettings] = useState(false);
  const dispatch = useDispatch();

  // Skill system state
  const [skillMode, setSkillMode] = useState(false);
  const [skillStatus, setSkillStatus] = useState({ initialized: false, skillCount: 0, supportsToolUse: false });
  const [availableSkills, setAvailableSkills] = useState([]);
  const [lastToolsUsed, setLastToolsUsed] = useState([]);

  // Slash command state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  // Quick actions visibility
  const [showQuickActions, setShowQuickActions] = useState(true);

  // Theme-related computed values
  const isDark = theme.palette.mode === 'dark';
  const colors = isDark ? ASSISTANT_COLORS_DARK : ASSISTANT_COLORS;
  const settingsColors = isDark ? SETTINGS_COLORS_DARK : SETTINGS_COLORS;

  const messages = useSelector((state) => state.chat.messages);
  const componentRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
      }
    });
    if (componentRef.current) {
      resizeObserver.observe(componentRef.current);
    }

    return () => {
      if (componentRef.current) {
        resizeObserver.unobserve(componentRef.current);
      }
    };
  }, []);



  const refresh = () => {
    forceUpdate(s => !s);
  };

  // const openai = useMemo(() => {
  //   // console.log(` openai-key3 = ${apiKey}`);
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  const jsonSchemaManager = useMemo(() => {
    const manager = new JsonSchemaManager();
    manager.registerSchema('mindMap', mindMapSchema);
    manager.registerSchema('mindMap0', mindMapSchema0);
    return manager;
  }, []);

  const tryToCustomizeUI = async (content) => {
    setMindMapData(null);
    if (!JsonSchemaManager.mayContainsJsonData(content)) return;
    let content0 = content.trim();
    let jsonData = '';
    content0 = stripJsonWrap(content0)
    if ( content0.startsWith('{') && content0.charAt(content0.length-1) === '}' )
       jsonData = JSON5.parse(content0);
    else
      jsonData = await aiProviderManager.extractJsonData(content0);
    if (!jsonData) return;
    const schemaName = jsonSchemaManager.findMatchSchema(jsonData);
    console.log(` matched schemaName =  ${schemaName}`);
    if (schemaName === 'mindMap') {
      const {nodes, edges} = convertToReactFlow(jsonData);
      if ( nodes && nodes.length > 0 && edges && edges.length > 0) {
        setMindMapData({width: size.width || 250,  height: 180, nodes, edges})
        setMindMapDataLarge({width: size.width *2 || 250,  height: 180 *2, nodes, edges})
        return;
      }
    }
    if (schemaName === 'mindMap0') {
      const {nodes, edges} = convertToReactFlow0(jsonData);
      if ( nodes && nodes.length > 0 && edges && edges.length > 0) {
        setMindMapData({width: size.width || 250,  height: 180, nodes, edges})
        setMindMapDataLarge({width: size.width *2 || 250,  height: 180 *2, nodes, edges})
        return;
      }
    }

    // we try to ask open ai to do the mapping directly.
    const prompt =  mapToNewJsonSchema('Mind Map', JSON.stringify(jsonData), JSON.stringify(mindMapSchema) );
    const r = await spineApi.generateContentWithJson( prompt, null, { label: 'chat-message' } );
    if (r) {
      content0 = stripJsonWrap(r)
      if ( content0.startsWith('{') && content0.charAt(content0.length-1) === '}' )
        jsonData = JSON5.parse(content0);
      else
        jsonData = await aiProviderManager.extractJsonData( content0);
      if (!jsonData) return;
      const {nodes, edges} = convertToReactFlow(jsonData);
      if ( nodes && nodes.length > 0 && edges && edges.length > 0) {
        setMindMapData({width: size.width || 250,  height: 180, nodes, edges})
        setMindMapDataLarge({width: Math.min(size.width *2,650) || 250,  height: 230 *2, nodes, edges})

      }
    }

  }

  useEffect(() => {
    async function t() {
      // const key = await customStorage.getOpenAIKey();
      // setApiKey(key);
      // const m = await customStorage.getChatGPTModel();
      //  setModel(m);
      const rl = await customStorage.getReaderLevel();
      setReaderLevelPrompt(createReaderLevelPrompt(rl));
      const sm = (await customStorage.getStudyMode()) || StudyMode.General;
      if (sm === StudyMode.Language) {
        const keywords = await customStorage.getKeyWordList(StudyMode.Language);
        if (keywords && keywords.length > 0) {
          const v = keywords.join("\n");
          const k = ` I'm here as a language expert. In crafting responses, I'll endeavor to incorporate words from the provided list:
            ${v}.
            Expect creativity as I weave these words into my answers. \n `;
          setKeywordExercisePrompt(k);
        }
      }

      // Initialize skill system
      try {
        const status = skillApi.getStatus();
        setSkillStatus(status);
        // Auto-enable skill mode if provider supports tool use
        if (status.supportsToolUse) {
          setSkillMode(true);
        }
        // Get available skills
        const skills = await skillApi.getAvailableSkills();
        setAvailableSkills(skills || []);
      } catch (err) {
        console.warn('Failed to initialize skill system:', err);
      }
    }
    t();
  }, []);

  useEffect(() => {
    if (!chatId) return undefined;
    // Race guard: switching chats rapidly fires overlapping fetches; the
    // slow earlier chat's messages can overwrite the faster new chat's
    // both in Redux (messageQueried/chatHandled) and in local state.
    let cancelled = false;
    async function t() {
      const ms = await getMessagesByChatId(chatId);
      if (cancelled) return;
      dispatch(messageQueried(ms));
      const ms2 =
        ms
          ?.filter((message) => message.role === 'user')
          .map((message) => message.content) || [];
      setUserMessages(ms2);
      const ct = await getChatById(chatId);
      if (cancelled) return;
      setChat(ct);
      dispatch(chatHandled(ct));
    }
    t();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const getSystemMessage = () => {
    const message = [];
    if (writingCharacter && writingCharacter.label !== None) message.push(`You are ${writingCharacter.value}.`);
    else  message.push(
        'You are ChatGPT, a large language model trained by OpenAI.',
      );
    if (writingTone !== None) message.push(`Respond in ${writingTone} tone.`);
    if (writingStyle !== None) message.push(`Respond in ${writingStyle} style.`);
    if (writingFormat && writingFormat.label !== None) message.push(writingFormat.value);
    return message.join(' ');
  };

  const systemMessageLocal = 'You are assistant and you confidently answer questions based on the knowledge user provided during conversation. if a question is out of the knowledge, you politely refuse.';

  async function queryLocalData(query) {
    const r = await customStorage.semanticQuery(query, 5, undefined);
    let data = '';
    if (r && r.ids && r.ids.length > 0) {
      for (let i = 0; i < r.ids.length; i++) {
        data += ` ${  r.documents[i]}`;
      }
    }
    return data;
  }
  function getFirstNMinusTwoItems(arr) {
    if (!arr) return [];
    const n = arr.length;
    if (n <= 2) {
      return arr;
    }
    return arr.slice(0, n - 2);

  }
  const handleCheckboxChange = (event) => {
    setMultiline(event.target.checked);
  };
  const createNewChat = async (event) => {
    const c = {
      //  id,
      description: 'New Chat',
      totalTokens: 0,
      createdAt: new Date(),
      pinned: false,
      autoDelete: false,
    };
    const c2 = await createChat(c);
    if (typeof c2.id === 'undefined') {
      return;
    }
    setUserMessages([]);
    setChat(c2);
    dispatch(chatAdded(c2));
    dispatch(chatHandled(c2));
    dispatch(messageQueried([]));
    setLastToolsUsed([]);
  };

  // Handle slash command selection
  const handleSlashCommand = useCallback(async (command) => {
    setShowSlashMenu(false);
    setSlashFilter('');
    setSlashSelectedIndex(0);

    if (!command.isSkill) {
      // Handle system commands
      switch (command.name) {
        case 'clear':
          dispatch(messageQueried([]));
          setLastToolsUsed([]);
          break;
        case 'new':
          createNewChat();
          break;
        case 'help':
          showMessage('Available commands: /summarize, /explain, /grammar, /quiz, /translate, /search, /clear, /new', 'info');
          break;
        case 'settings':
          setShowSettings(true);
          break;
        default:
          break;
      }
      setContent('');
      return;
    }

    // For skills, insert the command and show parameter hint
    if (command.requiredParams && command.requiredParams.length > 0) {
      // Insert command with placeholder for required params
      const paramHint = command.requiredParams.map(p => `<${p}>`).join(' ');
      setContent(`/${command.name} ${paramHint}`);
    } else {
      // For skills without required params, just insert the command
      setContent(`/${command.name} `);
    }
  }, [dispatch, createNewChat, showMessage]);

  // Execute a skill directly (for quick actions)
  const executeSkillDirect = useCallback(async (skillName, params = {}) => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setLastToolsUsed([]);

      // Create a user message showing the action
      const userContent = `/${skillName}${params.text ? ` "${params.text.substring(0, 50)}${params.text.length > 50 ? '...' : ''}"` : ''}`;

      let curChatId = chatId;
      if (!chat) {
        const newChat = {
          description: `/${skillName}`,
          totalTokens: 0,
          createdAt: new Date(),
          pinned: false,
          autoDelete: false,
        };
        const c = await createChat(newChat);
        dispatch(chatAdded(c));
        setChat(c);
        curChatId = c.id;
      }

      const userMessage = await createMessage({
        chatId: curChatId,
        content: userContent,
        role: 'user',
        createdAt: new Date(),
      });
      dispatch(messageAdded(userMessage));

      // Execute the skill
      const result = await skillApi.executeSkill(skillName, params);

      const botContent = result.success
        ? (typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2))
        : `Error: ${result.error}`;

      const botMessage = await createMessage({
        chatId: curChatId,
        content: botContent,
        role: 'assistant',
        createdAt: new Date(),
      });
      dispatch(messageAdded(botMessage));
      setLastToolsUsed([skillName]);

    } catch (error) {
      console.error('Skill execution error:', error);
      showMessage(error.message || 'Skill execution failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, chatId, chat, dispatch, showMessage]);

  // Submit with skill-aware AI (agentic mode)
  const submitWithSkills = async (useLocalData) => {
    if (submitting) return;

    let curChatId = chatId;
    if (!chat) {
      const newChat = {
        description: content.substring(0, 20),
        totalTokens: 0,
        createdAt: new Date(),
        pinned: false,
        autoDelete: false,
      };
      const c = await createChat(newChat);
      dispatch(chatAdded(c));
      setChat(c);
      curChatId = c.id;
    }

    try {
      setSubmitting(true);
      setLastToolsUsed([]);

      let localData = '';
      if (useLocalData) {
        localData = await queryLocalData(content);
      }

      const userMessage = await createMessage({
        chatId: curChatId,
        content,
        role: 'user',
        createdAt: new Date(),
      });
      dispatch(messageAdded(userMessage));
      setUserMessages([...userMessages, content]);
      setContent('');

      // Build context
      const contextPrefix = localData
        ? `[Context from local knowledge:\n${localData.substring(0, 3000)}]\n\n`
        : '';

      // Build messages for skill chat
      const chatMessages = [
        {
          role: 'system',
          content: `${readerLevelPrompt}
                    ${keywordExercisePrompt}
                    ${getSystemMessage()}
                    You are a helpful AI assistant with access to various skills/tools.
                    When the user asks you to perform tasks like summarizing, explaining concepts,
                    checking grammar, generating quizzes, translating, or searching notes,
                    use the appropriate skill to provide better results.`,
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: 'user',
          content: contextPrefix + content,
        },
      ];

      // Create placeholder bot message
      const botMessage = await createMessage({
        chatId: curChatId,
        content: '',
        role: 'assistant',
        createdAt: new Date(),
      });
      const messageId = botMessage.id;
      dispatch(messageAdded(botMessage));

      // Call skill-aware chat API
      const result = await skillApi.chatWithSkills(chatMessages, {
        maxIterations: 3,
      });

      if (result.success) {
        const botMessage3 = await updateMessage({
          id: messageId,
          key: 'content',
          value: result.text,
        });
        dispatch(messageUpdated(botMessage3));
        setLastToolsUsed(result.toolsUsed || []);
        await tryToCustomizeUI(result.text);
      } else {
        // Fallback to regular submit
        console.warn('Skill chat failed, falling back to regular:', result.error);
        await submitRegular(useLocalData, curChatId, messageId);
      }

    } catch (error) {
      console.error('[Skills] Error:', error);
      showMessage(error.message || 'Skill chat failed', 'error');
    } finally {
      setSubmitting(false);
      setImageData('');
    }
  };

  // Regular submit (non-skill mode) - extracted for reuse
  const submitRegular = async (useLocalData, existingChatId = null, existingMessageId = null) => {
    let curChatId = existingChatId || chatId;

    if (!existingChatId && !chat) {
      const newChat = {
        description: content.substring(0, 20),
        totalTokens: 0,
        createdAt: new Date(),
        pinned: false,
        autoDelete: false,
      };
      const c = await createChat(newChat);
      dispatch(chatAdded(c));
      setChat(c);
      curChatId = c.id;
    }

    let localData = '';
    if (useLocalData) {
      localData = await queryLocalData(content);
    }

    const userRealInput = useLocalData
      ? `${systemMessageLocal}\nThese are knowledge provided for you:\n${localData}\n\n##(End)##\n${content}`
      : content;

    const result = await aiProviderManager.generateChatStream([
      {
        role: 'system',
        content: `${readerLevelPrompt} ${keywordExercisePrompt}${getSystemMessage()}${useLocalData ? systemMessageLocal : ''}`,
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: 'user',
        content: userRealInput,
      },
    ]);

    let botContent = '';
    for await (const chunk of result.stream) {
      const c = chunk.data();
      botContent += c;
      // Update message in real-time
      if (existingMessageId) {
        dispatch(messageUpdated({ id: existingMessageId, content: botContent }));
      }
    }

    if (result.finalChatCompletion) await result.finalChatCompletion();

    if (existingMessageId) {
      const botMessage3 = await updateMessage({
        id: existingMessageId,
        key: 'content',
        value: botContent,
      });
      dispatch(messageUpdated(botMessage3));
    }

    await tryToCustomizeUI(botContent);
  };

  const submit = async (useLocalData) => {
    if (submitting) return;

    // Check for slash command
    if (content.startsWith('/')) {
      const parts = content.slice(1).split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const cmdArgs = parts.slice(1).join(' ');

      // Find matching skill
      const skill = availableSkills.find(s => s.name === cmdName);
      if (skill) {
        // Execute the skill with any provided arguments as text
        if (cmdArgs) {
          await executeSkillDirect(cmdName, { text: cmdArgs });
        } else {
          showMessage(`/${cmdName} requires text. Usage: /${cmdName} <your text>`, 'warning');
        }
        setContent('');
        return;
      }

      // Check system commands
      const sysCmd = ['clear', 'new', 'help', 'settings'].find(c => c === cmdName);
      if (sysCmd) {
        handleSlashCommand({ name: sysCmd, isSkill: false });
        return;
      }
    }

    // Use skill-aware submit if skill mode is enabled and no image
    if (skillMode && skillStatus.supportsToolUse && !imageData) {
      await submitWithSkills(useLocalData);
      return;
    }

    // Original submit logic for non-skill mode or with images
    let curChatId = chatId;
    if (!chat) {
      console.log(` create new chat here ... `)
      const newChat = {
        description: content.substring(0,20),
        totalTokens: 0,
        createdAt: new Date(),
        pinned: false,
        autoDelete: false,
      };
      const c = await createChat(newChat);
      dispatch(chatAdded(c));
      setChat(c);
      curChatId = c.id;
    }

    try {
      setSubmitting(true);
      setLastToolsUsed([]);

      let localData = ''
      if (useLocalData) {
         localData = queryLocalData(content);
      }
      const userMessage = await createMessage({
        chatId: curChatId,
        content,
        role: 'user',
        createdAt: new Date(),
      });
      dispatch(messageAdded(userMessage));
      setUserMessages([...userMessages, content]);
      setContent('');

      const botMessage = {
        chatId: curChatId,
        content: '',
        role: 'assistant',
        createdAt: new Date(),
      };
      let botMessage2 = await createMessage(botMessage);
      const messageId = botMessage2.id;
      dispatch(messageAdded(botMessage2));

      const userRealInput = useLocalData? (`${systemMessageLocal  }\nThese are knowleges provided for you:\n${
                localData  }\n\n##(End)##\n${  content}` ): content;

      if (imageData) {
         const res = await aiProviderManager.generateMultimodalContent(userRealInput,[{ data: imageData, mimeType: ''}], false );
         botMessage2 = {...botMessage2, content: res}
         dispatch(messageUpdated(botMessage2));
         refresh();
         const botMessage3 = await updateMessage({id:messageId, key:'content', res} );
         dispatch(messageUpdated(botMessage3));
         await tryToCustomizeUI(res);
      } else {
        const result = await aiProviderManager.generateChatStream( [
            {
              role: 'system',
              content: `${readerLevelPrompt  } ${ keywordExercisePrompt   }${getSystemMessage()  }${useLocalData?systemMessageLocal:''}`,
            },
            ...messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            {
              role: 'user',
              content: userRealInput
            },
          ] );

        for await (const chunk of result.stream) {
          const c = chunk.data();
          botMessage2 = {...botMessage2, content: botMessage2.content+c}
          dispatch(messageUpdated(botMessage2));
        }
        if (result.finalChatCompletion)
          await result.finalChatCompletion();
        const botMessage3 = await updateMessage({id:messageId, key:'content', value:botMessage2.content} );
        dispatch(messageUpdated(botMessage3));
        await tryToCustomizeUI(botMessage2.content);
      }

      setSubmitting(false);

      // if (chat?.description === 'New Chat') {
      //   const msgs = await getMessagesByChatId(curChatId);
      //   dispatch(messageHandled(msgs));
      //   const createChatDescription = await aiProviderManager.sendChatMessage( [
      //       {
      //         role: 'system',
      //         content: getSystemMessage(),
      //       },
      //       ...(msgs || []).map((message) => ({
      //         role: message.role,
      //         content: message.content,
      //       })),
      //       {
      //         role: 'user',
      //         content:
      //           'What would be a short and relevant title for this chat ? You must strictly answer with only the title, no other text is allowed.',
      //       },
      //     ] );

      //   const chatDescription =
      //     createChatDescription.choices[0].message?.content;

      //   if (createChatDescription.usage) {
      //     const msg4 = await updateChat( {id:curChatId,
      //       field:'description', value:chatDescription ?? 'New Chat'});
      //     const msg5 = await updateChat({id:curChatId,
      //       field:'total_tokens',  value:createChatDescription.usage
      //         ? createChatDescription.usage.total_tokens
      //         : 0
      //     });
      //     dispatch(chatUpdated(msg5));
      //   }
      // }

    } catch (error) {
      console.log(error);
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showMessage('No internet connection.');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showMessage(message);
      }
    } finally {
       setSubmitting(false);
       setImageData('');
    }
  };
  const uploadImageFile = async () => {
    const image = await customStorage.importImageBase64FromFile();
    if (!image) return;
    setImageData(image);
  }
  const onUserMsgToggle = (arrowUp) => {
    const newMsgIndex = userMsgIndex + (arrowUp ? 1 : -1);
    if (newMsgIndex < 0 || newMsgIndex >= userMessages.length) {
      // index out of range, do nothing
      return;
    }
    setContent(userMessages.at(newMsgIndex) || '');
    setUserMsgIndex(newMsgIndex);
  };

  const onContentChange = (event) => {
    const { value } = event.currentTarget;
    setContent(value);
    setUserMsgIndex(0);

    // Detect slash command
    if (value.startsWith('/')) {
      const filter = value.slice(1).split(/\s/)[0]; // Get command name part
      setSlashFilter(filter);
      setShowSlashMenu(true);
      setSlashSelectedIndex(0);
    } else {
      setShowSlashMenu(false);
      setSlashFilter('');
    }
  };

  // Handle keyboard navigation in slash menu
  const handleKeyDown = (event) => {
    if (showSlashMenu) {
      const filteredCommands = [...availableSkills, ...([
        { name: 'clear', description: 'Clear chat history', category: 'system', isSkill: false },
        { name: 'new', description: 'Start a new chat', category: 'system', isSkill: false },
        { name: 'help', description: 'Show available commands', category: 'system', isSkill: false },
        { name: 'settings', description: 'Open settings panel', category: 'system', isSkill: false },
      ])].filter(cmd =>
        cmd.name.toLowerCase().includes(slashFilter.toLowerCase()) ||
        cmd.description.toLowerCase().includes(slashFilter.toLowerCase())
      );

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashSelectedIndex(prev =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
      } else if (event.key === 'Enter' && filteredCommands.length > 0) {
        event.preventDefault();
        handleSlashCommand(filteredCommands[slashSelectedIndex]);
      } else if (event.key === 'Escape') {
        setShowSlashMenu(false);
        setSlashFilter('');
      } else if (event.key === 'Tab' && filteredCommands.length > 0) {
        event.preventDefault();
        // Auto-complete the command
        const cmd = filteredCommands[slashSelectedIndex];
        setContent(`/${cmd.name} `);
        setShowSlashMenu(false);
      }
    } else {
      // Normal key handling
      if (event.code === 'Enter' && !event.shiftKey && !multiline) {
        event.preventDefault();
        submit(false);
        setUserMsgIndex(0);
      }
      if (event.code === 'ArrowUp' && !content) {
        onUserMsgToggle(true);
      }
      if (event.code === 'ArrowDown' && !content) {
        onUserMsgToggle(false);
      }
    }
  };

  // Handle quick action click
  const handleQuickAction = async (action) => {
    if (submitting) return;

    // Check if there's selected text or content to work with
    const textToProcess = content.trim();

    if (!textToProcess) {
      showMessage(`Please enter some text first, then click ${action.label}`, 'info');
      return;
    }

    await executeSkillDirect(action.skill, { text: textToProcess });
    setContent('');
  };

  // Memoized active settings summary
  const activeSettings = useMemo(() => {
    const active = [];
    if (writingCharacter?.label && writingCharacter.label !== None) active.push(writingCharacter.label);
    if (writingTone && writingTone !== None) active.push(writingTone);
    if (writingStyle && writingStyle !== None) active.push(writingStyle);
    if (writingFormat?.label && writingFormat.label !== None) active.push(writingFormat.label);
    return active;
  }, [writingCharacter, writingTone, writingStyle, writingFormat]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Messages Area */}
      <Box
        ref={componentRef}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          px: { xs: 2, md: 4 },
          py: 3,
          // Hide scrollbar by default, show on hover
          '&::-webkit-scrollbar': {
            width: 0,
            background: 'transparent',
          },
          '&:hover::-webkit-scrollbar': {
            width: 6,
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: alpha(theme.palette.text.primary, 0.15),
            borderRadius: 3,
          },
          // Firefox
          scrollbarWidth: 'none',
          '&:hover': {
            scrollbarWidth: 'thin',
          },
        }}
      >
        {/* Welcome State */}
        {(!messages || messages.length === 0) && !submitting && (
          <WelcomeCard>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: alpha(colors.primary.accent, 0.15),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 40, color: colors.primary.accent }} />
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                mb: 1.5,
                background: `linear-gradient(135deg, ${colors.primary.accent} 0%, ${colors.accent.accent} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI Assistant
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 400, lineHeight: 1.6 }}
            >
              Start a conversation by typing your message below.
              I can help with questions, explanations, writing, and more.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 3 }} flexWrap="wrap" justifyContent="center">
              <Chip
                icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
                label="AI Powered"
                size="small"
                sx={{
                  bgcolor: alpha(colors.primary.accent, 0.1),
                  color: colors.primary.accent,
                  fontWeight: 500,
                }}
              />
              <Chip
                icon={<StorageIcon sx={{ fontSize: 16 }} />}
                label="Local Knowledge"
                size="small"
                sx={{
                  bgcolor: alpha(colors.warning.accent, 0.1),
                  color: colors.warning.icon,
                  fontWeight: 500,
                }}
              />
              {skillStatus.supportsToolUse && (
                <Chip
                  icon={<BuildIcon sx={{ fontSize: 16 }} />}
                  label={`${skillStatus.skillCount} Skills`}
                  size="small"
                  sx={{
                    bgcolor: alpha('#6366f1', 0.1),
                    color: '#6366f1',
                    fontWeight: 500,
                  }}
                />
              )}
            </Stack>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 2, opacity: 0.7 }}
            >
              Type <code style={{ backgroundColor: alpha(theme.palette.divider, 0.3), padding: '2px 6px', borderRadius: 4 }}>/</code> to see available commands
            </Typography>
          </WelcomeCard>
        )}

        {/* Messages List */}
        <Stack spacing={2}>
          {messages?.map((message, index) => (
            <Box key={message.id}>
              <MessageItem message={message} />
              {/* Show tool usage badges for the last assistant message */}
              {message.role === 'assistant' &&
                index === messages.length - 1 &&
                lastToolsUsed.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, ml: 5, flexWrap: 'wrap', gap: 0.5 }}>
                  {lastToolsUsed.map((tool) => (
                    <ToolUsageBadge
                      key={tool}
                      icon={<BuildIcon />}
                      label={tool}
                      size="small"
                    />
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>

        {/* Loading indicator */}
        {submitting && (
          <Box sx={{ mt: 2, px: 2 }}>
            <LinearProgress
              sx={{
                borderRadius: 2,
                bgcolor: alpha(colors.primary.accent, 0.1),
                '& .MuiLinearProgress-bar': {
                  bgcolor: colors.primary.accent,
                },
              }}
            />
          </Box>
        )}

        {/* Mind Map Display */}
        {mindMapData && (
          <Fade in={!!mindMapData}>
            <Box
              sx={{
                mt: 3,
                p: 2,
                borderRadius: 3,
                bgcolor: theme.palette.background.paper,
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                boxShadow: `0 4px 20px ${alpha('#000', isDark ? 0.3 : 0.08)}`,
              }}
            >
              <MindmapSurface data={mindMapDataLarge || mindMapData} mode="inline" />
            </Box>
          </Fade>
        )}
      </Box>

      {/* Input Area Container */}
      <Box
        sx={{
          bgcolor: theme.palette.background.paper,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        {/* Quick Actions Bar */}
        {showQuickActions && skillStatus.supportsToolUse && (
          <QuickActionsBar>
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" sx={{ gap: 0.5 }}>
              {/* Skill Mode Toggle */}
              <SkillModeChip
                icon={<PsychologyIcon />}
                label={skillMode ? 'Agentic' : 'Basic'}
                size="small"
                active={skillMode ? 1 : 0}
                onClick={() => setSkillMode(!skillMode)}
              />

              <Box sx={{ width: 1, height: 16, borderLeft: `1px solid ${alpha(theme.palette.divider, 0.3)}`, mx: 0.5 }} />

              {/* Quick Action Chips */}
              {QUICK_ACTIONS.map((action) => (
                <QuickActionChip
                  key={action.id}
                  icon={<action.icon />}
                  label={action.label}
                  size="small"
                  chipcolor={action.color}
                  onClick={() => handleQuickAction(action)}
                  disabled={submitting}
                />
              ))}
            </Stack>

            {/* Hide quick actions button */}
            <Tooltip title="Hide quick actions">
              <IconButton
                size="small"
                onClick={() => setShowQuickActions(false)}
                sx={{
                  ml: 'auto',
                  width: 24,
                  height: 24,
                  opacity: 0.5,
                  '&:hover': { opacity: 1 },
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </QuickActionsBar>
        )}

        {/* Show quick actions button when hidden */}
        {!showQuickActions && skillStatus.supportsToolUse && (
          <Box
            sx={{
              px: 2,
              py: 0.5,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
              label="Show Quick Actions"
              size="small"
              onClick={() => setShowQuickActions(true)}
              sx={{
                cursor: 'pointer',
                fontSize: '0.65rem',
                height: 22,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.15),
                },
              }}
            />
          </Box>
        )}

        <Box sx={{ p: 2, pt: showQuickActions ? 1 : 2 }}>
        {/* Settings Panel (Collapsible) - Modern Ribbon Style */}
        <Collapse in={showSettings}>
          <SettingsPanel>
            <SettingsHeader>
              <Stack direction="row" alignItems="center" gap={1}>
                <TuneIcon sx={{ fontSize: 18, color: colors.primary.accent }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  Writing Settings
                </Typography>
              </Stack>
              <IconButton
                size="small"
                onClick={() => setShowSettings(false)}
                sx={{
                  width: 28,
                  height: 28,
                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </SettingsHeader>

            {/* Character Category */}
            <SettingsCategoryBox categoryColor={settingsColors.character.accent}>
              <CategoryLabel sx={{ color: settingsColors.character.icon }}>
                <PersonOutlineIcon sx={{ fontSize: 14 }} />
                Character
              </CategoryLabel>
              <OptionChipsContainer>
                {promptSettingList.writingCharacters.map((option) => {
                  const label = typeof option.label !== 'undefined' ? option.label : option;
                  const isSelected = writingCharacter?.label === label || writingCharacter === option;
                  return (
                    <OptionChip
                      key={`char-${label}`}
                      label={label}
                      size="small"
                      selected={isSelected}
                      chipColor={settingsColors.character.accent}
                      onClick={() => setWritingCharacter(option)}
                    />
                  );
                })}
              </OptionChipsContainer>
            </SettingsCategoryBox>

            {/* Tone Category */}
            <SettingsCategoryBox categoryColor={settingsColors.tone.accent}>
              <CategoryLabel sx={{ color: settingsColors.tone.icon }}>
                <RecordVoiceOverIcon sx={{ fontSize: 14 }} />
                Tone
              </CategoryLabel>
              <OptionChipsContainer>
                {promptSettingList.writingTones.map((option) => {
                  const label = typeof option.label !== 'undefined' ? option.label : option;
                  const isSelected = writingTone === option;
                  return (
                    <OptionChip
                      key={`tone-${label}`}
                      label={label}
                      size="small"
                      selected={isSelected}
                      chipColor={settingsColors.tone.accent}
                      onClick={() => setWritingTone(option)}
                    />
                  );
                })}
              </OptionChipsContainer>
            </SettingsCategoryBox>

            {/* Style Category */}
            <SettingsCategoryBox categoryColor={settingsColors.style.accent}>
              <CategoryLabel sx={{ color: settingsColors.style.icon }}>
                <BrushIcon sx={{ fontSize: 14 }} />
                Style
              </CategoryLabel>
              <OptionChipsContainer>
                {promptSettingList.writingStyles.map((option) => {
                  const label = typeof option.label !== 'undefined' ? option.label : option;
                  const isSelected = writingStyle === option;
                  return (
                    <OptionChip
                      key={`style-${label}`}
                      label={label}
                      size="small"
                      selected={isSelected}
                      chipColor={settingsColors.style.accent}
                      onClick={() => setWritingStyle(option)}
                    />
                  );
                })}
              </OptionChipsContainer>
            </SettingsCategoryBox>

            {/* Format Category */}
            <SettingsCategoryBox categoryColor={settingsColors.format.accent}>
              <CategoryLabel sx={{ color: settingsColors.format.icon }}>
                <ArticleIcon sx={{ fontSize: 14 }} />
                Format
              </CategoryLabel>
              <OptionChipsContainer>
                {promptSettingList.writingFormats.map((option) => {
                  const label = typeof option.label !== 'undefined' ? option.label : option;
                  const isSelected = writingFormat?.label === label || writingFormat === option;
                  return (
                    <OptionChip
                      key={`format-${label}`}
                      label={label}
                      size="small"
                      selected={isSelected}
                      chipColor={settingsColors.format.accent}
                      onClick={() => setWritingFormat(option)}
                    />
                  );
                })}
              </OptionChipsContainer>
            </SettingsCategoryBox>
          </SettingsPanel>
        </Collapse>

        {/* Active Settings Tags (when settings panel is closed) */}
        {!showSettings && activeSettings.length > 0 && (
          <Box sx={{ mb: 1.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {activeSettings.map((setting) => {
              // Determine color based on setting type
              let chipColor = colors.accent.accent;
              let category = 'default';
              if (writingCharacter?.label === setting) { chipColor = settingsColors.character.accent; category = 'char'; }
              else if (writingTone === setting) { chipColor = settingsColors.tone.accent; category = 'tone'; }
              else if (writingStyle === setting) { chipColor = settingsColors.style.accent; category = 'style'; }
              else if (writingFormat?.label === setting) { chipColor = settingsColors.format.accent; category = 'format'; }

              return (
                <Chip
                  key={`active-${category}-${setting}`}
                  label={setting}
                  size="small"
                  onDelete={() => {
                    // Clear the corresponding setting
                    if (writingCharacter?.label === setting) setWritingCharacter(promptSettingList.writingCharacters[0]);
                    if (writingTone === setting) setWritingTone(promptSettingList.writingTones[0]);
                    if (writingStyle === setting) setWritingStyle(promptSettingList.writingStyles[0]);
                    if (writingFormat?.label === setting) setWritingFormat(promptSettingList.writingFormats[0]);
                  }}
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    borderRadius: 12,
                    bgcolor: alpha(chipColor, 0.12),
                    color: chipColor,
                    border: `1px solid ${alpha(chipColor, 0.3)}`,
                    '& .MuiChip-deleteIcon': {
                      fontSize: 14,
                      color: chipColor,
                      '&:hover': {
                        color: theme.palette.error.main,
                      },
                    },
                  }}
                />
              );
            })}
          </Box>
        )}

        {/* Main Input Box */}
        <StyledInputArea>
          {/* Image Preview */}
          {imageData && (
            <Box sx={{ p: 1.5, pb: 0 }}>
              <Box
                sx={{
                  position: 'relative',
                  display: 'inline-block',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Box
                  component="img"
                  src={imageData}
                  alt="Attached"
                  sx={{
                    height: 60,
                    width: 'auto',
                    borderRadius: 2,
                    display: 'block',
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => setImageData('')}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 20,
                    height: 20,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'rgba(0,0,0,0.8)',
                    },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            </Box>
          )}

          {/* Slash Command Menu */}
          <SlashCommandMenu
            open={showSlashMenu}
            anchorEl={inputRef.current}
            filter={slashFilter}
            onSelect={handleSlashCommand}
            onClose={() => {
              setShowSlashMenu(false);
              setSlashFilter('');
            }}
            skills={availableSkills}
            selectedIndex={slashSelectedIndex}
            onSelectedIndexChange={setSlashSelectedIndex}
          />

          {/* Text Input */}
          <TextField
            fullWidth
            multiline
            minRows={multiline ? 4 : 1}
            maxRows={8}
            disabled={submitting}
            value={content}
            onChange={onContentChange}
            placeholder={skillMode ? "Type / for commands or ask anything..." : "Type your message..."}
            variant="standard"
            inputRef={inputRef}
            InputProps={{
              disableUnderline: true,
              sx: {
                px: 2,
                py: 1.5,
                fontSize: '0.95rem',
                lineHeight: 1.6,
              },
            }}
            onKeyDown={handleKeyDown}
          />

          {/* Action Bar */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 1,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            }}
          >
            {/* Left Actions */}
            <Stack direction="row" spacing={0.5} alignItems="center">
              {aiProviderManager.currentProvider?.isFullSupported() && (
                <Tooltip title="Attach Image">
                  <IconButton
                    size="small"
                    onClick={uploadImageFile}
                    sx={{
                      color: imageData ? colors.primary.accent : 'text.secondary',
                      '&:hover': {
                        bgcolor: alpha(colors.primary.accent, 0.1),
                        color: colors.primary.accent,
                      },
                    }}
                  >
                    <AddPhotoAlternateIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}

              <Tooltip title="Writing Settings">
                <IconButton
                  size="small"
                  onClick={() => setShowSettings(!showSettings)}
                  sx={{
                    color: showSettings || activeSettings.length > 0
                      ? colors.accent.accent
                      : 'text.secondary',
                    '&:hover': {
                      bgcolor: alpha(colors.accent.accent, 0.1),
                      color: colors.accent.accent,
                    },
                  }}
                >
                  <TuneIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="Multi-line Mode">
                <IconButton
                  size="small"
                  onClick={() => setMultiline(!multiline)}
                  sx={{
                    color: multiline ? colors.secondary.accent : 'text.secondary',
                    '&:hover': {
                      bgcolor: alpha(colors.secondary.accent, 0.1),
                      color: colors.secondary.accent,
                    },
                  }}
                >
                  <KeyboardIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              <Tooltip title="New Chat">
                <IconButton
                  size="small"
                  onClick={createNewChat}
                  sx={{
                    color: 'text.secondary',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    },
                  }}
                >
                  <CreateNewFolderIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>

            {/* Right Actions - Send Buttons */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Send with Local Knowledge">
                <span>
                  <ActionButton
                    size="small"
                    onClick={() => submit(true)}
                    disabled={submitting || !content.trim()}
                    color="warning"
                    sx={{
                      width: 36,
                      height: 36,
                    }}
                  >
                    <StorageIcon sx={{ fontSize: 18 }} />
                  </ActionButton>
                </span>
              </Tooltip>

              <Tooltip title="Send Message">
                <span>
                  <ActionButton
                    size="small"
                    onClick={() => submit(false)}
                    disabled={submitting || !content.trim()}
                    sx={{
                      width: 36,
                      height: 36,
                      bgcolor: content.trim()
                        ? colors.primary.accent
                        : alpha(colors.primary.accent, 0.1),
                      color: content.trim() ? 'white' : colors.primary.accent,
                      '&:hover': {
                        bgcolor: content.trim()
                          ? alpha(colors.primary.accent, 0.85)
                          : alpha(colors.primary.accent, 0.2),
                      },
                    }}
                  >
                    <SendIcon sx={{ fontSize: 18 }} />
                  </ActionButton>
                </span>
              </Tooltip>
            </Stack>
          </Box>
        </StyledInputArea>
        </Box>
      </Box>

      {/* Snackbar for Messages */}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          variant="filled"
          sx={{
            borderRadius: 2,
            boxShadow: `0 4px 20px ${alpha('#000', 0.2)}`,
          }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ChatDetailPanel;
