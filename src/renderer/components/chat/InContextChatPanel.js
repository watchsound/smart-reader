/* eslint-disable no-restricted-syntax */
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
  Switch,
  FormControlLabel,
  Collapse,
  LinearProgress,
} from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
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
import SummarizeIcon from '@mui/icons-material/Summarize';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import TranslateIcon from '@mui/icons-material/Translate';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import QuizIcon from '@mui/icons-material/Quiz';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BuildIcon from '@mui/icons-material/Build';
import SearchIcon from '@mui/icons-material/Search';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SchoolIcon from '@mui/icons-material/School';

import customStorage from '../../store/customStorage';
import MessageItem from "./MessageItem";
import parseMarkdownToHtml from "../note/NoteUtil";
import {
  getMessagesByChatId,
  getChatById,
  createMessage,
  updateMessage,
  updateChat,
} from '../../api/chatApi';
import SmallButton from "../Button/SmallButton";

import { chatHandled, messageUpdated, messageAdded, messageHandled, messageQueried } from '../../store/reducers/chatSlice';
import { stripJsonWrap } from '../../../commons/utils/commonUtil';
import { mapToNewJsonSchema, createReaderLevelPrompt, createTutorSystemPrompt } from '../../../commons/utils/AIPrompts';
import { buildTutorContext, composeTutorContextString } from '../../utils/tutorContext';
import JsonSchemaManager from '../../utils/json/JsonSchemaManager';
import mindMapSchema, {mindMapSchema0} from '../../utils/json/mindmapSchema';
import { convertToReactFlow, convertToReactFlow0 } from '../../../commons/utils/content/mindmapUtil';
import MyMindMap from "../mindmap";
import { StudyMode } from '../../../commons/model/DataTypes';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import skillApi from '../../api/skillApi';
import FiveWAnalysisPanel from '../knowledge/FiveWAnalysisPanel';
import QuizPanel from '../knowledge/QuizPanel';
import SimplifiedTextPanel from '../knowledge/SimplifiedTextPanel';

// Quick Action Chip Styles
const QuickActionChip = styled(Chip)(({ theme, chipcolor }) => ({
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  fontWeight: 500,
  fontSize: '11px',
  height: '28px',
  backgroundColor: chipcolor ? `${chipcolor}15` : 'rgba(29, 155, 209, 0.08)',
  color: chipcolor || '#1d9bd1',
  border: '1px solid transparent',
  '&:hover': {
    backgroundColor: chipcolor ? `${chipcolor}25` : 'rgba(29, 155, 209, 0.15)',
    borderColor: chipcolor ? `${chipcolor}40` : 'rgba(29, 155, 209, 0.3)',
    transform: 'translateY(-1px)',
  },
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: '14px',
  },
}));

// Context Indicator Styles
const ContextIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  background: theme.palette.mode === 'dark' ? 'rgba(46, 182, 125, 0.15)' : 'rgba(46, 182, 125, 0.08)',
  color: '#2eb67d',
  fontSize: '11px',
  fontWeight: 500,
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

// Quick Actions Container
const QuickActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px',
  padding: '10px 12px',
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
}));

// Pulsing dot for context indicator
const PulsingDot = styled(FiberManualRecordIcon)(({ theme }) => ({
  fontSize: '8px',
  animation: 'pulse 2s infinite',
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.5 },
  },
}));

// Skill mode indicator chip
const SkillModeChip = styled(Chip)(({ theme, active }) => ({
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: '10px',
  height: '24px',
  backgroundColor: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
  color: active ? '#6366f1' : theme.palette.text.secondary,
  border: `1px solid ${active ? '#6366f1' : theme.palette.divider}`,
  '&:hover': {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: '12px',
  },
}));

// Tool usage indicator
const ToolUsageChip = styled(Chip)(({ theme }) => ({
  height: '20px',
  fontSize: '10px',
  fontWeight: 500,
  backgroundColor: 'rgba(16, 185, 129, 0.1)',
  color: '#10b981',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: '12px',
  },
}));

function InContextChatPanel({ articleStr, curBook, selectedText = '', onRef }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Track selection changes for quick actions
  const [showSelectionHint, setShowSelectionHint] = useState(false);

  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');
  // const [apiKey, setApiKey] = useState('');
  // const [model, setModel] = useState('');
  const [userMessages, setUserMessages] = useState([]);
  const [userMsgIndex, setUserMsgIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [messageContent, setMessageContent] = useState('');
  const [content, setContent] = useState('');
  const [imageData, setImageData] = useState('');
  const [multiline, setMultiline] = useState(false);
  const [vectorized, setVectorized] = useState(false);
  // const [article, setArticle] = useState('');

  // const [contentDraft, setContentDraft] = useState('');
  // const [responseContent, setResponseContent] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [, forceUpdate] = useState();

  // Skill system state
  const [skillMode, setSkillMode] = useState(false);
  const [skillStatus, setSkillStatus] = useState({ initialized: false, skillCount: 0, supportsToolUse: false });
  const [toolsUsed, setToolsUsed] = useState([]);
  const [lastToolsUsed, setLastToolsUsed] = useState([]);

  // Phase 1: Tutor mode — injects learner profile + knowledge graph + recent
  // activity into the system prompt so the chat answers as a teacher who
  // remembers this specific reader.
  const [tutorMode, setTutorMode] = useState(false);
  const [tutorContextLoading, setTutorContextLoading] = useState(false);


  const [mindMapData, setMindMapData] = useState(null);
  const [mindMapDataLarge, setMindMapDataLarge] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [keywordExercisePrompt, setKeywordExercisePrompt] = useState('');
  const [readerLevelPrompt, setReaderLevelPrompt] = useState('');
  const dispatch = useDispatch();

 const componentRef = useRef(null);

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

  // Show selection hint when selectedText changes
  useEffect(() => {
    if (selectedText && selectedText.length > 10) {
      setShowSelectionHint(true);
    } else {
      setShowSelectionHint(false);
    }
  }, [selectedText]);

  /**
   * Add a skill result as a chat message.
   * This allows external components (like Browser.js) to inject skill results
   * into the chat history.
   * @param {Object} skillResult - The skill result to add
   * @param {string} skillResult.skillName - Name of the skill (e.g., 'analyze_structure')
   * @param {string} skillResult.title - Display title (e.g., '5W Analysis')
   * @param {any} skillResult.data - The result data
   * @param {string} skillResult.sourceText - The original text that was analyzed
   */
  const addSkillResult = useCallback((skillResult) => {
    const { skillName, title, data, sourceText } = skillResult;

    // Create a user message showing what was requested
    const userMessage = {
      id: uuid(),
      chatId: -1,
      content: `[${title}] Analyze:\n"${sourceText?.substring(0, 100)}${sourceText?.length > 100 ? '...' : ''}"`,
      role: 'user',
      createdAt: new Date(),
    };

    // Create an assistant message with the skill result
    const botMessage = {
      id: uuid(),
      chatId: -1,
      content: '', // Content is empty because we render the skill result directly
      role: 'assistant',
      createdAt: new Date(),
      skillResult: {
        skillName,
        title,
        data,
      },
    };

    setMessages((prevMessages) => [...prevMessages, userMessage, botMessage]);
  }, []); // No dependencies needed since we use functional update

  // Expose methods to parent via onRef callback
  useEffect(() => {
    if (onRef) {
      onRef({
        addSkillResult,
      });
    }
  }, [onRef, addSkillResult]);

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
    const botMessage = {
      id: uuid(),
      chatId: -1,
      content, // '█',
      role: 'assistant',
      createdAt: new Date(),
    };
    setMessages([...messages, botMessage]);
    setMessageContent('');

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
    const prompt = mapToNewJsonSchema('Mind Map', JSON.stringify(jsonData), JSON.stringify(mindMapSchema) );
    const r = await aiProviderManager.generateContentWithJson( prompt, false );
    if (r) {
      content0 = stripJsonWrap(r)
      if ( content0.startsWith('{') && content0.charAt(content0.length-1) === '}' )
        jsonData = JSON5.parse(content0);
      else
        jsonData = await aiProviderManager.extractJsonData(content0);
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

      // Initialize skill system status
      try {
        const status = skillApi.getStatus();
        setSkillStatus(status);
        // Auto-enable skill mode if provider supports tool use
        if (status.supportsToolUse) {
          setSkillMode(true);
        }
      } catch (err) {
        console.warn('Failed to get skill status:', err);
      }
    }
    t();
  }, []);

  useEffect(() => {
    if (!articleStr && !curBook) return;
    setUserMessages([ ]);
    setMessages([ ]);
    setMessageContent('');
    setContent('');
    setVectorized(false);
    setUserMsgIndex(0);
    // setArticle(articleStr || '');
    // async function t() {
    //   await customStorage.addContentToInMemoryVectorDB(articleStr);
    // }
    // t();
  }, [articleStr, curBook]);

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const [writingCharacter, setWritingCharacter] = useState(null);
  const [writingTone, setWritingTone] = useState(null);
  const [writingStyle, setWritingStyle] = useState(null);
  const [writingFormat, setWritingFormat] = useState(null);



  const getSystemMessage = () => {
    const message = [];
    if (writingCharacter) message.push(`You are ${writingCharacter}.`);
    if (writingTone) message.push(`Respond in ${writingTone} tone.`);
    if (writingStyle) message.push(`Respond in ${writingStyle} style.`);
    if (writingFormat) message.push(writingFormat);
    if (message.length === 0)
      message.push(
        'You are ChatGPT, a large language model trained by OpenAI.',
      );
    return message.join(' ');
  };

  /**
   * Build the tutor-mode prefix to prepend to the system message.
   * Returns '' when tutorMode is off or no context could be assembled.
   * Cached by tutorContext.js — repeated calls within the same book/chapter
   * are cheap.
   */
  const buildTutorPrefix = async () => {
    if (!tutorMode) return '';
    setTutorContextLoading(true);
    try {
      const ctx = await buildTutorContext({
        bookId: curBook?.id,
        chapterId: undefined,
      });
      const contextString = composeTutorContextString(ctx);
      return createTutorSystemPrompt(contextString, {
        bookTitle: curBook?.title,
      });
    } catch (err) {
      console.warn('[TutorMode] context build failed', err);
      return '';
    } finally {
      setTutorContextLoading(false);
    }
  };

  const systemMessageLocal = `
    You are assistant and you confidently answer questions based on the knowledge user provided during conversation.
    if a question is out of the knowledge, you politely refuse. your response should be less than 100 words.
  `;

  async function queryLocalData(query) {
    const r = await customStorage.queryInMemoryVectorDB(query);
    if (!r) return '';
    return r.join('\n');
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

  const updateArray = (array, idToUpdate, newData) =>{
    return array.map(item => {
          if (item.id === idToUpdate) {
              return { ...item, content: newData };
          }
          return item;
      });
  }

  // Submit with skill-aware AI (agentic mode)
  const submitWithSkills = async (useLocalData) => {
    if (submitting) return;
    if (!articleStr && !curBook) return;

    try {
      setSubmitting(true);
      setToolsUsed([]);
      setLastToolsUsed([]);

      // Update skill context with current view
      skillApi.updateView({
        view: curBook ? 'reading' : 'browser',
        documentId: curBook?.id,
        documentType: curBook?.format,
      });

      // Update selection context if we have article content
      if (articleStr) {
        skillApi.updateSelection(articleStr.substring(0, 2000)); // First 2000 chars
      }

      let msgs = [...messages];
      if (msgs.length > 10) {
        msgs = msgs.slice(-10);
      }

      // Add pending assistant message if exists
      if (messageContent) {
        const m = {
          id: uuid(),
          chatId: -1,
          content: messageContent,
          role: 'assistant',
          createdAt: new Date(),
        };
        msgs.push(m);
        setMessageContent('');
      }

      // Get local context data
      let localData = '';
      if (useLocalData) {
        if (articleStr && !curBook) {
          if (!vectorized) {
            setVectorized(true);
            await customStorage.addContentToInMemoryVectorDB(articleStr);
          }
          localData = await queryLocalData(content);
        }
        if (!articleStr && curBook) {
          const r = await customStorage.getBookContentByQuery({
            bookKey: curBook.id,
            bookType: curBook.format,
            query: content,
          });
          r.forEach((match) => {
            localData += `${match.content}\n`;
          });
        }
      }

      // Build user message with context
      const contextPrefix = localData
        ? `[Context from current reading material:\n${localData.substring(0, 3000)}]\n\n`
        : '';
      const userContent = contextPrefix + content;

      const userMessage = {
        id: uuid(),
        chatId: -1,
        content,
        role: 'user',
      };
      setUserMessages([...userMessages, content]);
      setContent('');

      // Add user message to display
      msgs = [...msgs, userMessage];
      setMessages(msgs);

      // Tutor-mode prefix (Phase 1) — async; cheap on cache hit.
      const tutorPrefix = await buildTutorPrefix();

      // Build messages for skill chat
      const chatMessages = [
        {
          role: 'system',
          content: `${tutorPrefix}
                    ${readerLevelPrompt}
                    ${keywordExercisePrompt}
                    ${getSystemMessage()}
                    You are a helpful reading assistant with access to various skills/tools.
                    When the user asks you to perform tasks like summarizing, explaining concepts,
                    checking grammar, looking up vocabulary, searching notes, or creating notes,
                    use the appropriate skill to provide better results.`,
        },
        ...msgs.slice(0, -1).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: 'user',
          content: userContent,
        },
      ];

      // Call skill-aware chat API
      const result = await skillApi.chatWithSkills(chatMessages, {
        maxIterations: 3,
      });

      if (result.success) {
        const botMessage = {
          id: uuid(),
          chatId: -1,
          content: result.text,
          role: 'assistant',
          createdAt: new Date(),
          toolsUsed: result.toolsUsed,
        };
        setMessages([...msgs, botMessage]);
        setLastToolsUsed(result.toolsUsed || []);

        if (result.toolsUsed && result.toolsUsed.length > 0) {
          console.log('[Skills] Tools used:', result.toolsUsed);
        }
      } else {
        showMessage(result.error || 'Failed to get response', 'error');
        // Fallback to regular chat
        await submitRegular(useLocalData);
      }

    } catch (error) {
      console.error('[Skills] Error:', error);
      showMessage(error.message || 'Skill chat failed', 'error');
      // Fallback to regular submit
      await submitRegular(useLocalData);
    } finally {
      setSubmitting(false);
      setImageData('');
    }
  };

  // Regular submit (non-skill mode)
  const submitRegular = async (useLocalData) => {
    if (!articleStr && !curBook) {
      return;
    }

    try {
      let msgs = [...messages];
      if (msgs.length >10) {
        msgs = msgs.slice(-10);
      }
      if (messageContent) {
        const m = {
          id: uuid(),
          chatId: -1,
          content: messageContent,
          role: 'assistant',
          createdAt: new Date(),
        };
        msgs.push(m);
        setMessageContent('');
      }


      let localData = ''
      if (useLocalData) {
        if (articleStr && !curBook) {
          if (!vectorized) {
            setVectorized(true);
            await customStorage.addContentToInMemoryVectorDB(articleStr);
          }
          localData = await queryLocalData(content);
        }
        if (!articleStr && curBook) {
          const r = await customStorage.getBookContentByQuery({
            bookKey: curBook.id,
            bookType: curBook.format,
            query: content,
          });
           r.forEach((match, index) => {
             localData += `${match.content  }\n`;
          });

        }
         console.log( `localData =  ${localData}`);
         localData = `${systemMessageLocal}\n
          These are knowledge provided for you:\n\n
          ${localData} `
      }
      const userMessage = {
        id: uuid(),
        chatId: -1,
        content,
        role: 'user',
      } ;
      setUserMessages([...userMessages, content]);
      setContent('');

      const userRealInput =  content;

      if (imageData) {

         const res = await aiProviderManager.generateMultimodalContent(userRealInput, [{ data: imageData, mimeType : '' }], false );
          const botMessage = {
            id: uuid(),
            chatId: -1,
            content: res, // '█',
            role: 'assistant',
            createdAt: new Date(),
          };
         msgs = [...msgs, userMessage, botMessage]
         setMessages(msgs);
      } else {
         msgs = [...msgs, userMessage]
        setMessages(msgs);
        // Tutor-mode prefix (Phase 1) — async; cheap on cache hit.
        const tutorPrefix = await buildTutorPrefix();
        const result = await aiProviderManager.generateChatStream([
            {
              role: 'system',
              content: `${tutorPrefix}
                        ${readerLevelPrompt  }
                       ${ keywordExercisePrompt   }
                        ${getSystemMessage()  }
                        ${useLocalData?localData:''}`,
            },
            ...getFirstNMinusTwoItems(messages).map((message) => ({
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
          setMessageContent(prev => prev + c);
        }
        if (result.finalChatCompletion)
          await result.finalChatCompletion();
      }

    } catch (error) {
      console.log(error);
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showMessage('No internet connection.');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showMessage(message);
      }
    }
  };

  const submit = async (useLocalData) => {
    if (submitting) return;

    if (!articleStr && !curBook) {
      return;
    }

    try {
      setSubmitting(true);

      // Use skill-aware chat if skill mode is enabled and supported
      if (skillMode && skillStatus.supportsToolUse) {
        await submitWithSkills(useLocalData);
      } else {
        await submitRegular(useLocalData);
      }

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
    // setContentDraft(value);
    setUserMsgIndex(0);
  };

  // Quick action handlers - can use skills when skill mode is on
  const quickActions = [
    {
      id: 'summarize',
      label: 'Summarize',
      icon: <SummarizeIcon />,
      color: '#611f69',
      prompt: 'Please provide a concise summary of this content in 3-5 key points.',
      skill: 'summarize',
      skillParams: { length: 'brief', format: 'bullets' },
    },
    {
      id: 'explain',
      label: 'Explain',
      icon: <LightbulbIcon />,
      color: '#1d9bd1',
      prompt: 'Please explain this content in simple terms that anyone can understand.',
      skill: 'explain',
      skillParams: { useAnalogy: true },
    },
    {
      id: 'translate',
      label: 'Translate',
      icon: <TranslateIcon />,
      color: '#2eb67d',
      prompt: 'Please translate this content to Chinese (Simplified).',
    },
    {
      id: 'keypoints',
      label: 'Key Points',
      icon: <FormatListBulletedIcon />,
      color: '#ecb22e',
      prompt: 'Extract the main key points from this content as a bullet list.',
      skill: 'extract_concepts',
    },
    {
      id: 'quiz',
      label: 'Quiz Me',
      icon: <QuizIcon />,
      color: '#e01e5a',
      prompt: 'Create 3-5 multiple choice questions based on this content to test understanding.',
    },
    {
      id: 'grammar',
      label: 'Grammar',
      icon: <AutoFixHighIcon />,
      color: '#8b5cf6',
      prompt: 'Check the grammar of this text and explain any corrections.',
      skill: 'grammar_check',
    },
    {
      id: 'search_notes',
      label: 'My Notes',
      icon: <SearchIcon />,
      color: '#06b6d4',
      prompt: 'Search my notes for related content.',
      skill: 'search_notes',
      skillParams: { searchType: 'semantic' },
    },
  ];

  // Execute a skill directly (for quick actions that map to skills)
  const executeSkillDirect = async (skillName, params) => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setLastToolsUsed([skillName]);

      // Get content from article or selected text
      const textContent = articleStr || '';
      const skillParamsWithText = { ...params, text: textContent.substring(0, 5000) };

      const result = await skillApi.executeSkill(skillName, skillParamsWithText);

      if (result.success && result.result) {
        // Format the result for display
        let responseText = '';
        const res = result.result.result || result.result;

        if (skillName === 'summarize') {
          responseText = `**Summary:**\n\n${res.summary || res}`;
        } else if (skillName === 'grammar_check') {
          responseText = `**Grammar Check:**\n\n${res.correctedText || ''}\n\n`;
          if (res.errors && res.errors.length > 0) {
            responseText += '**Corrections:**\n';
            res.errors.forEach((err) => {
              responseText += `- "${err.original}" → "${err.corrected}": ${err.explanation}\n`;
            });
          }
        } else if (skillName === 'explain') {
          responseText = `**Explanation:**\n\n${res.explanation || res}`;
        } else if (skillName === 'extract_concepts') {
          responseText = '**Key Concepts:**\n\n';
          if (res.nodes) {
            res.nodes.forEach((node) => {
              responseText += `- **${node.text}** (${node.type})\n`;
            });
          }
        } else if (skillName === 'search_notes') {
          responseText = `**Found ${res.resultCount || 0} related notes:**\n\n`;
          if (res.notes) {
            res.notes.slice(0, 5).forEach((note) => {
              responseText += `- **${note.title}**: ${note.content?.substring(0, 100)}...\n`;
            });
          }
        } else {
          responseText = JSON.stringify(res, null, 2);
        }

        const botMessage = {
          id: uuid(),
          chatId: -1,
          content: responseText,
          role: 'assistant',
          createdAt: new Date(),
          toolsUsed: [skillName],
        };
        setMessages([...messages, botMessage]);
      } else {
        showMessage(result.error || 'Skill execution failed', 'error');
      }
    } catch (error) {
      console.error('[Skills] Direct execution error:', error);
      showMessage(error.message || 'Skill failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAction = async (action) => {
    // Determine the text to use - selectedText if useSelection flag is set, otherwise articleStr
    const textToProcess = action.useSelection && selectedText ? selectedText : articleStr;

    // If skill mode is on and action has a skill mapping, execute directly
    if (skillMode && skillStatus.supportsToolUse && action.skill && textToProcess) {
      await executeSkillDirect(action.skill, { ...action.skillParams, text: textToProcess });
    } else {
      // Regular prompt-based action
      const promptWithContext = action.useSelection && selectedText
        ? `${action.prompt}\n\nSelected text:\n"${selectedText}"`
        : action.prompt;
      setContent(promptWithContext);
      setTimeout(() => {
        submit(true);
      }, 100);
    }
  };

  if (!articleStr && !curBook) return (
    <Card>
      <CardContent
        sx={{
          margin: '10px',
          width: '100%',
        }}
      >
        Please select a book or some text in page first~
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* Context Indicator with Skill Mode Toggle */}
      <ContextIndicator>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
          <PulsingDot />
          <span>
            {curBook ? `Reading: ${curBook.title || 'Book'}` : 'Page content loaded'}
          </span>
        </Box>

        {/* Skill Mode Toggle */}
        {skillStatus.supportsToolUse && (
          <Tooltip title={skillMode ? 'AI Skills Active - Click to disable' : 'Enable AI Skills (summarize, grammar, search notes, etc.)'}>
            <SkillModeChip
              icon={<BuildIcon />}
              label={skillMode ? `Skills (${skillStatus.skillCount})` : 'Skills Off'}
              active={skillMode ? 1 : 0}
              onClick={() => setSkillMode(!skillMode)}
              size="small"
            />
          </Tooltip>
        )}

        {/* Tutor Mode Toggle — Phase 1 */}
        <Tooltip
          title={
            tutorMode
              ? 'Tutor Mode active — chat uses your learner profile, knowledge graph, and recent activity'
              : 'Enable Tutor Mode (chat as your personal teacher who remembers what you know)'
          }
        >
          <SkillModeChip
            icon={<SchoolIcon />}
            label={tutorContextLoading ? 'Tutor…' : tutorMode ? 'Tutor On' : 'Tutor Off'}
            active={tutorMode ? 1 : 0}
            onClick={() => setTutorMode(!tutorMode)}
            size="small"
          />
        </Tooltip>
      </ContextIndicator>

      {/* Tool Usage Indicator */}
      <Collapse in={lastToolsUsed.length > 0}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.5,
          background: theme.palette.mode === 'dark' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '10px' }}>
            Tools used:
          </Typography>
          {lastToolsUsed.map((tool, idx) => (
            <ToolUsageChip
              key={idx}
              icon={<AutoFixHighIcon />}
              label={tool.replace('_', ' ')}
              size="small"
            />
          ))}
        </Box>
      </Collapse>

      {/* Loading indicator for skill execution */}
      {submitting && skillMode && (
        <LinearProgress sx={{ height: 2 }} />
      )}

      {/* Selection-aware Quick Actions - shown when text is selected */}
      {showSelectionHint && selectedText && selectedText.length > 10 && (
        <Box sx={{
          p: 1.5,
          bgcolor: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.05)',
          borderRadius: 1,
          mx: 1.5,
          mt: 1,
          border: '1px dashed',
          borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)',
        }}>
          <Typography variant="caption" sx={{ mb: 1, display: 'block', color: 'text.secondary', fontWeight: 500 }}>
            Selected: "{selectedText.substring(0, 50)}{selectedText.length > 50 ? '...' : ''}"
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {quickActions.slice(0, 5).map((action) => (
              <QuickActionChip
                key={`sel-${action.id}`}
                icon={action.icon}
                label={action.label}
                chipcolor={action.color}
                onClick={() => handleQuickAction({ ...action, useSelection: true })}
                disabled={submitting}
                size="small"
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Quick Action Chips */}
      <QuickActionsContainer>
        {quickActions.map((action) => (
          <QuickActionChip
            key={action.id}
            icon={action.icon}
            label={action.label}
            chipcolor={action.color}
            onClick={() => handleQuickAction(action)}
            disabled={submitting}
            size="small"
          />
        ))}
      </QuickActionsContainer>

      <Box ref={componentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {/* Main Panel */}
        <Stack spacing={2}>
          {messages?.map((message) => (
            <Box key={message.id}>
              {/* Render skill results with custom UI */}
              {message.skillResult ? (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: isDark
                      ? 'rgba(99, 102, 241, 0.08)'
                      : 'rgba(99, 102, 241, 0.04)',
                    border: `1px solid ${isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
                  }}
                >
                  {/* Skill result header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {message.skillResult.skillName === 'analyze_structure' ? '5W' : message.skillResult.skillName === 'quiz_generate' ? 'Q' : message.skillResult.skillName === 'text_simplify' ? 'S' : message.skillResult.skillName === 'mindmap' ? 'M' : 'AI'}
                    </Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {message.skillResult.title}
                    </Typography>
                  </Box>
                  {/* Render appropriate component based on skill type */}
                  {message.skillResult.skillName === 'analyze_structure' && (
                    <FiveWAnalysisPanel
                      data={message.skillResult.data}
                      sentenceCount={message.skillResult.data?.length}
                      compact
                    />
                  )}
                  {message.skillResult.skillName === 'quiz_generate' && (
                    <QuizPanel
                      quiz={message.skillResult.data?.quiz || []}
                      difficulty={message.skillResult.data?.difficulty}
                      questionCount={message.skillResult.data?.questionCount}
                      compact
                    />
                  )}
                  {message.skillResult.skillName === 'text_simplify' && (
                    <SimplifiedTextPanel
                      originalText={message.skillResult.data?.originalText}
                      simplifiedText={message.skillResult.data?.simplifiedText}
                      targetLevel={message.skillResult.data?.targetLevel}
                      simplificationRatio={message.skillResult.data?.simplificationRatio}
                      compact
                    />
                  )}
                  {/* Mind Map rendering */}
                  {message.skillResult.skillName === 'mindmap' && message.skillResult.data && (
                    <Box sx={{ width: '100%', height: 220 }}>
                      <MyMindMap
                        keywordMap={message.skillResult.data.keywordMap}
                        descriptionMap={message.skillResult.data.descriptionMap}
                      />
                    </Box>
                  )}
                  {/* Generic JSON display for other skill results */}
                  {!['analyze_structure', 'quiz_generate', 'text_simplify', 'mindmap'].includes(message.skillResult.skillName) && (
                    <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                      {JSON.stringify(message.skillResult.data, null, 2)}
                    </Typography>
                  )}
                </Box>
              ) : (
                <MessageItem message={message} />
              )}
              {/* Show tools used for this message */}
              {message.toolsUsed && message.toolsUsed.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, ml: 5, flexWrap: 'wrap' }}>
                  {message.toolsUsed.map((tool, idx) => (
                    <Chip
                      key={idx}
                      icon={<BuildIcon sx={{ fontSize: '10px !important' }} />}
                      label={tool.replace('_', ' ')}
                      size="small"
                      sx={{
                        height: '18px',
                        fontSize: '9px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        color: '#6366f1',
                        '& .MuiChip-icon': { fontSize: '10px' },
                      }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          ))}
          {messageContent && (
            <MessageItem key={-1} message={{
              id: -1,
              chatId: '',
              role: 'assistant',
              content: messageContent,
              createdAt: null,
            }} />
          )}
          {mindMapData && (
            <CardContent
              sx={{
                margin: '2px',
                width: '100%',
                height: '260px',
              }}
            >
              <MyMindMap
                keywordMap={mindMapData}
                descriptionMap={mindMapDataLarge}
              />
            </CardContent>
          )}
        </Stack>
      </Box>
      {/* Bottom Panel */}
      <Paper
        sx={{
          width: '100%',
          borderRadius: isDark ? '12px 12px 0 0' : '12px 12px 0 0',
          background: isDark ? 'rgba(40, 44, 52, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
        }}
        elevation={3}
      >
         <TextField
           sx={{ width: '100%' }}
            fullWidth
            multiline
            minRows={5}
            maxRows={5}
            disabled={submitting}
            value={content}
            onChange={onContentChange}
            placeholder="Your message here..."
            variant="outlined"
            size="small"
            onKeyDown={async (event) => {
              if (event.code === 'Enter' && (!event.shiftKey && !multiline)) {
                event.preventDefault();
                submit(true);
                setUserMsgIndex(0);
              }
              if (event.code === 'ArrowUp') {
                onUserMsgToggle(true);
              }
              if (event.code === 'ArrowDown') {
                onUserMsgToggle(false);
              }
            }}
          />
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
          {aiProviderManager.currentProvider && aiProviderManager.currentProvider.isFullSupported() && (
             <ButtonGroup  aria-label="control group">
              <Tooltip title="Upload Image">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={()=>uploadImageFile()}
                >
                  <AddPhotoAlternateIcon  fontSize="small" />
                </IconButton>
              </Tooltip>
              {imageData && ( <Avatar alt="Image" src={imageData} /> )}
            </ButtonGroup>
          )}
          </Grid>
          <Grid item>
             <ButtonGroup  aria-label="control group">
              <Tooltip title={skillMode ? "Send with AI Skills (context-aware)" : "Ask AI Using Current Article"}>
                <IconButton
                  size="small"
                  color={skillMode ? "secondary" : "primary"}
                  onClick={()=>submit(true)}
                  disabled={submitting}
                >
                  {skillMode ? <AutoFixHighIcon fontSize="small" /> : <SendAndArchiveIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Ask AI (without article context)">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={()=>submit(false)}
                  disabled={submitting}
                >
                  <SendIcon  fontSize="small" />
                </IconButton>
              </Tooltip>
               <Checkbox
                  label="Lines"
                  size="small"
                  onChange={handleCheckboxChange}
                  checked={multiline}
                />
            </ButtonGroup>
          </Grid>
        </Grid>

      </Paper>
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default InContextChatPanel;
