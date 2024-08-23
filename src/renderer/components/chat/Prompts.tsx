/* eslint-disable prettier/prettier */
import { v4 as uuid } from 'uuid';
import { useMemo, useEffect, useState } from 'react';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
// import OpenAI from 'openai';
 import { Box, useTheme, Pagination } from '@mui/material';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // Choose an icon that matches your needs
import Stack from '@mui/material/Stack';
import { useSelector, useDispatch } from 'react-redux';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
// Import the icons you want to use
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import { grey, blue } from '@mui/material/colors';


import customStorage from '../../store/customStorage';
import DeletePromptModal from './DeletePromptModal';
import EditPromptModal from './EditPromptModal';
import { createChat, createMessage, updateChatTokenUsage, getPromptsByQuery } from '../../api/chatApi';
import { Prompt } from '../../../commons/model/chat';

import { chatAdded, chatHandled, messageAdded, chatUpdated, promptQueried } from '../../store/reducers/chatSlice';
import aiProviderManager from '../../../commons/service/AIProviderManager';

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

function Prompts({ onPlay, search }: { onPlay: () => void; search: string }) {
  // const [apiKey, setApiKey] = useState('');
  //  const [model, setModel] = useState('');
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [prompt, setPrompt] = useState<Prompt>();
  const [prompts, setPrompts] = useState<Prompt[]>();

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  // const allPrompts = useSelector((state) => state.chat.prompts);

  const theme = useTheme();
  const dispatch = useDispatch();

  useEffect(() => {
    async function t() {
      const result = await getPromptsByQuery({
        query: search || '',
        page,
        limit,
      });
      setPrompts(result.data || []);
      setTotal(result.total);
      dispatch(promptQueried(result.data));
    }
    t();
  }, [search, page, limit]);



  const filteredPrompts = useMemo(
    () =>
      (prompts || []).filter((prompt) => {
        if (!search) return true;
        return (
          prompt.title.toLowerCase().includes(search) ||
          prompt.content.toLowerCase().includes(search)
        );
      }),
    [prompts, search],
  );
  const handlePageChange = (event, value) => {
    setPage(value);
  };
  // const openai = useMemo(() => {
  //   // console.log(` openai-key2 = ${apiKey}`);
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true})
  // }, [apiKey]);

  // useEffect(() => {
  //   async function t() {
  //      const key = await customStorage.getOpenAIKey();
  //     setApiKey(key);
  //     const m = await customStorage.getChatGPTModel();
  //      setModel(m);
  //   }
  //   t();
  // }, []);
  function editPrompt(prompt) {
    setPrompt(prompt);
    setOpenEdit(true);
  }
  function editPromptCallback(p) {
    setOpenEdit(false);
    if(!p) return;
    setPrompt(p);
    setPrompts( prompts?.map( (m) => {
      if (m.id === p.id) return p;
      return m;
    }));
  }

  function deletePrompt(prompt) {
    setPrompt(prompt);
    setOpenDelete(true);
  }
  function deletePromptCallback(p) {
    setOpenDelete(false);
    if(!p) return;
    setPrompt(null);
    setPrompts( prompts?.filter( (m) => {
      return m.id !== p.id;
    }));

  }


  async function runPrompt(prompt) {
   // if (!apiKey) return;
    // const id = uuid();
    const newChat = {
    //  id,
      description: 'New Chat',
      totalTokens: 0,
      createdAt: new Date(),
      pinned: false,
      autoDelete: false,
    };
    const c = await createChat(newChat);
    dispatch(chatAdded(c));
    const m = await createMessage({
     // id: uuid(),
      chatId: c.id,
      content: prompt.content,
      role: 'user',
      createdAt: new Date(),
    });
    // navigate({ to: `/chats/${id}` });
    dispatch(messageAdded(m));
    dispatch(chatHandled(c));
    onPlay();

    const result = await aiProviderManager.sendChatMessage( [
        {
          role: 'system',
          content:
            'You are ChatGPT, a large language model trained by OpenAI.',
        },
        { role: 'user', content: prompt.content },
      ]);

    const m2 = await createMessage({
   //   id: uuid(),
      chatId: c.id,
      content: result ?? 'unknown reponse',
      role: 'assistant',
      createdAt: new Date(),
    });
    dispatch(messageAdded(m2));

    if (result.usage) {
      const c3 = await updateChatTokenUsage(id, result.usage!.total_tokens);
      dispatch(chatUpdated(c3));
    }
  }

  return (
    <ScrollPane>
      {filteredPrompts.map((prompt) => (
        <Box
          key={prompt.id}
          sx={{
            marginTop: 1,
            width: '100%',
            padding: theme.spacing(1), // Adjust the spacing as needed
            '&:hover': {
              backgroundColor: theme.palette.mode === 'dark'
                ? blue[900] // Adjust the shade for dark mode as needed
                : blue[200], // Adjust the shade for light mode as needed
            },
          }}
        >
          <Grid container alignItems="center">
            <Grid item xs>
              <Typography
                variant="body1" // Choose the variant that fits your needs
                sx={{
                  fontWeight: 500,
                  fontSize: '16px', // Apply the desired font weight
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: '170px',
                }}
              >
                {prompt.title}
              </Typography>
              <Typography
                color="dimmed"
                sx={{
                  fontWeight: 300,
                  fontSize: '12px',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: '170px',
                }}
              >
                {prompt.content}
              </Typography>
            </Grid>
            <Grid item style={{ width: '100px' }}>
              <Tooltip title="New Chat From Prompt">
                <IconButton size="small" onClick={()=>runPrompt(prompt)}   aria-label="play">
                  <PlayArrowIcon  fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Prompt">
                <IconButton  size="small" onClick={()=>editPrompt(prompt)}  aria-label="edit">
                  <EditIcon  fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Prompt">
                <IconButton  size="small" onClick={()=>deletePrompt(prompt)}  aria-label="delete">
                  <DeleteIcon  fontSize="small" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Box>
      ))}
       <Divider />
      <Pagination
        count={Math.ceil(total / limit)}
        page={page}
        size="small"
        onChange={handlePageChange}
         variant="outlined"
        color="secondary"
         sx={{ margin: '10px' }}
      />
      <EditPromptModal open={openEdit}
          prompt={prompt}
          callback={async (p) => editPromptCallback(p) } />
      <DeletePromptModal open={openDelete}
          prompt={prompt}
          callback={async (p) => deletePromptCallback(p)}/>
    </ScrollPane>
  );
}

export default Prompts;
