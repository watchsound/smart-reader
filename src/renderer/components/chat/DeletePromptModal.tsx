import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import DialogTitle from '@mui/material/DialogTitle';

import Typography from '@mui/material/Typography';

import Stack from '@mui/material/Stack';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import {  useDispatch } from 'react-redux';

import { deletePrompt } from '../../api/chatApi';
import { promptDeleted } from '../../store/reducers/chatSlice';
import { Prompt } from '../../../commons/model/chat';
import SmallButton from '../Button/SmallButton';

function DeletePromptModal({
  prompt,
  open,
  callback,
}: {
  prompt: Prompt;
  open: boolean;
  callback: (p: Prompt) => {};
}) {
  const [opened, setOpened] = useState(open);

  const [submitting, setSubmitting] = useState(false);

  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');
  const dispatch = useDispatch();

  useEffect(() => {
    setOpened(open);
  }, [open]);

  const onClose = (p) => {
    setOpened(false);
    callback(p);
  };

  const onConfirm = async () => {
    try {
      setSubmitting(true);
      // event.preventDefault();
      await deletePrompt(prompt.id);
      dispatch(promptDeleted(prompt.id));
      setOpened(false);
      callback(prompt);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        setAlertContent('No internet connection.');
        setAlert(true);
      } else {
        setAlertContent(
          "Can't remove chat. Please refresh the page and try again.",
        );
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
        onClose={() => close()}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Delete Prompt</DialogTitle>
        <DialogContent>
          <Stack>
            <Typography>
              Are you sure you want to delete this prompt?
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <SmallButton onClick={onClose}>Cancel</SmallButton>
          <SmallButton onClick={onConfirm} autoFocus>
            Confirm
          </SmallButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default DeletePromptModal;
