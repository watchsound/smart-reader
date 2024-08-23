import {  useEffect, useState } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import DialogTitle from '@mui/material/DialogTitle';


import LoadingButton from '@mui/lab/LoadingButton';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import {  useDispatch } from 'react-redux';

import { MoodBoard } from '../../../../commons/model/MoodBoard';
import { updateMoodBoard } from '../../../api/moodBoardApi';
import { moodBoardUpdated } from '../../../store/reducers/moodBoardSlice';
import SmallButton from '../../Button/SmallButton';

function EditMoodBoardModal({
  moodBoard,
  open,
  callback,
}: {
  moodBoard: MoodBoard;
  open: boolean;
  callback: () => {};
}) {
  const [opened, setOpened] = useState(open);
  const [submitting, setSubmitting] = useState(false);

  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const dispatch = useDispatch();

  useEffect(() => {
    setValue(moodBoard?.description || '');
    setName(moodBoard?.name || '');
  }, [moodBoard]);
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
      await updateMoodBoard(moodBoard.id, 'name', name);
      const c = await updateMoodBoard(moodBoard.id, 'description', value);
      dispatch(moodBoardUpdated(c));
      close();
      setAlertContent('moodBoard deleted.');
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
        <DialogTitle id="alert-dialog-title">Edit MoodBoard</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            variant="outlined"
            size="small"
            value={name}
            sx={{  height: '35px', marginBottom: '5px' }}
            onChange={(event) => setName(event.currentTarget.value)}
            data-autofocus
          />
          <TextField
            label="Description"
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

export default EditMoodBoardModal;
