import { useEffect, useState } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import DialogTitle from '@mui/material/DialogTitle';

import LoadingButton from '@mui/lab/LoadingButton';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import {  useDispatch } from 'react-redux';

import { Chat } from '../../../commons/model/chat';
import { updateChat } from '../../api/chatApi';
import { chatUpdated } from '../../store/reducers/chatSlice';
import SmallButton from '../Button/SmallButton';

function EditChatModal({
  chat,
  open,
  callback,
}: {
  chat: Chat;
  open: boolean;
  callback: () => {};
}) {
  const [opened, setOpened] = useState(open);
  const [submitting, setSubmitting] = useState(false);

  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const [value, setValue] = useState('');
  const dispatch = useDispatch();

  useEffect(() => {
    setValue(chat?.description || '');
  }, [chat]);
  useEffect(() => {
    setOpened(open);
  }, [open]);
  const close = () => {
    setOpened(false);
    callback();
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      const c = await updateChat({
        id: chat.id,
        field: 'description',
        value,
      });
      dispatch(chatUpdated(c));
      close();
      setAlertContent('Chat deleted.');
      setAlert(true);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        setAlertContent('No internet connection..');
        setAlert(true);
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        setAlertContent(message);
        setAlert(true);
      }
    } finally {
      setSubmitting(false);
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
      <Dialog
        open={opened}
        onClose={close}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Edit Chat</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            variant="outlined"
            size="small"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
            data-autofocus
          />
        </DialogContent>
        <DialogActions>
          <SmallButton onClick={close}>Cancel</SmallButton>
          <LoadingButton loading={submitting} onClick={handleConfirm} autoFocus>
            Submit
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default EditChatModal;
