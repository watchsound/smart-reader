import React, { useRef } from 'react';
import {
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Paper,
  Box,
  Chip,
  Stack,
  Checkbox,
  FormGroup,
  MenuItem,
  Select,
  TextField,
  Divider,
  Grid,
} from '@mui/material';

import { styled } from '@mui/system';
import { grey, blue } from '@mui/material/colors';

import TagsInput from 'react-tagsinput';
// import NotesContext from './NotesContext';
import 'react-tagsinput/react-tagsinput.css';

import Picker from '@emoji-mart/react';

import customStorage from '../../store/customStorage';
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
} from '../../../commons/model/DataTypes';
import { useDeleteAllNoteMutation } from '../../store/api/noteApiSlice';
import { useClearAllBooksMutation } from '../../store/api/bookApiSlice';
import {
  useDeleteAllChatsMutation,
  useDeleteAllPromptsMutation,
} from '../../store/api/chatApiSlice';
import { useDeleteAllMoodBoardsMutation } from '../../store/api/moodBoardApiSlice';
import SmallButton from '../../components/Button/SmallButton';
import ThemeToggleButton from '../../components/ThemeToggleButton';
import WordListManagerUI from './WordListManagerUI';
import ColorMultiplePicker from '../../components/ColorMultiplePicker';
import ImageSelector from '../../components/ImageSelector';
import FontSelector from '../../components/FontSelector';
import ShowSampleColorDialog from './ShowSampleColorDialog';

const TagsInputNoBorder = styled(TagsInput)({
  backgroundColor: '#fff0',
  border: '1px solid #0000 !important',
  overflow: 'hidden',
  paddingLeft: '5px',
});

export default function SettingsPanel() {
  const [source, setSource] = React.useState('async');
  const [condition, setCondition] = React.useState('failure');
  const [tags, setTags] = React.useState([]);
  const [openAiKey, setOpenAiKey] = React.useState('');
  const [geminiKey, setGeminiKey] = React.useState('');
  const [claudeKey, setClaudeKey] = React.useState('');
  const [baiduKey, setBaiduKey] = React.useState('');
  const [baiduSecret, setBaiduSecret] = React.useState('');
  const [kimiKey, setKimiKey] = React.useState('');
  const [aiProvider, setAiProvider] = React.useState('');

  const [serverUrl, setServerUrl] = React.useState('');
  const [chromaUrl, setChromaUrl] = React.useState('');
  const [studyMode, setStudyMode] = React.useState(StudyMode.General);
  const [readerLevel, setReaderLevel] = React.useState(ReaderLevel.College);
  const [chatGPTModel, setChatGPTModel] = React.useState(ChatGPTModel.GPT3_5);
  const [geminiModel, setGeminiModel] = React.useState(
    GeminiModel.GEMINI1_5_flash,
  );
  const [claudeModel, setClaudeModel] = React.useState(
    ClaudeModel.CLAUDE_3_HAIKU,
  );
  const [leitnerSpeed, setLeitnerSpeed] = React.useState(LeitnerSpeed.Normal);
  const [quizType, setQuizType] = React.useState(QuizType.InstantResultQuiz);
  const [studyModeForKeywords, setStudyModeForKeywords] = React.useState(
    StudyMode.General,
  );
  const [showProgressBar, setShowProgressBar] = React.useState('off');
  const [showTimerPanel, setShowTimerPanel] = React.useState('none');
  const [useOpenAiImage, setUseOpenAiImage] = React.useState(false);
  const [useChroma, setUseChroma] = React.useState(false);
  const [emojiData, setEmojiData] = React.useState(null);
  const [commonEmoji, setCommonEmoji] = React.useState([]);

  const cellRef = useRef();
  const [openSampleColorDialog, setOpenSampleColorDialog] =
    React.useState(false);

  const [fontFamily, setFontFamily] = React.useState('Arial');
  const [cardColors, setCardColors] = React.useState([
    '#000000',
    '#FFFFFF',
    '#000000',
  ]);
  const [cardBgImageNum, setCardBgImageNum] = React.useState(0);

  const [ClearAllNotes] = useDeleteAllNoteMutation();
  const [ClearAllBooks] = useClearAllBooksMutation();
  const [deleteAllChats] = useDeleteAllChatsMutation();
  const [deleteAllPrompts] = useDeleteAllPromptsMutation();
  const [deleteAllMoodBoards] = useDeleteAllMoodBoardsMutation();

  React.useEffect(() => {
    async function t() {
      const ts = (await customStorage.getItem('saved_tags')) || [];
      setTags(ts);
      const sm = (await customStorage.getStudyMode()) || StudyMode.General;
      setStudyMode(sm);
      const rl = (await customStorage.getReaderLevel()) || ReaderLevel.College;
      setReaderLevel(rl);
      const m = (await customStorage.getChatGPTModel()) || ChatGPTModel.GPT3_5;
      setChatGPTModel(m);
      const gm =
        (await customStorage.getGeminiModel()) || GeminiModel.GEMINI1_5_flash;
      setGeminiModel(gm);
      const lm =
        (await customStorage.getClaudeModel()) || ClaudeModel.CLAUDE_3_HAIKU;
      setClaudeModel(lm);
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
      const ai = await customStorage.getAIProvider();
      if (ai) setAiProvider(ai);
      const url = await customStorage.getServerUrl();
      setServerUrl(url);
      const curl = await customStorage.getChromaUrl();
      setChromaUrl(curl);

      const image = await customStorage.getOpenAiImage();
      setUseOpenAiImage(image);
      const c = await customStorage.getUseChroma();
      setUseChroma(c);
      const d = await customStorage.emojiData();
      setEmojiData(d);
      const ce = (await customStorage.getItem('common_emoji')) || [];
      setCommonEmoji(ce);
    }
    t();
  }, []);

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

  const handleStudyModeChange = (event) => {
    setStudyMode(event.target.value || StudyMode.General);
  };
  const handleReaderLevelChange = (event) => {
    setReaderLevel(event.target.value || ReaderLevel.College);
  };
  const handleChatGPTModelChange = (event) => {
    setChatGPTModel(event.target.value || ChatGPTModel.GPT3_5);
  };
  const handleGeminiModelChange = (event) => {
    setGeminiModel(event.target.value || GeminiModel.GEMINI1_5_flash);
  };
  const handleClaudeModelChange = (event) => {
    setClaudeModel(event.target.value || ClaudeModel.CLAUDE_3_HAIKU);
  };
  const handleLeitnerSpeedChange = (event) => {
    setLeitnerSpeed(event.target.value || LeitnerSpeed.Normal);
  };

  const handleStudyModeForKeywordsChange = async (event) => {
    setStudyModeForKeywords(event.target.value);
    // const v = customStorage.getKeyWordList(event.target.value);
    // if (v && v.length > 0) {
    //   setKeyWords(v.join('\n'));
    // }
  };
  const handleShowProgressBarChange = async (event) => {
    setShowProgressBar(event.target.value);
    customStorage.setItem('quiz_showProgressBar', event.target.value);
  };
  const handleShowTimerPanelChange = async (event) => {
    setShowTimerPanel(event.target.value);
    customStorage.setItem('quiz_showTimerPanel', event.target.value);
  };
  async function tryImportWordFrequencyFile() {
    const success =
      await window.electron.ipcRenderer.importWordFrequencyFromFile();
  }
  async function tryImportKeywordsFile() {
    const success =
      await window.electron.ipcRenderer.importKeywordsFromFile(
        studyModeForKeywords,
      );
  }

  const changeQuizType = async (event) => {
    setQuizType(event.target.value);
    customStorage.setItem('quiz_type', event.target.value);
  };

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

  return (
    <Paper elevation={3} style={{ padding: '20px', margin: '20px' }}>
      <div>
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">Toggle Theme</div>
            <div className="two_end_end">
              <ThemeToggleButton />
            </div>
          </div>
        </Box>

        <FormLabel component="legend">Book Server Url</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <TextField
                id="server-url"
                label="url"
                value={serverUrl}
                variant="outlined"
                size="small"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setServerUrl(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setServerUrl(serverUrl);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">Chroma Server Url</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={useChroma}
                    onChange={() => toggleUseChroma()}
                  />
                }
                label=""
              />
              <TextField
                id="chroma-url"
                label="url"
                value={chromaUrl}
                variant="outlined"
                size="small"
                disabled={!useChroma}
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setChromaUrl(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                disabled={!useChroma}
                onClick={() => {
                  customStorage.setChromaUrl(chromaUrl);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">Gemini Key</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aiProvider === AIProvider.Gemini}
                    onChange={(e) => {
                      if (e.target.checked) setAiProvider(AIProvider.Gemini);
                    }}
                  />
                }
                label=""
              />
              <TextField
                id="openai-key"
                label="key"
                value={geminiKey}
                variant="outlined"
                type="password"
                size="small"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setGeminiKey(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setGeminiKey(geminiKey);
                  customStorage.setAIProvider(aiProvider);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>
        <FormLabel component="legend">Gemini Model</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={geminiModel}
                label="Level"
                onChange={handleGeminiModelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={GeminiModel.GEMINI1_5_flash}>
                  gemini-1.5-flash
                </MenuItem>
                <MenuItem value={GeminiModel.GEMINI1_5_pro}>
                  gemini-1.5-pro
                </MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setGeminiModel(geminiModel);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">Claude Key</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aiProvider === AIProvider.Claude}
                    onChange={(e) => {
                      if (e.target.checked) setAiProvider(AIProvider.Claude);
                    }}
                  />
                }
                label=""
              />
              <TextField
                id="openai-key"
                label="key"
                value={claudeKey}
                variant="outlined"
                size="small"
                type="password"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setClaudeKey(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setClaudeKey(claudeKey);
                  customStorage.setAIProvider(aiProvider);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>
        <FormLabel component="legend">Claude Model</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={claudeModel}
                label="Level"
                onChange={handleClaudeModelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={ClaudeModel.CLAUDE_3_HAIKU}>
                  CLAUDE_3_HAIKU
                </MenuItem>
                <MenuItem value={ClaudeModel.CLAUDE_3_OPUS}>
                  CLAUDE_3_OPUS
                </MenuItem>
                <MenuItem value={ClaudeModel.CLAUDE_3_SONNET}>
                  CLAUDE_3_SONNET
                </MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setClaudeModel(claudeModel);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">百度 Baidu Key & Secret</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aiProvider === AIProvider.Baidu}
                    onChange={(e) => {
                      if (e.target.checked) setAiProvider(AIProvider.Baidu);
                    }}
                  />
                }
                label=""
              />
              <TextField
                id="baidu-key"
                label="Key"
                value={baiduKey}
                variant="outlined"
                size="small"
                type="password"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setBaiduKey(event.currentTarget.value)}
              />
              <TextField
                id="baidu-secret"
                label="Secret"
                value={baiduSecret}
                variant="outlined"
                size="small"
                type="password"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setBaiduSecret(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setBaiduKey(baiduKey);
                  customStorage.setBaiduSecret(baiduSecret);
                  customStorage.setAIProvider(aiProvider);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">月之暗面 Kimi Key</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aiProvider === AIProvider.Kimi}
                    onChange={(e) => {
                      if (e.target.checked) setAiProvider(AIProvider.Kimi);
                    }}
                  />
                }
                label=""
              />
              <TextField
                id="openai-key"
                label="key"
                value={kimiKey}
                variant="outlined"
                size="small"
                type="password"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setKimiKey(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setKimiKey(kimiKey);
                  customStorage.setAIProvider(aiProvider);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>
        <Divider />
        <FormLabel component="legend">OpenAI Key</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aiProvider === AIProvider.ChatGPT}
                    onChange={(e) => {
                      if (e.target.checked) setAiProvider(AIProvider.ChatGPT);
                    }}
                  />
                }
                label=""
              />
              <TextField
                id="openai-key"
                label="key"
                value={openAiKey}
                variant="outlined"
                size="small"
                type="password"
                sx={{ marginBottom: '5px' }}
                InputProps={{
                  sx: {
                    height: '28px',
                    '& .MuiOutlinedInput-input': {
                      height: '28px',
                      padding: '6px 14px',
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '28px',
                    },
                  },
                }}
                onChange={(event) => setOpenAiKey(event.currentTarget.value)}
              />
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setOpenAIKey(openAiKey);
                  customStorage.setAIProvider(aiProvider);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>
        <FormLabel component="legend">ChatGPT Model</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={chatGPTModel}
                label="Level"
                onChange={handleChatGPTModelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={ChatGPTModel.GPT3_5}>GPT-3.5</MenuItem>
                <MenuItem value={ChatGPTModel.GPT4o}>GPT-4o</MenuItem>
                <MenuItem value={ChatGPTModel.GPT4}>GPT-4</MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setChatGPTModel(chatGPTModel);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start"></div>
            <div className="two_end_end">
              <FormGroup aria-label="openai-setting" row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useOpenAiImage}
                      onChange={() => toggleUseOpenAiImage()}
                    />
                  }
                  label="Use Image Generator"
                />
              </FormGroup>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">Reader Level</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={readerLevel}
                label="Level"
                onChange={handleReaderLevelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={ReaderLevel.College}>College</MenuItem>
                <MenuItem value={ReaderLevel.Middle}>Middle</MenuItem>
                <MenuItem value={ReaderLevel.Elementary}>Elementary</MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setReaderLevel(readerLevel);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">Study Mode</FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={studyMode}
                label="Age"
                onChange={handleStudyModeChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={StudyMode.General}>General</MenuItem>
                <MenuItem value={StudyMode.Language}>Language Study</MenuItem>
                <MenuItem value={StudyMode.Math}>Math</MenuItem>
                <MenuItem value={StudyMode.Program}>
                  Programming Language
                </MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setStudyMode(studyMode);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend">
          Leitner System [Learning Speed]
        </FormLabel>
        <Divider />
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={leitnerSpeed}
                label="Level"
                onChange={handleLeitnerSpeedChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={LeitnerSpeed.Fast}>Fast</MenuItem>
                <MenuItem value={LeitnerSpeed.Normal}>Normal</MenuItem>
                <MenuItem value={LeitnerSpeed.Slow}>Slow</MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setLeitnerSpeed(leitnerSpeed);
                }}
              >
                Save
              </SmallButton>
            </div>
          </div>
        </Box>

        <FormLabel component="legend" color="warning">
          KeyWords
        </FormLabel>
        <Divider />
        <FormLabel component="legend" color="info">
          Each Study Mode HAS Its Own KeyWords. [ Imported File Contains A List
          Of Keywords, Each Keyword Occupies One Line.]
        </FormLabel>
        <Box mb={2}>
          <div className="two_end_container">
            <div className="two_end_start">
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                value={studyModeForKeywords}
                label="Age"
                onChange={handleStudyModeForKeywordsChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value={StudyMode.General}>General</MenuItem>
                <MenuItem value={StudyMode.Language}>Language Study</MenuItem>
                <MenuItem value={StudyMode.Math}>Math</MenuItem>
                <MenuItem value={StudyMode.Program}>
                  Programming Language
                </MenuItem>
              </Select>
            </div>
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  tryImportKeywordsFile();
                }}
              >
                Import Keywords
              </SmallButton>
            </div>
          </div>

          <WordListManagerUI studyModeForKeywords={studyModeForKeywords} />
        </Box>

        <Box mb={2}>
          <FormLabel component="legend" color="primary">
            Word Color
          </FormLabel>
          <Divider />
          <FormLabel component="legend" color="info">
            Data structure: &#123; levels: &#123; [name] : id &#125; , colors:
            &#123; [id]: color &#125;, words: &#123; [id]: [word]&#125; &#125;
          </FormLabel>
          <div className="two_end_container">
            <div className="two_end_start" />
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  tryImportWordFrequencyFile();
                }}
              >
                Import Word Colors
              </SmallButton>
              <SmallButton
                variant="outlined"
                ref={cellRef}
                onClick={() => {
                  setOpenSampleColorDialog(true);
                }}
              >
                Show Sample Data
              </SmallButton>
            </div>
          </div>
          {cellRef.current && (
            <ShowSampleColorDialog
              anchorEl={cellRef}
              handleWindowClose={() => setOpenSampleColorDialog(false)}
              open={openSampleColorDialog}
            />
          )}
        </Box>

        <Box mb={2}>
          <FormLabel component="legend">Tags</FormLabel>
          <Divider />
          <TagsInputNoBorder
            value={tags}
            onChange={(tags) => {
              setTags(tags);
            }}
          />
          <div className="two_end_container">
            <div className="two_end_start" />
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setItem('saved_tags', tags);
                }}
              >
                Save Tags
              </SmallButton>
            </div>
          </div>
        </Box>

        <Box mb={2}>
          <FormLabel component="legend">Note Setting</FormLabel>
          <Divider />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <FontSelector onFontChange={onFontChange} />
            </Grid>
            <Grid item xs={12} sm={3}>
              <ColorMultiplePicker onColorChange={onColorChange} />
            </Grid>

            <Grid item xs={12} sm={3}>
              <ImageSelector onImageChange={onImageChange} />
            </Grid>
          </Grid>
        </Box>

        <Box mb={2}>
          <FormLabel component="legend">Emoji</FormLabel>
          <Divider />
          <Picker
            data={emojiData}
            onEmojiSelect={(e) => {
              setCommonEmoji([...commonEmoji, e]);
            }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {commonEmoji.map((emoji, index) => (
              <Chip
                key={index}
                label={emoji.native}
                onDelete={() => handleEmojiDelete(emoji.id)}
                color="primary"
              />
            ))}
          </Stack>
          <div className="two_end_container">
            <div className="two_end_start" />
            <div className="two_end_end">
              <SmallButton
                variant="outlined"
                onClick={() => {
                  customStorage.setItem('common_emoji', commonEmoji);
                }}
              >
                Save Emoji
              </SmallButton>
            </div>
          </div>
        </Box>

        <Box mb={2}>
          <FormLabel component="legend">Quiz Setting</FormLabel>
          <Divider />
          <div className="two_end_container">
            <div className="two_end_start">Quiz Type</div>
            <div className="two_end_end">
              <RadioGroup
                row
                name="quiz_type_groups"
                value={quizType}
                onChange={changeQuizType}
              >
                <FormControlLabel
                  value={QuizType.InstantResultQuiz}
                  control={<Radio />}
                  label="Instant Feedback Quiz"
                />
                <FormControlLabel
                  value={QuizType.ScoredQuiz}
                  control={<Radio />}
                  label="Scored Quiz"
                />
              </RadioGroup>
            </div>
          </div>
          <div className="two_end_container">
            <div className="two_end_start">showProgressBar</div>
            <div className="two_end_end">
              <Select
                labelId="show-progress-bar-label"
                id="show-progress-bar-select"
                value={showProgressBar}
                label="progressBar"
                onChange={handleShowProgressBarChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value="top">Top</MenuItem>
                <MenuItem value="bottom">Bottom</MenuItem>
                <MenuItem value="off">Off</MenuItem>
              </Select>
            </div>
          </div>

          <div className="two_end_container">
            <div className="two_end_start">showTimerPanel</div>
            <div className="two_end_end">
              <Select
                labelId="show-progress-bar-label"
                id="show-progress-bar-select"
                value={showTimerPanel}
                label="Age"
                onChange={handleShowTimerPanelChange}
                sx={{ height: '32px' }}
              >
                <MenuItem value="top">Top</MenuItem>
                <MenuItem value="bottom">Bottom</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </Select>
            </div>
          </div>
        </Box>

        <Box mb={2}>
          <FormLabel component="legend">Saved Data: Clear All Data</FormLabel>
          <Divider />
          <div className="two_end_container">
            <div className="two_end_start">Clear Notes</div>
            <div className="two_end_end">
              <SmallButton variant="outlined" onClick={ClearAllNotes}>
                Delete
              </SmallButton>
            </div>
          </div>
          <div className="two_end_container">
            <div className="two_end_start">Clear Books</div>
            <div className="two_end_end">
              <SmallButton variant="outlined" onClick={ClearAllBooks}>
                Delete
              </SmallButton>
            </div>
          </div>
          <div className="two_end_container">
            <div className="two_end_start">Clear Chats</div>
            <div className="two_end_end">
              <SmallButton variant="outlined" onClick={deleteAllChats}>
                Delete
              </SmallButton>
            </div>
          </div>
          <div className="two_end_container">
            <div className="two_end_start">Clear Prompts</div>
            <div className="two_end_end">
              <SmallButton variant="outlined" onClick={deleteAllPrompts}>
                Delete
              </SmallButton>
            </div>
          </div>
          <div className="two_end_container">
            <div className="two_end_start">Clear MoodBoards</div>
            <div className="two_end_end">
              <SmallButton variant="outlined" onClick={deleteAllMoodBoards}>
                Delete
              </SmallButton>
            </div>
          </div>
        </Box>
      </div>
    </Paper>
  );
}
