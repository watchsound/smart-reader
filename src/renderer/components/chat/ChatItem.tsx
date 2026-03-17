import * as React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { NavLink } from 'react-router-dom';
import ListSubheader from '@mui/material/ListSubheader';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import PinDropIcon from '@mui/icons-material/PinDrop';
import MessageIcon from '@mui/icons-material/Message';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Menu from '@mui/material/Menu';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Grid from '@mui/material/Grid';
import MoreVertSharpIcon from '@mui/icons-material/MoreVertSharp';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import { useSelector, useDispatch } from 'react-redux';
import PushPinIcon from '@mui/icons-material/PushPin';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useTheme, alpha, styled } from '@mui/material/styles';

import { Chat } from '../../../commons/model/chat';
import DeleteChatModal from './DeleteChatModal';
import EditChatModal from './EditChatModal';
import MainLink from './MainLink';

import { updateChatPin } from '../../api/chatApi';
import { chatHandled, chatUpdated } from '../../store/reducers/chatSlice';

// Color palette matching BookmarkUI style
const CHAT_COLORS = [
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' },
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' },
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' },
];

const CHAT_COLORS_DARK = [
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
  { bg: '#2D1515', accent: '#F44336', icon: '#E57373' },
  { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
];

// Generate consistent color index from chat id
function getColorIndex(id: string) {
  if (!id) return 0;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % CHAT_COLORS.length;
}

// Styled chat item container
const ChatItemContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isActive' && prop !== 'colors',
})<{ isActive?: boolean; colors?: any }>(({ theme, isActive, colors }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1, 1.5),
  marginBottom: theme.spacing(0.5),
  borderRadius: 10,
  cursor: 'pointer',
  position: 'relative',
  transition: 'all 0.2s ease-in-out',
  backgroundColor: isActive
    ? alpha(colors?.accent || theme.palette.primary.main, 0.12)
    : 'transparent',
  '&:hover': {
    backgroundColor: isActive
      ? alpha(colors?.accent || theme.palette.primary.main, 0.15)
      : alpha(theme.palette.action.hover, 0.08),
    transform: 'translateX(2px)',
  },
  // Left accent stripe when active
  ...(isActive && {
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      width: 3,
      height: '60%',
      backgroundColor: colors?.accent || theme.palette.primary.main,
      borderRadius: 2,
    },
  }),
}));

const ChatIconBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colors',
})<{ colors?: any }>(({ theme, colors }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: colors?.bg || alpha(theme.palette.primary.main, 0.1),
  flexShrink: 0,
}));

function ChatItem({ chat, isActive }: { chat: Chat; isActive: boolean }) {
  const [alert, setAlert] = React.useState(false);
  const [alertContent, setAlertContent] = React.useState('');

  const [openEdit, setOpenEdit] = React.useState(false);
  const [openDelete, setOpenDelete] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [open, setOpen] = React.useState(!!anchorEl);

  const dispatch = useDispatch();
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    event.preventDefault();
    setOpen(true);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setOpen(false);
  };

  const deleteChatCallback = (c) => {
    setAnchorEl(null);
    setOpen(false);
  };

  const toggleChatPinAction = async (chatId: string, event: React.UIEvent) => {
    try {
      event.preventDefault();
      await updateChatPin(chatId, !chat.pinned);
      dispatch(chatUpdated({ ...chat, pinned: !chat.pinned }));
      handleClose();
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        handleClose();
        setAlertContent('No internet connection.');
        setAlert(true);
      }
      const m = error.response?.data?.error?.message;
      if (m) {
        handleClose();
        setAlertContent(m);
        setAlert(true);
      }
    }
  };

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? CHAT_COLORS_DARK : CHAT_COLORS;
  const colorIndex = getColorIndex(chat.id);
  const colors = colorPalette[colorIndex];
  const [isHovered, setIsHovered] = React.useState(false);

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      <ChatItemContainer
        isActive={isActive}
        colors={colors}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Chat Icon */}
        <ChatIconBadge colors={colors}>
          {chat.pinned ? (
            <PushPinIcon sx={{ fontSize: 16, color: colors.icon }} />
          ) : (
            <ChatBubbleOutlineIcon sx={{ fontSize: 16, color: colors.icon }} />
          )}
        </ChatIconBadge>

        {/* Chat Info */}
        <Box
          sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          onClick={() => dispatch(chatHandled(chat))}
        >
          <NavLink
            to={`/chats/${chat.id}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.85rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isActive ? colors.icon : 'text.primary',
              }}
            >
              {chat.description || 'New Chat'}
            </Typography>
            {chat.createdAt && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.disabled',
                  display: 'block',
                }}
              >
                {formatDate(chat.createdAt)}
              </Typography>
            )}
          </NavLink>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          <Tooltip title="More options">
            <IconButton
              size="small"
              onClick={handleClick}
              sx={{
                width: 28,
                height: 28,
                '&:hover': {
                  bgcolor: alpha(colors.accent, 0.15),
                },
              }}
            >
              <MoreVertIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Context Menu */}
        <Menu
          id="chat-menu"
          open={open}
          onClose={handleClose}
          anchorEl={anchorEl}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              borderRadius: 2,
              minWidth: 150,
              boxShadow: isDark
                ? `0 4px 20px ${alpha('#000', 0.4)}`
                : `0 4px 20px ${alpha('#000', 0.12)}`,
            },
          }}
        >
          <MenuItem onClick={(event) => toggleChatPinAction(chat.id, event)}>
            <ListItemIcon>
              {chat.pinned ? (
                <NotListedLocationIcon fontSize="small" />
              ) : (
                <PinDropIcon fontSize="small" />
              )}
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2">
                {chat.pinned ? 'Unpin' : 'Pin'}
              </Typography>
            </ListItemText>
          </MenuItem>
          <MenuItem
            onClick={async () => {
              setOpenEdit(true);
              handleClose();
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2">Edit</Typography>
            </ListItemText>
          </MenuItem>
          <Divider sx={{ my: 0.5 }} />
          <MenuItem
            onClick={async () => {
              setOpenDelete(true);
              handleClose();
            }}
            sx={{
              color: 'error.main',
              '&:hover': {
                bgcolor: alpha(theme.palette.error.main, 0.08),
              },
            }}
          >
            <ListItemIcon>
              <CloseIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>
              <Typography variant="body2">Delete</Typography>
            </ListItemText>
          </MenuItem>
        </Menu>
      </ChatItemContainer>

      <EditChatModal
        open={openEdit}
        chat={chat}
        callback={async () => setOpenEdit(false)}
      />
      <DeleteChatModal
        open={openDelete}
        chat={chat}
        callback={async () => deleteChatCallback(false)}
      />
      <Snackbar
        open={alert}
        autoHideDuration={6000}
        onClose={() => setAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="error"
          variant="filled"
          sx={{ borderRadius: 2 }}
        >
          {alertContent}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ChatItem;
