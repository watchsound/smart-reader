/* eslint-disable prettier/prettier */
import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useDispatch } from 'react-redux';

import { MoodBoard } from '../../../../commons/model/MoodBoard';
import { deleteMoodBoardById } from '../../../api/moodBoardApi';
import { moodBoardDeleted } from '../../../store/reducers/moodBoardSlice';
import ConfirmDialog from '../../dialog/ConfirmDialog';

function DeleteMoodeBoardModal({
  moodBoard,
  open,
  callback,
}: {
  moodBoard: MoodBoard;
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
      await deleteMoodBoardById(moodBoard.id);
      dispatch(moodBoardDeleted(moodBoard.id));
      close();
      setAlertContent('moodBoard deleted.');
      setAlert(true);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        setAlertContent('No internet connection.');
        setAlert(true);
      } else {
        setAlertContent(
          "Can't remove moodBoard. Please refresh the page and try again..",
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
        message="Are you sure you want to delete this MoodBoard?"
      />
    </>
  );
}

export default DeleteMoodeBoardModal;
