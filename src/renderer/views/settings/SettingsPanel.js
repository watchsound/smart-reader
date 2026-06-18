import React, { useRef, useState } from 'react';
import {
  Radio,
  RadioGroup,
  FormControlLabel,
  Paper,
  Box,
  Chip,
  Stack,
  Checkbox,
  MenuItem,
  Select,
  TextField,
  Grid,
  Typography,
  Button,
  IconButton,
  Collapse,
  InputAdornment,
  Alert,
  Switch,
  alpha,
} from '@mui/material';

import { styled } from '@mui/system';

import TagsInput from 'react-tagsinput';
import 'react-tagsinput/react-tagsinput.css';

import Picker from '@emoji-mart/react';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import TuneIcon from '@mui/icons-material/Tune';
import StorageIcon from '@mui/icons-material/Storage';
import PaletteIcon from '@mui/icons-material/Palette';
import QuizIcon from '@mui/icons-material/Quiz';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import KeyIcon from '@mui/icons-material/Key';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LinkIcon from '@mui/icons-material/Link';
import HubIcon from '@mui/icons-material/Hub';
import SyncIcon from '@mui/icons-material/Sync';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CircularProgress from '@mui/material/CircularProgress';

import customStorage from '../../store/customStorage';
import graphApi from '../../api/graphApi';
import ProviderSpendStats from './ProviderSpendStats';
import ProviderPricingOverride from './ProviderPricingOverride';
import '../../components/CustomizedFilterBase/nodefilter-styles.module.css';
import {
  StudyMode,
  QuizType,
  ReaderLevel,
  ChatGPTModel,
  GeminiModel,
  AIProvider,
  LeitnerSpeed,
  ClaudeModel,
  BaiduModel,
  KimiModel,
  OllamaModel,
  DoubaoModel,
  QwenModel,
} from '../../../commons/model/DataTypes';
import { useDeleteAllNoteMutation } from '../../store/api/noteApiSlice';
import { useClearAllBooksMutation } from '../../store/api/bookApiSlice';
import {
  useDeleteAllChatsMutation,
  useDeleteAllPromptsMutation,
} from '../../store/api/chatApiSlice';
import { useDeleteAllMoodBoardsMutation } from '../../store/api/moodBoardApiSlice';
import ThemeToggleButton from '../../components/ThemeToggleButton';
import WordListManagerUI from './WordListManagerUI';
import ColorMultiplePicker from '../../components/ColorMultiplePicker';
import ImageSelector from '../../components/ImageSelector';
import FontSelector from '../../components/FontSelector';
import ShowSampleColorDialog from './ShowSampleColorDialog';
import SoundSettingsSection from './SoundSettingsSection';
import BrainSettingsSection from './BrainSettingsSection';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PsychologyIcon from '@mui/icons-material/Psychology';

// Styled Components
const PageContainer = styled(Box)(({ theme }) => ({
  padding: '24px',
  maxWidth: '900px',
  margin: '0 auto',
  minHeight: '100vh',
  backgroundColor: theme.palette.mode === 'dark' ? '#1a1d21' : '#f8f8f8',
}));

const PageHeader = styled(Box)(({ theme }) => ({
  marginBottom: '32px',
}));

const PageTitle = styled(Typography)(({ theme }) => ({
  fontSize: '1.75rem',
  fontWeight: 700,
  color: theme.palette.text.primary,
  marginBottom: '8px',
}));

const PageSubtitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  color: theme.palette.text.secondary,
}));

const SettingsSection = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#222529' : '#ffffff',
  borderRadius: '8px',
  marginBottom: '16px',
  overflow: 'hidden',
  border:
    theme.palette.mode === 'dark' ? '1px solid #3d4043' : '1px solid #e8e8e8',
  boxShadow: 'none',
}));

const SectionHeader = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'expanded',
})(({ theme, expanded }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  cursor: 'pointer',
  backgroundColor: expanded
    ? theme.palette.mode === 'dark'
      ? 'rgba(255,255,255,0.02)'
      : 'rgba(0,0,0,0.01)'
    : 'transparent',
  borderBottom: expanded
    ? theme.palette.mode === 'dark'
      ? '1px solid #3d4043'
      : '1px solid #e8e8e8'
    : 'none',
  transition: 'background-color 0.15s ease',
  '&:hover': {
    backgroundColor:
      theme.palette.mode === 'dark'
        ? 'rgba(255,255,255,0.03)'
        : 'rgba(0,0,0,0.02)',
  },
}));

const SectionIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})(({ theme, color }) => ({
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: color || '#2eb67d',
  color: '#ffffff',
  marginRight: '12px',
  '& svg': {
    fontSize: '20px',
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: theme.palette.text.primary,
}));

const SectionContent = styled(Box)(({ theme }) => ({
  padding: '20px',
}));

const SettingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom:
    theme.palette.mode === 'dark'
      ? '1px solid rgba(255,255,255,0.05)'
      : '1px solid rgba(0,0,0,0.05)',
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const SettingLabel = styled(Box)(({ theme }) => ({
  flex: 1,
}));

const SettingLabelText = styled(Typography)(({ theme }) => ({
  fontSize: '0.875rem',
  fontWeight: 500,
  color: theme.palette.text.primary,
}));

const SettingLabelHint = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  marginTop: '2px',
}));

const SettingControl = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.palette.mode === 'dark' ? '#1a1d21' : '#f8f8f8',
    borderRadius: '6px',
    fontSize: '0.875rem',
    '& fieldset': {
      borderColor: theme.palette.mode === 'dark' ? '#3d4043' : '#e8e8e8',
    },
    '&:hover fieldset': {
      borderColor: theme.palette.mode === 'dark' ? '#4d5053' : '#d8d8d8',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#1d9bd1',
      borderWidth: '1px',
    },
  },
  '& .MuiInputBase-input': {
    padding: '10px 14px',
  },
}));

const StyledSelect = styled(Select)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1a1d21' : '#f8f8f8',
  borderRadius: '6px',
  fontSize: '0.875rem',
  minWidth: '160px',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'dark' ? '#3d4043' : '#e8e8e8',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.palette.mode === 'dark' ? '#4d5053' : '#d8d8d8',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#1d9bd1',
    borderWidth: '1px',
  },
  '& .MuiSelect-select': {
    padding: '10px 14px',
  },
}));

const SaveButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#2eb67d',
  color: '#ffffff',
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: '6px',
  textTransform: 'none',
  minWidth: '70px',
  '&:hover': {
    backgroundColor: '#238c61',
  },
}));

const DangerButton = styled(Button)(({ theme }) => ({
  backgroundColor: 'transparent',
  color: '#e01e5a',
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '6px 16px',
  borderRadius: '6px',
  textTransform: 'none',
  border: '1px solid #e01e5a',
  '&:hover': {
    backgroundColor: 'rgba(224, 30, 90, 0.08)',
  },
}));

const ProviderCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})(({ theme, selected }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: '8px',
  border: selected
    ? '2px solid #2eb67d'
    : theme.palette.mode === 'dark'
      ? '1px solid #3d4043'
      : '1px solid #e8e8e8',
  backgroundColor: selected
    ? theme.palette.mode === 'dark'
      ? 'rgba(46,182,125,0.1)'
      : 'rgba(46,182,125,0.05)'
    : 'transparent',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  marginBottom: '8px',
  '&:hover': {
    borderColor: selected
      ? '#2eb67d'
      : theme.palette.mode === 'dark'
        ? '#5d6063'
        : '#c8c8c8',
  },
}));

const TagsInputStyled = styled(TagsInput)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1a1d21' : '#f8f8f8',
  border:
    theme.palette.mode === 'dark' ? '1px solid #3d4043' : '1px solid #e8e8e8',
  borderRadius: '6px',
  padding: '8px',
  minHeight: '42px',
  '& .react-tagsinput-tag': {
    backgroundColor: '#2eb67d',
    color: '#ffffff',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '0.8125rem',
  },
  '& .react-tagsinput-input': {
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.palette.text.primary,
    fontSize: '0.875rem',
    '&::placeholder': {
      color: theme.palette.text.secondary,
    },
  },
}));

// Section wrapper component
function SettingsSectionWrapper({
  icon,
  title,
  color,
  children,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <SettingsSection>
      <SectionHeader expanded={expanded} onClick={() => setExpanded(!expanded)}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SectionIcon color={color}>{icon}</SectionIcon>
          <SectionTitle>{title}</SectionTitle>
        </Box>
        <IconButton size="small" sx={{ color: 'text.secondary' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </SectionHeader>
      <Collapse in={expanded}>
        <SectionContent>{children}</SectionContent>
      </Collapse>
    </SettingsSection>
  );
}

export default function SettingsPanel() {
  const [tags, setTags] = useState([]);
  const [openAiKey, setOpenAiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [baiduKey, setBaiduKey] = useState('');
  const [baiduSecret, setBaiduSecret] = useState('');
  const [kimiKey, setKimiKey] = useState('');
  const [doubaoKey, setDoubaoKey] = useState('');
  const [qwenKey, setQwenKey] = useState('');
  const [aiProvider, setAiProvider] = useState('');

  const [serverUrl, setServerUrl] = useState('');
  const [chromaUrl, setChromaUrl] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [studyMode, setStudyMode] = useState(StudyMode.General);
  const [readerLevel, setReaderLevel] = useState(ReaderLevel.College);
  // Default models (faster, cheaper)
  const [chatGPTModel, setChatGPTModel] = useState(ChatGPTModel.GPT4_1_MINI);
  const [geminiModel, setGeminiModel] = useState(GeminiModel.GEMINI_2_5_FLASH);
  const [claudeModel, setClaudeModel] = useState(ClaudeModel.CLAUDE_HAIKU_4_5);
  const [baiduModel, setBaiduModel] = useState(BaiduModel.ERNIE_4_5_TURBO);
  const [kimiModel, setKimiModel] = useState(KimiModel.KIMI_K2);
  const [doubaoModel, setDoubaoModel] = useState(DoubaoModel.DOUBAO_PRO_32K);
  const [qwenModel, setQwenModel] = useState(QwenModel.QWEN_PLUS);
  const [ollamaModel, setOllamaModel] = useState(OllamaModel.LLAMA_3_2_3B);
  // Advanced models (more capable)
  const [chatGPTAdvModel, setChatGPTAdvModel] = useState(ChatGPTModel.GPT4_1);
  const [geminiAdvModel, setGeminiAdvModel] = useState(
    GeminiModel.GEMINI_2_5_PRO,
  );
  const [claudeAdvModel, setClaudeAdvModel] = useState(
    ClaudeModel.CLAUDE_OPUS_4_5,
  );
  const [baiduAdvModel, setBaiduAdvModel] = useState(BaiduModel.ERNIE_5);
  const [kimiAdvModel, setKimiAdvModel] = useState(KimiModel.KIMI_K2_5);
  const [doubaoAdvModel, setDoubaoAdvModel] = useState(DoubaoModel.DOUBAO_SEED_1_6);
  const [qwenAdvModel, setQwenAdvModel] = useState(QwenModel.QWEN3_MAX);
  const [ollamaAdvModel, setOllamaAdvModel] = useState(
    OllamaModel.LLAMA_3_3_70B,
  );
  const [leitnerSpeed, setLeitnerSpeed] = useState(LeitnerSpeed.Normal);
  const [quizType, setQuizType] = useState(QuizType.InstantResultQuiz);
  const [studyModeForKeywords, setStudyModeForKeywords] = useState(
    StudyMode.General,
  );
  const [showProgressBar, setShowProgressBar] = useState('off');
  const [showTimerPanel, setShowTimerPanel] = useState('none');
  const [useOpenAiImage, setUseOpenAiImage] = useState(false);
  const [useChroma, setUseChroma] = useState(false);
  // Neo4j Graph Database settings
  const [useGraph, setUseGraph] = useState(false);
  const [graphUri, setGraphUri] = useState('bolt://localhost:7687');
  const [graphUsername, setGraphUsername] = useState('neo4j');
  const [graphPassword, setGraphPassword] = useState('');
  const [graphConnecting, setGraphConnecting] = useState(false);
  const [graphConnected, setGraphConnected] = useState(false);
  const [graphError, setGraphError] = useState('');
  const [emojiData, setEmojiData] = useState(null);
  const [commonEmoji, setCommonEmoji] = useState([]);
  const [showPasswords, setShowPasswords] = useState({});

  const cellRef = useRef();
  const [openSampleColorDialog, setOpenSampleColorDialog] = useState(false);

  const [fontFamily, setFontFamily] = useState('Arial');
  const [cardColors, setCardColors] = useState([
    '#000000',
    '#FFFFFF',
    '#000000',
  ]);
  const [cardBgImageNum, setCardBgImageNum] = useState(0);

  const [ClearAllNotes] = useDeleteAllNoteMutation();
  const [ClearAllBooks] = useClearAllBooksMutation();
  const [deleteAllChats] = useDeleteAllChatsMutation();
  const [deleteAllPrompts] = useDeleteAllPromptsMutation();
  const [deleteAllMoodBoards] = useDeleteAllMoodBoardsMutation();

  React.useEffect(() => {
    async function loadSettings() {
      const ts = (await customStorage.getItem('saved_tags')) || [];
      setTags(ts);
      const sm = (await customStorage.getStudyMode()) || StudyMode.General;
      setStudyMode(sm);
      const rl = (await customStorage.getReaderLevel()) || ReaderLevel.College;
      setReaderLevel(rl);
      // Load default models
      const m =
        (await customStorage.getChatGPTModel()) || ChatGPTModel.GPT4_1_MINI;
      setChatGPTModel(m);
      const gm =
        (await customStorage.getGeminiModel()) || GeminiModel.GEMINI_2_5_FLASH;
      setGeminiModel(gm);
      const lm =
        (await customStorage.getClaudeModel()) || ClaudeModel.CLAUDE_HAIKU_4_5;
      setClaudeModel(lm);
      const bm =
        (await customStorage.getBaiduModel()) || BaiduModel.ERNIE_4_5_TURBO;
      setBaiduModel(bm);
      const km = (await customStorage.getKimiModel()) || KimiModel.KIMI_K2;
      setKimiModel(km);
      const dm = (await customStorage.getDoubaoModel()) || DoubaoModel.DOUBAO_PRO_32K;
      setDoubaoModel(dm);
      const qm = (await customStorage.getQwenModel()) || QwenModel.QWEN_PLUS;
      setQwenModel(qm);
      const om =
        (await customStorage.getOllamaModel()) || OllamaModel.LLAMA_3_2_3B;
      setOllamaModel(om);
      // Load advanced models
      const ma =
        (await customStorage.getChatGPTAdvancedModel()) || ChatGPTModel.GPT4_1;
      setChatGPTAdvModel(ma);
      const gma =
        (await customStorage.getGeminiAdvancedModel()) ||
        GeminiModel.GEMINI_2_5_PRO;
      setGeminiAdvModel(gma);
      const lma =
        (await customStorage.getClaudeAdvancedModel()) ||
        ClaudeModel.CLAUDE_OPUS_4_5;
      setClaudeAdvModel(lma);
      const bma =
        (await customStorage.getBaiduAdvancedModel()) || BaiduModel.ERNIE_5;
      setBaiduAdvModel(bma);
      const kma =
        (await customStorage.getKimiAdvancedModel()) || KimiModel.KIMI_K2_5;
      setKimiAdvModel(kma);
      const dma =
        (await customStorage.getDoubaoAdvancedModel()) || DoubaoModel.DOUBAO_SEED_1_6;
      setDoubaoAdvModel(dma);
      const qma =
        (await customStorage.getQwenAdvancedModel()) || QwenModel.QWEN3_MAX;
      setQwenAdvModel(qma);
      const oma =
        (await customStorage.getOllamaAdvancedModel()) ||
        OllamaModel.LLAMA_3_3_70B;
      setOllamaAdvModel(oma);
      const ls = (await customStorage.getLeitnerSpeed()) || LeitnerSpeed.Normal;
      setLeitnerSpeed(ls);
      const ff = await customStorage.getFontFamily();
      setFontFamily(ff);
      const cc = await customStorage.getNoteColorSetting();
      setCardColors(cc);
      const nbg = await customStorage.getNoteBgImage();
      setCardBgImageNum(nbg);
      const qt = await customStorage.getItem('quiz_type');
      if (qt) setQuizType(qt);
      const pb = await customStorage.getItem('quiz_showProgressBar');
      if (pb) setShowProgressBar(pb);
      const tp = await customStorage.getItem('quiz_showTimerPanel');
      if (tp) setShowTimerPanel(tp);
      const key = await customStorage.getOpenAIKey();
      if (key) setOpenAiKey(key);
      const gkey = await customStorage.getGeminiKey();
      if (gkey) setGeminiKey(gkey);
      const ckey = await customStorage.getClaudeKey();
      if (ckey) setClaudeKey(ckey);
      const bkey = await customStorage.getBaiduKey();
      if (bkey) setBaiduKey(bkey);
      const bs = await customStorage.getBaiduSecret();
      if (bs) setBaiduSecret(bs);
      const kkey = await customStorage.getKimiKey();
      if (kkey) setKimiKey(kkey);
      const dkey = await customStorage.getDoubaoKey();
      if (dkey) setDoubaoKey(dkey);
      const qkey = await customStorage.getQwenKey();
      if (qkey) setQwenKey(qkey);
      const ai = await customStorage.getAIProvider();
      if (ai) setAiProvider(ai);
      const url = await customStorage.getServerUrl();
      setServerUrl(url);
      const curl = await customStorage.getChromaUrl();
      setChromaUrl(curl);
      const ourl = await customStorage.getOllamaUrl();
      setOllamaUrl(ourl);
      const image = await customStorage.getOpenAiImage();
      setUseOpenAiImage(image === true || image === 'true');
      const c = await customStorage.getUseChroma();
      setUseChroma(c === true || c === 'true');
      // Load Neo4j settings (ensure boolean conversion)
      const graphEnabled = customStorage.getGraphEnabled();
      setUseGraph(graphEnabled === true || graphEnabled === 'true');
      const guri = customStorage.getGraphUri();
      setGraphUri(guri);
      const guser = customStorage.getGraphUsername();
      setGraphUsername(guser);
      const gpass = customStorage.getGraphPassword();
      setGraphPassword(gpass);
      // Check connection status
      if (graphEnabled) {
        const connected = graphApi.isConnected();
        setGraphConnected(connected);
      }
      const d = await customStorage.emojiData();
      setEmojiData(d);
      const ce = (await customStorage.getItem('common_emoji')) || [];
      setCommonEmoji(ce);
    }
    loadSettings();
  }, []);

  const togglePassword = (field) => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleEmojiDelete = (emojiId) => {
    setCommonEmoji(commonEmoji.filter((e) => e.id !== emojiId));
  };

  const toggleUseOpenAiImage = () => {
    setUseOpenAiImage(!useOpenAiImage);
    customStorage.setOpenAiImage(!useOpenAiImage);
  };

  const toggleUseChroma = () => {
    setUseChroma(!useChroma);
    customStorage.setUseChroma(!useChroma);
  };

  const toggleUseGraph = () => {
    const newValue = !useGraph;
    setUseGraph(newValue);
    customStorage.setGraphEnabled(newValue);
    if (!newValue) {
      setGraphConnected(false);
      setGraphError('');
    }
  };

  const saveGraphSettings = () => {
    customStorage.setGraphUri(graphUri);
    customStorage.setGraphUsername(graphUsername);
    customStorage.setGraphPassword(graphPassword);
  };

  const testGraphConnection = async () => {
    setGraphConnecting(true);
    setGraphError('');
    try {
      // Save settings first
      saveGraphSettings();
      // Attempt connection
      const result = await graphApi.connect();
      if (result.success) {
        setGraphConnected(true);
        setGraphError('');
      } else {
        setGraphConnected(false);
        setGraphError(result.error || 'Connection failed');
      }
    } catch (e) {
      setGraphConnected(false);
      setGraphError(e.message || 'Connection error');
    } finally {
      setGraphConnecting(false);
    }
  };

  async function tryImportWordFrequencyFile() {
    await window.electron.ipcRenderer.importWordFrequencyFromFile();
  }

  async function tryImportKeywordsFile() {
    await window.electron.ipcRenderer.importKeywordsFromFile(
      studyModeForKeywords,
    );
  }

  const onImageChange = (imageIndex) => {
    setCardBgImageNum(imageIndex);
    customStorage.setNoteBgImage(imageIndex);
  };

  const onColorChange = (colors) => {
    setCardColors(colors);
    customStorage.setNoteColorSetting(colors);
  };

  const onFontChange = (font) => {
    setFontFamily(font);
    customStorage.setFontFamily(font);
  };

  const saveAIProvider = (provider, additionalSave) => {
    customStorage.setAIProvider(provider);
    if (additionalSave) additionalSave();
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Settings</PageTitle>
        <PageSubtitle>
          Manage your app preferences and configurations
        </PageSubtitle>
      </PageHeader>

      {/* Appearance */}
      <SettingsSectionWrapper
        icon={<PaletteIcon />}
        title="Appearance"
        color="#611f69"
      >
        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Theme</SettingLabelText>
            <SettingLabelHint>
              Switch between light and dark mode
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <ThemeToggleButton />
          </SettingControl>
        </SettingRow>
      </SettingsSectionWrapper>

      {/* AI Providers */}
      <SettingsSectionWrapper
        icon={<SmartToyIcon />}
        title="AI Providers"
        color="#1d9bd1"
      >
        <ProviderSpendStats />
        {/* OpenAI */}
        <ProviderCard
          selected={aiProvider === AIProvider.ChatGPT}
          onClick={() => setAiProvider(AIProvider.ChatGPT)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                OpenAI
              </Typography>
              {aiProvider === AIProvider.ChatGPT && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={openAiKey}
                type={showPasswords.openai ? 'text' : 'password'}
                onChange={(e) => setOpenAiKey(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('openai')}
                      >
                        {showPasswords.openai ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={chatGPTModel}
                  onChange={(e) => setChatGPTModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={ChatGPTModel.GPT4_1_NANO}>
                    GPT-4.1 Nano
                  </MenuItem>
                  <MenuItem value={ChatGPTModel.GPT4_1_MINI}>
                    GPT-4.1 Mini
                  </MenuItem>
                  <MenuItem value={ChatGPTModel.GPT4O_MINI}>
                    GPT-4o Mini
                  </MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={chatGPTAdvModel}
                  onChange={(e) => setChatGPTAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={ChatGPTModel.GPT4_1}>GPT-4.1</MenuItem>
                  <MenuItem value={ChatGPTModel.GPT4O}>GPT-4o</MenuItem>
                  <MenuItem value={ChatGPTModel.GPT5_MINI}>GPT-5 Mini</MenuItem>
                  <MenuItem value={ChatGPTModel.GPT5}>GPT-5</MenuItem>
                  <MenuItem value={ChatGPTModel.O4_MINI}>o4-mini</MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setOpenAIKey(openAiKey);
                  customStorage.setChatGPTModel(chatGPTModel);
                  customStorage.setChatGPTAdvancedModel(chatGPTAdvModel);
                  saveAIProvider(AIProvider.ChatGPT);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={useOpenAiImage}
                    onChange={toggleUseOpenAiImage}
                    size="small"
                  />
                }
                label={
                  <Typography
                    sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}
                  >
                    Enable Image Generation
                  </Typography>
                }
              />
            </Box>
            <ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />
          </Box>
        </ProviderCard>

        {/* Gemini */}
        <ProviderCard
          selected={aiProvider === AIProvider.Gemini}
          onClick={() => setAiProvider(AIProvider.Gemini)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Google Gemini
              </Typography>
              {aiProvider === AIProvider.Gemini && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={geminiKey}
                type={showPasswords.gemini ? 'text' : 'password'}
                onChange={(e) => setGeminiKey(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('gemini')}
                      >
                        {showPasswords.gemini ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '150px' }}
                >
                  <MenuItem value={GeminiModel.GEMINI_2_FLASH}>
                    Gemini 2.0 Flash
                  </MenuItem>
                  <MenuItem value={GeminiModel.GEMINI_2_5_FLASH}>
                    Gemini 2.5 Flash
                  </MenuItem>
                  <MenuItem value={GeminiModel.GEMINI_2_5_FLASH_LITE}>
                    Gemini 2.5 Flash Lite
                  </MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={geminiAdvModel}
                  onChange={(e) => setGeminiAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={GeminiModel.GEMINI_2_5_PRO}>
                    Gemini 2.5 Pro
                  </MenuItem>
                  <MenuItem value={GeminiModel.GEMINI_3_FLASH}>
                    Gemini 3 Flash
                  </MenuItem>
                  <MenuItem value={GeminiModel.GEMINI_3_PRO}>
                    Gemini 3 Pro
                  </MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setGeminiKey(geminiKey);
                  customStorage.setGeminiModel(geminiModel);
                  customStorage.setGeminiAdvancedModel(geminiAdvModel);
                  saveAIProvider(AIProvider.Gemini);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="gemini" label="Google Gemini" />
          </Box>
        </ProviderCard>

        {/* Claude */}
        <ProviderCard
          selected={aiProvider === AIProvider.Claude}
          onClick={() => setAiProvider(AIProvider.Claude)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Anthropic Claude
              </Typography>
              {aiProvider === AIProvider.Claude && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={claudeKey}
                type={showPasswords.claude ? 'text' : 'password'}
                onChange={(e) => setClaudeKey(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('claude')}
                      >
                        {showPasswords.claude ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={claudeModel}
                  onChange={(e) => setClaudeModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '150px' }}
                >
                  <MenuItem value={ClaudeModel.CLAUDE_HAIKU_4_5}>
                    Haiku 4.5
                  </MenuItem>
                  <MenuItem value={ClaudeModel.CLAUDE_SONNET_4}>
                    Sonnet 4
                  </MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={claudeAdvModel}
                  onChange={(e) => setClaudeAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={ClaudeModel.CLAUDE_SONNET_4_5}>
                    Sonnet 4.5
                  </MenuItem>
                  <MenuItem value={ClaudeModel.CLAUDE_OPUS_4_5}>
                    Opus 4.5
                  </MenuItem>
                  <MenuItem value={ClaudeModel.CLAUDE_OPUS_4_6}>
                    Opus 4.6
                  </MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setClaudeKey(claudeKey);
                  customStorage.setClaudeModel(claudeModel);
                  customStorage.setClaudeAdvancedModel(claudeAdvModel);
                  saveAIProvider(AIProvider.Claude);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="claude" label="Anthropic Claude" />
          </Box>
        </ProviderCard>

        {/* Baidu */}
        <ProviderCard
          selected={aiProvider === AIProvider.Baidu}
          onClick={() => setAiProvider(AIProvider.Baidu)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                百度 ERNIE
              </Typography>
              {aiProvider === AIProvider.Baidu && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={baiduKey}
                type={showPasswords.baidu ? 'text' : 'password'}
                onChange={(e) => setBaiduKey(e.target.value)}
                sx={{ width: '160px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <StyledTextField
                size="small"
                placeholder="Secret Key"
                value={baiduSecret}
                type={showPasswords.baidu ? 'text' : 'password'}
                onChange={(e) => setBaiduSecret(e.target.value)}
                sx={{ width: '160px' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('baidu')}
                      >
                        {showPasswords.baidu ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={baiduModel}
                  onChange={(e) => setBaiduModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={BaiduModel.ERNIE_4_5_FLASH}>
                    ERNIE 4.5 Flash
                  </MenuItem>
                  <MenuItem value={BaiduModel.ERNIE_4_5_TURBO}>
                    ERNIE 4.5 Turbo
                  </MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={baiduAdvModel}
                  onChange={(e) => setBaiduAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '120px' }}
                >
                  <MenuItem value={BaiduModel.ERNIE_4_5}>ERNIE 4.5</MenuItem>
                  <MenuItem value={BaiduModel.ERNIE_5}>ERNIE 5.0</MenuItem>
                  <MenuItem value={BaiduModel.ERNIE_X1}>ERNIE X1</MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setBaiduKey(baiduKey);
                  customStorage.setBaiduSecret(baiduSecret);
                  customStorage.setBaiduModel(baiduModel);
                  customStorage.setBaiduAdvancedModel(baiduAdvModel);
                  saveAIProvider(AIProvider.Baidu);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="baidu" label="百度 ERNIE" />
          </Box>
        </ProviderCard>

        {/* Kimi */}
        <ProviderCard
          selected={aiProvider === AIProvider.Kimi}
          onClick={() => setAiProvider(AIProvider.Kimi)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                月之暗面 Kimi
              </Typography>
              {aiProvider === AIProvider.Kimi && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={kimiKey}
                type={showPasswords.kimi ? 'text' : 'password'}
                onChange={(e) => setKimiKey(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('kimi')}
                      >
                        {showPasswords.kimi ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={kimiModel}
                  onChange={(e) => setKimiModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '130px' }}
                >
                  <MenuItem value={KimiModel.KIMI_K2_LITE}>
                    Kimi K2 Lite
                  </MenuItem>
                  <MenuItem value={KimiModel.KIMI_K2}>Kimi K2</MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={kimiAdvModel}
                  onChange={(e) => setKimiAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={KimiModel.KIMI_K2_5}>Kimi K2.5</MenuItem>
                  <MenuItem value={KimiModel.KIMI_K2_5_THINKING}>
                    Kimi K2.5 Thinking
                  </MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setKimiKey(kimiKey);
                  customStorage.setKimiModel(kimiModel);
                  customStorage.setKimiAdvancedModel(kimiAdvModel);
                  saveAIProvider(AIProvider.Kimi);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="kimi" label="月之暗面 Kimi" />
          </Box>
        </ProviderCard>

        {/* Doubao */}
        <ProviderCard
          selected={aiProvider === AIProvider.Doubao}
          onClick={() => setAiProvider(AIProvider.Doubao)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                字节跳动 豆包
              </Typography>
              {aiProvider === AIProvider.Doubao && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={doubaoKey}
                type={showPasswords.doubao ? 'text' : 'password'}
                onChange={(e) => setDoubaoKey(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('doubao')}
                      >
                        {showPasswords.doubao ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={doubaoModel}
                  onChange={(e) => setDoubaoModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '150px' }}
                >
                  <MenuItem value={DoubaoModel.DOUBAO_1_5_LITE_32K}>
                    Doubao 1.5 Lite 32K
                  </MenuItem>
                  <MenuItem value={DoubaoModel.DOUBAO_PRO_32K}>
                    Doubao Pro 32K
                  </MenuItem>
                  <MenuItem value={DoubaoModel.DOUBAO_SEED_1_6_FLASH}>
                    Doubao Seed 1.6 Flash
                  </MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={doubaoAdvModel}
                  onChange={(e) => setDoubaoAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '160px' }}
                >
                  <MenuItem value={DoubaoModel.DOUBAO_1_5_PRO_256K}>
                    Doubao 1.5 Pro 256K
                  </MenuItem>
                  <MenuItem value={DoubaoModel.DOUBAO_SEED_1_6}>
                    Doubao Seed 1.6
                  </MenuItem>
                  <MenuItem value={DoubaoModel.DOUBAO_SEED_1_8}>
                    Doubao Seed 1.8
                  </MenuItem>
                  <MenuItem value={DoubaoModel.DOUBAO_SEED_1_6_THINKING}>
                    Doubao Seed 1.6 Thinking
                  </MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setDoubaoKey(doubaoKey);
                  customStorage.setDoubaoModel(doubaoModel);
                  customStorage.setDoubaoAdvancedModel(doubaoAdvModel);
                  saveAIProvider(AIProvider.Doubao);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="doubao" label="字节跳动 豆包" />
          </Box>
        </ProviderCard>

        {/* Qwen */}
        <ProviderCard
          selected={aiProvider === AIProvider.Qwen}
          onClick={() => setAiProvider(AIProvider.Qwen)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                阿里云 通义千问
              </Typography>
              {aiProvider === AIProvider.Qwen && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="API Key"
                value={qwenKey}
                type={showPasswords.qwen ? 'text' : 'password'}
                onChange={(e) => setQwenKey(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <KeyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => togglePassword('qwen')}
                      >
                        {showPasswords.qwen ? (
                          <VisibilityOffIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={qwenModel}
                  onChange={(e) => setQwenModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '130px' }}
                >
                  <MenuItem value={QwenModel.QWEN_TURBO}>Qwen Turbo</MenuItem>
                  <MenuItem value={QwenModel.QWEN_FLASH}>Qwen Flash</MenuItem>
                  <MenuItem value={QwenModel.QWEN3_5_FLASH}>Qwen 3.5 Flash</MenuItem>
                  <MenuItem value={QwenModel.QWEN_PLUS}>Qwen Plus</MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={qwenAdvModel}
                  onChange={(e) => setQwenAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '130px' }}
                >
                  <MenuItem value={QwenModel.QWEN3_5_PLUS}>Qwen 3.5 Plus</MenuItem>
                  <MenuItem value={QwenModel.QWEN_MAX}>Qwen Max</MenuItem>
                  <MenuItem value={QwenModel.QWEN3_MAX}>Qwen 3 Max</MenuItem>
                  <MenuItem value={QwenModel.QWQ_PLUS}>QwQ Plus</MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setQwenKey(qwenKey);
                  customStorage.setQwenModel(qwenModel);
                  customStorage.setQwenAdvancedModel(qwenAdvModel);
                  saveAIProvider(AIProvider.Qwen);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="qwen" label="阿里云 通义千问" />
          </Box>
        </ProviderCard>

        {/* Ollama */}
        <ProviderCard
          selected={aiProvider === AIProvider.Ollama}
          onClick={() => setAiProvider(AIProvider.Ollama)}
        >
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                Ollama (Local)
              </Typography>
              {aiProvider === AIProvider.Ollama && (
                <CheckCircleIcon sx={{ fontSize: 16, color: '#2eb67d' }} />
              )}
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
                mb: 1,
              }}
            >
              <StyledTextField
                size="small"
                placeholder="http://localhost:11434"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                sx={{ width: '280px' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LinkIcon
                        sx={{ fontSize: 16, color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Default Model
                </Typography>
                <StyledSelect
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '130px' }}
                >
                  <MenuItem value={OllamaModel.LLAMA_3_2_3B}>
                    Llama 3.2 3B
                  </MenuItem>
                  <MenuItem value={OllamaModel.QWEN_2_5_7B}>
                    Qwen 2.5 7B
                  </MenuItem>
                  <MenuItem value={OllamaModel.MISTRAL_7B}>Mistral 7B</MenuItem>
                </StyledSelect>
              </Box>
              <Box>
                <Typography
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 0.5 }}
                >
                  Advanced Model
                </Typography>
                <StyledSelect
                  value={ollamaAdvModel}
                  onChange={(e) => setOllamaAdvModel(e.target.value)}
                  size="small"
                  sx={{ minWidth: '140px' }}
                >
                  <MenuItem value={OllamaModel.LLAMA_3_3_70B}>
                    Llama 3.3 70B
                  </MenuItem>
                  <MenuItem value={OllamaModel.QWEN_2_5_72B}>
                    Qwen 2.5 72B
                  </MenuItem>
                  <MenuItem value={OllamaModel.DEEPSEEK_R1}>
                    DeepSeek R1 32B
                  </MenuItem>
                </StyledSelect>
              </Box>
              <SaveButton
                onClick={() => {
                  customStorage.setOllamaUrl(ollamaUrl);
                  customStorage.setOllamaModel(ollamaModel);
                  customStorage.setOllamaAdvancedModel(ollamaAdvModel);
                  saveAIProvider(AIProvider.Ollama);
                }}
              >
                Save
              </SaveButton>
            </Box>
            <ProviderPricingOverride providerKey="ollama" label="Ollama (Local)" />
          </Box>
        </ProviderCard>
      </SettingsSectionWrapper>

      {/* Server Settings */}
      <SettingsSectionWrapper
        icon={<StorageIcon />}
        title="Server Connections"
        color="#ecb22e"
        defaultExpanded={false}
      >
        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Book Server URL</SettingLabelText>
            <SettingLabelHint>
              Connect to a remote book server for library sync
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <StyledTextField
              size="small"
              placeholder="https://example.com/api"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              sx={{ width: '260px' }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
            />
            <SaveButton onClick={() => customStorage.setServerUrl(serverUrl)}>
              Save
            </SaveButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>ChromaDB URL</SettingLabelText>
            <SettingLabelHint>
              Vector database for semantic search
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <Switch
              checked={useChroma}
              onChange={toggleUseChroma}
              size="small"
            />
            <StyledTextField
              size="small"
              placeholder="http://localhost:8000"
              value={chromaUrl}
              disabled={!useChroma}
              onChange={(e) => setChromaUrl(e.target.value)}
              sx={{ width: '220px' }}
            />
            <SaveButton
              disabled={!useChroma}
              onClick={() => customStorage.setChromaUrl(chromaUrl)}
            >
              Save
            </SaveButton>
          </SettingControl>
        </SettingRow>

        {/* Neo4j Knowledge Graph */}
        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: (theme) =>
              theme.palette.mode === 'dark'
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <HubIcon sx={{ color: '#2eb67d', fontSize: 20 }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Neo4j Knowledge Graph
            </Typography>
            <Switch checked={useGraph} onChange={toggleUseGraph} size="small" />
            {graphConnected && (
              <Chip
                icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                label="Connected"
                size="small"
                sx={{
                  backgroundColor: 'rgba(46,182,125,0.15)',
                  color: '#2eb67d',
                  fontSize: '0.75rem',
                  height: '24px',
                }}
              />
            )}
          </Box>
          <Typography
            sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}
          >
            Enable knowledge graph features: learning paths, concept tracking,
            weak areas detection, and knowledge visualization.
          </Typography>

          {useGraph && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  mb: 1,
                }}
              >
                <StyledTextField
                  size="small"
                  placeholder="bolt://localhost:7687"
                  value={graphUri}
                  onChange={(e) => setGraphUri(e.target.value)}
                  sx={{ width: '220px' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon
                          sx={{ fontSize: 16, color: 'text.secondary' }}
                        />
                      </InputAdornment>
                    ),
                  }}
                />
                <StyledTextField
                  size="small"
                  placeholder="Username"
                  value={graphUsername}
                  onChange={(e) => setGraphUsername(e.target.value)}
                  sx={{ width: '120px' }}
                />
                <StyledTextField
                  size="small"
                  placeholder="Password"
                  type={showPasswords.neo4j ? 'text' : 'password'}
                  value={graphPassword}
                  onChange={(e) => setGraphPassword(e.target.value)}
                  sx={{ width: '140px' }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => togglePassword('neo4j')}
                        >
                          {showPasswords.neo4j ? (
                            <VisibilityOffIcon sx={{ fontSize: 16 }} />
                          ) : (
                            <VisibilityIcon sx={{ fontSize: 16 }} />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              <Box
                sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}
              >
                <Button
                  variant="outlined"
                  size="small"
                  onClick={testGraphConnection}
                  disabled={graphConnecting}
                  startIcon={
                    graphConnecting ? (
                      <CircularProgress size={14} />
                    ) : (
                      <SyncIcon sx={{ fontSize: 16 }} />
                    )
                  }
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    borderColor: graphConnected ? '#2eb67d' : undefined,
                    color: graphConnected ? '#2eb67d' : undefined,
                  }}
                >
                  {graphConnecting ? 'Connecting...' : 'Test Connection'}
                </Button>
                <SaveButton onClick={saveGraphSettings}>Save</SaveButton>
              </Box>
              {graphError && (
                <Alert
                  severity="error"
                  icon={<ErrorOutlineIcon sx={{ fontSize: 18 }} />}
                  sx={{ mt: 1, fontSize: '0.8125rem', py: 0.5 }}
                >
                  {graphError}
                </Alert>
              )}
            </>
          )}
        </Box>
      </SettingsSectionWrapper>

      {/* Study Settings */}
      <SettingsSectionWrapper
        icon={<TuneIcon />}
        title="Study Preferences"
        color="#2eb67d"
      >
        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Reader Level</SettingLabelText>
            <SettingLabelHint>
              Adjusts content difficulty for AI explanations
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <StyledSelect
              value={readerLevel}
              onChange={(e) => setReaderLevel(e.target.value)}
              size="small"
            >
              <MenuItem value={ReaderLevel.Elementary}>Elementary</MenuItem>
              <MenuItem value={ReaderLevel.Middle}>Middle School</MenuItem>
              <MenuItem value={ReaderLevel.College}>College</MenuItem>
            </StyledSelect>
            <SaveButton
              onClick={() => customStorage.setReaderLevel(readerLevel)}
            >
              Save
            </SaveButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Study Mode</SettingLabelText>
            <SettingLabelHint>
              Optimize AI responses for your learning focus
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <StyledSelect
              value={studyMode}
              onChange={(e) => setStudyMode(e.target.value)}
              size="small"
            >
              <MenuItem value={StudyMode.General}>General</MenuItem>
              <MenuItem value={StudyMode.Language}>Language Study</MenuItem>
              <MenuItem value={StudyMode.Math}>Mathematics</MenuItem>
              <MenuItem value={StudyMode.Program}>Programming</MenuItem>
            </StyledSelect>
            <SaveButton onClick={() => customStorage.setStudyMode(studyMode)}>
              Save
            </SaveButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Leitner Speed</SettingLabelText>
            <SettingLabelHint>
              How quickly cards move through the spaced repetition system
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <StyledSelect
              value={leitnerSpeed}
              onChange={(e) => setLeitnerSpeed(e.target.value)}
              size="small"
            >
              <MenuItem value={LeitnerSpeed.Fast}>Fast</MenuItem>
              <MenuItem value={LeitnerSpeed.Normal}>Normal</MenuItem>
              <MenuItem value={LeitnerSpeed.Slow}>Slow</MenuItem>
            </StyledSelect>
            <SaveButton
              onClick={() => customStorage.setLeitnerSpeed(leitnerSpeed)}
            >
              Save
            </SaveButton>
          </SettingControl>
        </SettingRow>

        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: (theme) =>
              theme.palette.mode === 'dark'
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
            Keywords Management
          </Typography>
          <Typography
            sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}
          >
            Import keywords for highlighting. Each study mode has its own
            keyword list.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <StyledSelect
              value={studyModeForKeywords}
              onChange={(e) => setStudyModeForKeywords(e.target.value)}
              size="small"
            >
              <MenuItem value={StudyMode.General}>General</MenuItem>
              <MenuItem value={StudyMode.Language}>Language Study</MenuItem>
              <MenuItem value={StudyMode.Math}>Mathematics</MenuItem>
              <MenuItem value={StudyMode.Program}>Programming</MenuItem>
            </StyledSelect>
            <SaveButton onClick={tryImportKeywordsFile}>
              Import Keywords
            </SaveButton>
          </Box>
          <WordListManagerUI studyModeForKeywords={studyModeForKeywords} />
        </Box>

        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: (theme) =>
              theme.palette.mode === 'dark'
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
            Word Colors
          </Typography>
          <Typography
            sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}
          >
            Import word frequency data for color-coded vocabulary highlighting.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <SaveButton onClick={tryImportWordFrequencyFile}>
              Import Word Colors
            </SaveButton>
            <Button
              ref={cellRef}
              variant="outlined"
              size="small"
              sx={{ textTransform: 'none', fontSize: '0.8125rem' }}
              onClick={() => setOpenSampleColorDialog(true)}
            >
              Show Sample
            </Button>
          </Box>
          {cellRef.current && (
            <ShowSampleColorDialog
              anchorEl={cellRef}
              handleWindowClose={() => setOpenSampleColorDialog(false)}
              open={openSampleColorDialog}
            />
          )}
        </Box>

        <Box
          sx={{
            mt: 2,
            pt: 2,
            borderTop: (theme) =>
              theme.palette.mode === 'dark'
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
            Tags
          </Typography>
          <TagsInputStyled
            value={tags}
            onChange={(newTags) => setTags(newTags)}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <SaveButton
              onClick={() => customStorage.setItem('saved_tags', tags)}
            >
              Save Tags
            </SaveButton>
          </Box>
        </Box>
      </SettingsSectionWrapper>

      {/* Note Appearance */}
      <SettingsSectionWrapper
        icon={<PaletteIcon />}
        title="Note Appearance"
        color="#e01e5a"
        defaultExpanded={false}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, mb: 1 }}>
              Font Family
            </Typography>
            <FontSelector onFontChange={onFontChange} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, mb: 1 }}>
              Colors
            </Typography>
            <ColorMultiplePicker onColorChange={onColorChange} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, mb: 1 }}>
              Background
            </Typography>
            <ImageSelector onImageChange={onImageChange} />
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: 3,
            pt: 2,
            borderTop: (theme) =>
              theme.palette.mode === 'dark'
                ? '1px solid rgba(255,255,255,0.05)'
                : '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 2 }}>
            Quick Emojis
          </Typography>
          <Box sx={{ maxHeight: '280px', overflow: 'auto', mb: 2 }}>
            <Picker
              data={emojiData}
              onEmojiSelect={(e) => setCommonEmoji([...commonEmoji, e])}
              theme="auto"
              previewPosition="none"
            />
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
            {commonEmoji.map((emoji, index) => (
              <Chip
                key={index}
                label={emoji.native}
                onDelete={() => handleEmojiDelete(emoji.id)}
                sx={{
                  backgroundColor: '#2eb67d',
                  color: '#fff',
                  '& .MuiChip-deleteIcon': {
                    color: 'rgba(255,255,255,0.7)',
                    '&:hover': {
                      color: '#fff',
                    },
                  },
                }}
              />
            ))}
          </Stack>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <SaveButton
              onClick={() => customStorage.setItem('common_emoji', commonEmoji)}
            >
              Save Emojis
            </SaveButton>
          </Box>
        </Box>
      </SettingsSectionWrapper>

      {/* Sound Effects & AI Cache Settings */}
      <SettingsSectionWrapper
        icon={<VolumeUpIcon />}
        title="Sound Effects & AI Cache"
        color="#9c27b0"
        defaultExpanded={false}
      >
        <SoundSettingsSection />
      </SettingsSectionWrapper>

      {/* AI Learning Brain Settings */}
      <SettingsSectionWrapper
        icon={<PsychologyIcon />}
        title="AI Learning Brain"
        color="#00bcd4"
        defaultExpanded={false}
      >
        <BrainSettingsSection />
      </SettingsSectionWrapper>

      {/* Quiz Settings */}
      <SettingsSectionWrapper
        icon={<QuizIcon />}
        title="Quiz Settings"
        color="#1d9bd1"
        defaultExpanded={false}
      >
        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Quiz Type</SettingLabelText>
            <SettingLabelHint>
              Choose between instant feedback or final score mode
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <RadioGroup
              row
              value={quizType}
              onChange={(e) => {
                setQuizType(e.target.value);
                customStorage.setItem('quiz_type', e.target.value);
              }}
            >
              <FormControlLabel
                value={QuizType.InstantResultQuiz}
                control={<Radio size="small" />}
                label={
                  <Typography sx={{ fontSize: '0.875rem' }}>
                    Instant Feedback
                  </Typography>
                }
              />
              <FormControlLabel
                value={QuizType.ScoredQuiz}
                control={<Radio size="small" />}
                label={
                  <Typography sx={{ fontSize: '0.875rem' }}>
                    Scored Quiz
                  </Typography>
                }
              />
            </RadioGroup>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Progress Bar</SettingLabelText>
          </SettingLabel>
          <SettingControl>
            <StyledSelect
              value={showProgressBar}
              onChange={(e) => {
                setShowProgressBar(e.target.value);
                customStorage.setItem('quiz_showProgressBar', e.target.value);
              }}
              size="small"
            >
              <MenuItem value="top">Top</MenuItem>
              <MenuItem value="bottom">Bottom</MenuItem>
              <MenuItem value="off">Off</MenuItem>
            </StyledSelect>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Timer Panel</SettingLabelText>
          </SettingLabel>
          <SettingControl>
            <StyledSelect
              value={showTimerPanel}
              onChange={(e) => {
                setShowTimerPanel(e.target.value);
                customStorage.setItem('quiz_showTimerPanel', e.target.value);
              }}
              size="small"
            >
              <MenuItem value="top">Top</MenuItem>
              <MenuItem value="bottom">Bottom</MenuItem>
              <MenuItem value="none">Hidden</MenuItem>
            </StyledSelect>
          </SettingControl>
        </SettingRow>
      </SettingsSectionWrapper>

      {/* Danger Zone */}
      <SettingsSectionWrapper
        icon={<DeleteForeverIcon />}
        title="Data Management"
        color="#e01e5a"
        defaultExpanded={false}
      >
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.8125rem' }}>
          These actions are permanent and cannot be undone. Please proceed with
          caution.
        </Alert>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Clear All Notes</SettingLabelText>
            <SettingLabelHint>
              Permanently delete all saved notes
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <DangerButton onClick={ClearAllNotes}>Delete</DangerButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Clear All Books</SettingLabelText>
            <SettingLabelHint>
              Remove all books from your library
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <DangerButton onClick={ClearAllBooks}>Delete</DangerButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Clear All Chats</SettingLabelText>
            <SettingLabelHint>
              Delete all AI conversation history
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <DangerButton onClick={deleteAllChats}>Delete</DangerButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Clear All Prompts</SettingLabelText>
            <SettingLabelHint>
              Remove all saved prompt templates
            </SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <DangerButton onClick={deleteAllPrompts}>Delete</DangerButton>
          </SettingControl>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingLabelText>Clear All Mood Boards</SettingLabelText>
            <SettingLabelHint>Delete all mood board diagrams</SettingLabelHint>
          </SettingLabel>
          <SettingControl>
            <DangerButton onClick={deleteAllMoodBoards}>Delete</DangerButton>
          </SettingControl>
        </SettingRow>
      </SettingsSectionWrapper>
    </PageContainer>
  );
}
