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

import { Chat } from '../../../commons/model/chat';
import DeleteChatModal from './DeleteChatModal';
import EditChatModal from './EditChatModal';
import MainLink from './MainLink';

import { updateChatPin } from '../../api/chatApi';
import { chatHandled, chatUpdated } from '../../store/reducers/chatSlice';

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

  return (
    <>
      <Box
        key={chat.id}
        className={isActive ? 'active' : undefined}
        sx={(theme) => ({
          flexGrow: 1,
          marginTop: 1,
        })}
      >
        <Grid container sx={{ width: '100%', alignItems: 'center' }}>
          <Grid item xs={12}>
            <MainLink
              icon={
                chat.pinned ? (
                  <PushPinIcon fontSize="small" />
                ) : (
                  <QuestionAnswerOutlinedIcon fontSize="small" />
                )
              }
              color="teal"
              chat={chat}
              label={chat.description}
              popupCallback={handleClick}
            />
          </Grid>

          <Menu
            id="lock-menu"
            open={open}
            onClose={handleClose}
            anchorEl={anchorEl}
            MenuListProps={{
              'aria-labelledby': 'lock-button',
              role: 'listbox',
            }}
          >
            <MenuItem onClick={(event) => toggleChatPinAction(chat.id, event)}>
              <ListItemIcon>
                {chat.pinned ? <NotListedLocationIcon /> : <PinDropIcon />}
              </ListItemIcon>
              <ListItemText />
            </MenuItem>
            <MenuItem
              onClick={async () => {
                setOpenEdit(true);
                handleClose();
              }}
            >
              <ListItemIcon>
                <EditIcon />
              </ListItemIcon>
            </MenuItem>
            <MenuItem
              onClick={async () => {
                setOpenDelete(true);
                handleClose();
              }}
            >
              <ListItemIcon>
                <CloseIcon />
              </ListItemIcon>
            </MenuItem>
          </Menu>
        </Grid>
      </Box>
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
      >
        <Alert severity="error">{alertContent}</Alert>
      </Snackbar>
    </>
  );
}

export default ChatItem;
