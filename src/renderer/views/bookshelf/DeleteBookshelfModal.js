/* eslint-disable prettier/prettier */
import { useEffect, useState } from 'react';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { useDispatch } from 'react-redux';

import { deleteBookshelfById } from '../../api/bookshelfApi';
import { bookshelfDeleted } from '../../store/reducers/bookshelfSlice';
import ConfirmDialog from '../../components/dialog/ConfirmDialog';

function DeleteBookshelfModal({
  bookshelf,
  open,
  callback,
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
      await deleteBookshelfById(bookshelf.id);
      dispatch(bookshelfDeleted(bookshelf));
      close();
      setAlertContent('bookshelf deleted.');
      setAlert(true);
    } catch (error) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        setAlertContent('No internet connection.');
        setAlert(true);
      } else {
        setAlertContent(
          "Can't remove bookshelf. Please refresh the page and try again..",
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
        message="Are you sure you want to delete this bookshelf?"
      />
    </>
  );
}

export default DeleteBookshelfModal;
