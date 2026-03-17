import React from 'react';

import { styled, useTheme, alpha } from '@mui/material/styles';

import { Tabs, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import PropTypes from 'prop-types';
import AddIcon from '@mui/icons-material/Add';
import ChatIcon from '@mui/icons-material/Chat';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useSelector, useDispatch } from 'react-redux';

import { createChat } from '../../api/chatApi';
import TextSearchRow from '../../components/TextSearchRow';
import CreatePromptModal from '../../components/chat/CreatePromptModal';
import Chats from '../../components/chat/Chats';
import Prompts from '../../components/chat/Prompts';
import ChatDetailPanel from './ChatDetailPanel';
import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import { chatAdded, chatHandled } from '../../store/reducers/chatSlice';

const StyledTabs = styled(Tabs)(({ theme }) => ({
  minHeight: 40,
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    backgroundColor: theme.palette.primary.main,
  },
  '& .MuiTabs-flexContainer': {
    gap: theme.spacing(0.5),
  },
}));

const StyledTab = styled((props) => <Tab disableRipple {...props} />)(
  ({ theme }) => ({
    textTransform: 'none',
    minWidth: 0,
    minHeight: 40,
    padding: theme.spacing(1, 2),
    fontSize: '0.8rem',
    fontWeight: 500,
    color: theme.palette.text.secondary,
    borderRadius: '8px 8px 0 0',
    transition: 'all 0.2s ease',
    '&:hover': {
      color: theme.palette.primary.main,
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-selected': {
      color: theme.palette.primary.main,
      fontWeight: 600,
    },
  }),
);

const SidebarHeader = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2, 2, 1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const NewChatButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.2),
    transform: 'scale(1.05)',
  },
}));

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      sx={{
        display: value === index ? 'flex' : 'none',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
      {...other}
    >
      {value === index && children}
    </Box>
  );
}

CustomTabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

function ChatPageView({ chat }) {
  const [tabValue, setTabValue] = React.useState(0);

  const [curChat, setCurChat] = React.useState(chat);

  const [chatSearch, setChatSearch] = React.useState('');
  const [promptSearch, setPromptSearch] = React.useState('');

  const aChat = useSelector((state) => state.chat.curChat);

  const dispatch = useDispatch();
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  React.useEffect(() => {
    if (!chat) return;
    setCurChat(chat);
  }, [chat]);
  React.useEffect(() => {
    if (!aChat) return;
    setCurChat(aChat);
  }, [aChat]);

  const theme = useTheme();

  const handleCreateChat = async (text) => {
    const c = {
      description: text || 'New Chat',
      totalTokens: 0,
      createdAt: new Date(),
      pinned: false,
      autoDelete: false,
    };
    const c2 = await createChat(c);
    if (typeof c2.id === 'undefined') {
      return;
    }
    dispatch(chatAdded(c2));
    setCurChat(c2);
    dispatch(chatHandled(c2));
  };

  const rightPanel = (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.paper,
      }}
    >
      {/* Sidebar Header */}
      <SidebarHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
              AI Assistant
            </Typography>
          </Box>
          <Tooltip title="New Chat">
            <NewChatButton size="small" onClick={() => handleCreateChat()}>
              <AddIcon sx={{ fontSize: 18 }} />
            </NewChatButton>
          </Tooltip>
        </Box>

        {/* Tabs */}
        <StyledTabs
          value={tabValue}
          onChange={handleTabChange}
          variant="fullWidth"
          aria-label="chat tabs"
        >
          <StyledTab
            icon={<ChatIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Chats"
            {...a11yProps(0)}
          />
          <StyledTab
            icon={<BookmarkIcon sx={{ fontSize: 16 }} />}
            iconPosition="start"
            label="Prompts"
            {...a11yProps(1)}
          />
        </StyledTabs>
      </SidebarHeader>

      {/* Tab Panels */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CustomTabPanel value={tabValue} index={0}>
          <Box sx={{ p: 1.5, flexShrink: 0 }}>
            <TextSearchRow
              placeHolder="Search chats..."
              label="title/content"
              sx={{
                borderStyle: 'none',
                bgcolor: alpha(theme.palette.action.hover, 0.5),
                borderRadius: 2,
                '& input': {
                  fontSize: '0.85rem',
                },
              }}
              searchAction={(text) => setChatSearch(text)}
              createAction={handleCreateChat}
            />
          </Box>
          <Chats search={chatSearch} isLearnAbout={false} />
        </CustomTabPanel>

        <CustomTabPanel value={tabValue} index={1}>
          <Box sx={{ p: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <TextSearchRow
                  placeHolder="Search prompts..."
                  label="title/content"
                  sx={{
                    borderStyle: 'none',
                    bgcolor: alpha(theme.palette.action.hover, 0.5),
                    borderRadius: 2,
                    '& input': {
                      fontSize: '0.85rem',
                    },
                  }}
                  searchAction={(text) => setPromptSearch(text)}
                />
              </Box>
              <CreatePromptModal />
            </Box>
          </Box>
          <Prompts onPlay={() => {}} search={promptSearch} />
        </CustomTabPanel>
      </Box>
    </Box>
  );

  const mainPanel = <ChatDetailPanel chatId={curChat ? curChat.id : ''} />;

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={mainPanel}
      rightPanelWidth="240"
      heightAdjust="64px"
    />
  );
}
export default ChatPageView;
