import React from 'react';

import { styled } from '@mui/material/styles';

import { Tabs, Typography } from '@mui/material';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import PropTypes from 'prop-types';

import { useSelector, useDispatch } from 'react-redux';

import { createChat } from '../../api/chatApi';
import TextSearchRow from '../../components/TextSearchRow';
import CreatePromptModal from '../../components/chat/CreatePromptModal';
import Chats from '../../components/chat/Chats';
import Prompts from '../../components/chat/Prompts';
import ChatDetailPanel from './ChatDetailPanel';
import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import { chatAdded, chatHandled } from '../../store/reducers/chatSlice';

const AntTabs = styled(Tabs)({
  borderBottom: '1px solid #e8e8e8',
  '& .MuiTabs-indicator': {
    backgroundColor: '#1890ff',
  },
});

const AntTab = styled((props) => <Tab disableRipple {...props} />)(
  ({ theme }) => ({
    textTransform: 'none',
    minWidth: 0,
    [theme.breakpoints.up('sm')]: {
      minWidth: 0,
    },
    fontSize: '11px',
    fontWeight: theme.typography.fontWeightRegular,
    //  marginRight: theme.spacing(1),
    color: 'rgba(0, 0, 0, 0.85)',
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    '&:hover': {
      color: '#40a9ff',
      opacity: 1,
    },
    '&.Mui-selected': {
      color: '#1890ff',
      fontWeight: theme.typography.fontWeightMedium,
    },
    '&.Mui-focusVisible': {
      backgroundColor: '#d1eaff',
    },
  }),
);

function CustomTabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          <Typography component="div">{children}</Typography>
        </Box>
      )}
    </div>
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

  const rightPanel = (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ bgcolor: '#fff' }}>
        <AntTabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons
          allowScrollButtonsMobile
          aria-label="scrollable"
        >
          <AntTab label="Chats" {...a11yProps(0)} />
          <AntTab label="Prompts" {...a11yProps(1)} />
        </AntTabs>
      </Box>
      <CustomTabPanel value={tabValue} index={0}>
        <TextSearchRow
          placeHolder="Search"
          label="title/content"
          sx={{ borderStyle: 'none' }}
          searchAction={(text) => setChatSearch(text)}
          createAction={async (text) => {
            // const id = uuid();
            const c = {
              //  id,
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
          }}
        />
        <Chats search={chatSearch} />
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        <TextSearchRow
          placeHolder="Search"
          label="title/content"
          sx={{ borderStyle: 'none' }}
          searchAction={(text) => setPromptSearch(text)}
          createButton={<CreatePromptModal />}
        />
        <Prompts onPlay={() => {}} search={promptSearch} />
      </CustomTabPanel>
    </Box>
  );

  const mainPanel = <ChatDetailPanel chatId={curChat ? curChat.id : ''} />;

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={mainPanel}
      rightPanelWidth="240"
    />
  );
}
export default ChatPageView;
