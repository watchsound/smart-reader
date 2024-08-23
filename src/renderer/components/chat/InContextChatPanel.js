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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Paper from '@mui/material/Paper';
import { useMemo, useEffect, useState, useRef, } from 'react';
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
import { mapToNewJsonSchema, createReaderLevelPrompt } from '../../../commons/utils/AIPrompts';
import JsonSchemaManager from '../../utils/json/JsonSchemaManager';
import mindMapSchema, {mindMapSchema0} from '../../utils/json/mindmapSchema';
import { convertToReactFlow, convertToReactFlow0 } from '../../../commons/utils/content/mindmapUtil';
import MyMindMap from "../mindmap";
import { StudyMode } from '../../../commons/model/DataTypes';
import aiProviderManager from '../../../commons/service/AIProviderManager';

function InContextChatPanel({ articleStr, curBook }) {

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

  const submit = async (useLocalData) => {
    if (submitting) return;

    if (!articleStr && !curBook) {
      return;
    }

    // if (!apiKey) {
    //   showMessage('OpenAI API Key is not defined. Please set your API Key');
    //   return;
    // }

    try {
      setSubmitting(true);

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
     // setMessages([...messages, userMessage]);
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
        // await tryToCustomizeUI(res);
      } else {
         msgs = [...msgs, userMessage]
        setMessages(msgs);
        const result = await aiProviderManager.generateChatStream([
            {
              role: 'system',
              content: `${readerLevelPrompt  }
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
          const c = chunk.data(); // .choices[0]?.delta?.content || '';
          setMessageContent(prev => prev + c);
        }
        if (result.finalChatCompletion)
          await result.finalChatCompletion();

        // await tryToCustomizeUI(messageContent);
      }

      setSubmitting(false);

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
      <Box  ref={componentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {/* Main Panel */}
        <Stack spacing={2}>
          {messages?.map((message) => (
            <MessageItem key={message.id} message={message} />
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
          <CardContent
            sx={{
              margin: '2px',
              width: '100%',
              height: '260px',
            }}

          >
          {mindMapData &&  (<MyMindMap
              keywordMap={mindMapData}
              descriptionMap={mindMapDataLarge}
            />
          )}
          </CardContent>

        </Stack>
      </Box>
      {/* Bottom Panel */}
      <Paper sx={{  width: '100%'  }} elevation={3}>
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
              <Tooltip title="Ask ChatGPT Using Current Article">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={()=>submit(true)}
                  disabled={submitting}
                >
                  <SendAndArchiveIcon  fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Ask ChatGPT">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={()=>submit(true)}
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
