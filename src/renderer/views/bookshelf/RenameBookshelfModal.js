import { useEffect, useState } from 'react';
import { v4 as uuid } from 'uuid';
import Box from '@mui/material/Box';

import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import AddRoadIcon from '@mui/icons-material/AddRoad';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useDispatch } from 'react-redux';

import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';

import { bookshelfRenamed } from '../../store/reducers/bookshelfSlice';
import SmallButton from '../../components/Button/SmallButton';
import customStorage from '../../store/customStorage';

function RenameBookshelfModal({ open,  bookshelf, callback }) {
  const [opened, setOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const [value, setValue] = useState('');

  const dispatch = useDispatch();

  useEffect(() => {
    if (!bookshelf) return;
    setValue(bookshelf.name || '');
  }, [bookshelf]);
  useEffect(() => {
    setOpened(open);
  }, [open]);
  return (
    <>
      <Tooltip title="Rename bookshelf">
        <IconButton
          size="small"
          onClick={() => setOpened(true)}
          aria-label="create"
        >
          <AddRoadIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Snackbar
        open={alert}
        autoHideDuration={6000}
        onClose={() => setAlert(false)}
      >
        <Alert severity="error">{alertContent}</Alert>
      </Snackbar>
      <Dialog
        open={opened}
        onClose={() => setOpened(false)}
        aria-labelledby="custom-modal-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="custom-modal-title">Rename bookshelf</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2, // Adjust the space between rows
            }}
          >
            <TextField
              label="Title"
              value={value}
              variant="outlined"
              sx={{ height: '35px', marginBottom: '5px' }}
              onChange={(event) => setValue(event.currentTarget.value)}
              data-autofocus
            />
            <TextField
              placeholder="Content"
              multiline
              rows={4} //
              value={value}
              sx={{ marginBottom: '5px' }}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <SmallButton
            onClick={async (event) => {
              try {
                if ( !value) return;
                setSubmitting(true);
                event.preventDefault();
                const bookshelf2 = await customStorage.renameBookshelf(bookshelf.id, value);
                dispatch(bookshelfRenamed(bookshelf2));
                setAlertContent('Bookshelf renamed.');
                setAlert(true);
                setOpened(false);
                callback();
              } catch (error) {
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
            }}
          >
            Rename
          </SmallButton>
          <SmallButton
            onClick={(event) => {
              setOpened(false);
            }}
          >
            Close
          </SmallButton>
          {/* Add more action buttons if needed */}
        </DialogActions>
      </Dialog>
    </>
  );
}

export default RenameBookshelfModal;
