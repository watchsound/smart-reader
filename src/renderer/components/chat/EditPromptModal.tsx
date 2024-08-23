import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { TextareaAutosize } from '@mui/base/TextareaAutosize';
import LoadingButton from '@mui/lab/LoadingButton';
import { useDispatch } from 'react-redux';

import { Prompt } from '../../../commons/model/chat';
import { updatePrompt } from '../../api/chatApi';
import { promptUpdated } from '../../store/reducers/chatSlice';

function EditPromptModal({
  open,
  prompt,
  callback,
}: {
  open: boolean;
  prompt: Prompt;
  callback: (p: Prompt) => {};
}) {
  const [opened, setOpened] = useState(open);
  const [submitting, setSubmitting] = useState(false);

  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const [value, setValue] = useState('');
  const [title, setTitle] = useState('');
  const dispatch = useDispatch();

  useEffect(() => {
    setValue(prompt?.content || '');
    setTitle(prompt?.title || '');
    setOpened(open);
  }, [prompt, open]);

  function close(p) {
    setOpened(false);
    callback(p);
  }

  const onConfirm = async () => {
    try {
      setSubmitting(true);
      // event.preventDefault();
      const p = {
        ...prompt,
        title,
        content: value,
      };
      await updatePrompt(prompt.id, 'title', title);
      await updatePrompt(prompt.id, 'content', value);
      dispatch(promptUpdated(p));
      close(p);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        setAlertContent('No internet connection.');
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
        onClose={() => close()}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Edit Prompt</DialogTitle>
        <DialogContent>
          <Stack>
            <TextField
              label="Title"
              variant="outlined"
              size="small"
              value={title}
              sx={{  height: '35px', marginBottom: '5px' }}
              onChange={(event) => setTitle(event.currentTarget.value)}
              data-autofocus
            />
            <TextareaAutosize
              minRows={5}
              maxRows={10}
              value={value || ''}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <LoadingButton
            type="submit"
            variant="contained"
            loading={submitting}
            onClick={onConfirm}
            autoFocus
          >
            Save
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default EditPromptModal;
