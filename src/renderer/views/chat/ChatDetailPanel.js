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
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

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
import MyMindMap from '../../components/mindmap';
import { AIProvider, StudyMode } from '../../../commons/model/DataTypes';
import aiProviderManager from '../../../commons/service/AIProviderManager';
import StringPicker from '../../components/Picker/StringPicker';
import promptSettingList, { None } from '../../constants/promptSettingList';

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
  const dispatch = useDispatch();

  const messages = useSelector((state) => state.chat.messages);
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
    const r = await aiProviderManager.generateContentWithJson( prompt, false );
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
    }
    t();
  }, []);

  useEffect(() => {
    if (!chatId) return;
    async function t() {
      const ms = await getMessagesByChatId(chatId);
      // setMessages(ms);
      dispatch(messageQueried(ms));
      const ms2 =
        ms
          ?.filter((message) => message.role === 'user')
          .map((message) => message.content) || [];
      setUserMessages(ms2);
      const ct = await getChatById(chatId);
      setChat(ct);
      dispatch(chatHandled(ct));
    }
    t();
  }, [chatId]);

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  const [writingCharacter, setWritingCharacter] = useState(promptSettingList.writingCharacters[0]);
  const [writingTone, setWritingTone] = useState(promptSettingList.writingTones[0]);
  const [writingStyle, setWritingStyle] = useState(promptSettingList.writingStyles[0]);
  const [writingFormat, setWritingFormat] = useState(promptSettingList.writingFormats[0]);



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
  };


  const submit = async (useLocalData) => {
    if (submitting) return;
    let curChatId = chatId;
    if (!chat) {
      // create a new chat
      console.log(` create new chat here ... `)
      const newChat = {
      //  id,
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
      // showMessage(
      //   'chatId is not defined. Please create a chat to get started.',
      // );
      // return;
    }

    // if (!apiKey) {
    //   showMessage('OpenAI API Key is not defined. Please set your API Key');
    //   return;
    // }

    try {
      setSubmitting(true);

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
        content: '', // '█',
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
            // ...getFirstNMinusTwoItems(messages).map((message) => ({
            //   role: message.role,
            //   content: message.content,
            // })),
            ...messages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            {
              role: 'user',
              content: userRealInput
            },
          ] );

      // setResponseContent('');
        for await (const chunk of result.stream) {
          const c = chunk.data(); //.choices[0]?.delta?.content || '';
          botMessage2 = {...botMessage2, content: botMessage2.content+c}
          dispatch(messageUpdated(botMessage2));
          // refresh();
          // console.log(chunk.choices[0]?.delta?.content || '');
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
    // setContentDraft(value);
    setUserMsgIndex(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Box  ref={componentRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {/* Main Panel */}
        <Stack spacing={2}>
          {messages?.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
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
      <Grid container>
        <Grid item xs={3}>
          <StringPicker title="Writing Character" options={promptSettingList.writingCharacters} selectedOne={writingCharacter} onSelection={setWritingCharacter} />
        </Grid>
        <Grid item xs={3}>
          <StringPicker title="Writing Tone" options={promptSettingList.writingTones} selectedOne={writingTone} onSelection={setWritingTone} />
        </Grid>
        <Grid item xs={3}>
          <StringPicker title="Writing Style" options={promptSettingList.writingStyles} selectedOne={writingStyle} onSelection={setWritingStyle} />
        </Grid>
         <Grid item xs={3}>
          <StringPicker title="Writing Formats" options={promptSettingList.writingFormats} selectedOne={writingFormat} onSelection={setWritingFormat} />
        </Grid>
      </Grid>
      <Paper sx={{ display: 'flex', justifyContent: 'center', p: 1 }} elevation={3}>
        <div>
          {aiProviderManager.currentProvider && aiProviderManager.currentProvider.isFullSupported() && (
            <ButtonGroup orientation="vertical" aria-label="control group">
              <Tooltip title="Upload Image">
                <SmallButton
                  color="primary"
                  onClick={()=>uploadImageFile()}
                >
                  <AddPhotoAlternateIcon />
                </SmallButton>
              </Tooltip>
              {imageData && ( <Avatar alt="Image" src={imageData} /> )}

            </ButtonGroup>
          )}

        </div>
        <Stack  sx={{ width: '100%',   margin: '4px', p: 1 }} spacing={2} direction="row" alignItems="center">
          <TextField
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
                submit(false);
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
          <div>
            <ButtonGroup orientation="vertical" aria-label="control group">
              <Tooltip title="Ask ChatGPT">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={()=>submit(false)}
                  disabled={submitting}
                >
                  <SendIcon  fontSize="small"/>
                </IconButton>
              </Tooltip>
              <Tooltip title="Ask ChatGPT Using Local Data">
               <IconButton
                  size="small"
                  color="primary"
                  onClick={()=>submit(true)}
                  disabled={submitting}
                >
                  <SendAndArchiveIcon  fontSize="small"/>
                </IconButton>
              </Tooltip>
               <Tooltip title="Multiple Lines">
               <Checkbox
                  label="Lines"
                  onChange={handleCheckboxChange}
                  checked={multiline}
                />
                </Tooltip>
              <Tooltip title="Create New Chat">
                <IconButton
                    size="small"
                    color="primary"
                    onClick={createNewChat}
                  >
                  <CreateNewFolderIcon  fontSize="small"/>
                </IconButton>
              </Tooltip>


            </ButtonGroup>
          </div>
        </Stack>
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
    </div>
  );
}

export default ChatDetailPanel;
