import { cloneElement, ReactElement, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useSelector, useDispatch } from 'react-redux';

import { Chat } from '../../../commons/model/chat';
import { deleteChat } from '../../api/chatApi';
import { chatDeleted } from '../../store/reducers/chatSlice';
import ConfirmDialog from '../../components/dialog/ConfirmDialog';

function DeleteChatModal({
  chat,
  open,
  callback,
}: {
  chat: Chat;
  open: boolean;
  callback: () => {};
}) {
  const [opened, setOpened] = useState(open);

  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const dispatch = useDispatch();
  useEffect(() => {
    setOpened(open);
  }, [open]);

  const close = () => {
    setOpened(false);
    callback();
  }

  const handleConfirm = async () => {
    try {
      await deleteChat(chat.id);
      dispatch(chatDeleted(chat.id));
      close();
      setAlertContent('Chat deleted.');
      setAlert(true);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        setAlertContent('No internet connection.');
        setAlert(true);
      } else {
        setAlertContent(
          "Can't remove chat. Please refresh the page and try again..",
        );
        setAlert(true);
      }
    } finally {
    }
  };

  return (
    <>
      <Snackbar
        open={alert}
        autoHideDuration={6000}
        onClose={() => setAlert(false)}
      >
        <Alert severity="error">{alertContent}</Alert>
      </Snackbar>

      <ConfirmDialog
        isOpen={opened}
        onClose={close}
        onConfirm={handleConfirm}
        title="Confirm Action"
        message="Are you sure you want to delete this chat?"
      />
    </>
  );
}

export default DeleteChatModal;
