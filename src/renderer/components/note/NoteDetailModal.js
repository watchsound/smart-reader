import { useState, useEffect } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import SmallButton from '../Button/SmallButton';
import NoteUI from './NoteUI';

function NoteDetailModal({note, open, callback}) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    setOpened(open);
  }, [open]);

  const close = () => {
    setOpened(false);
    callback();
  }

  return (
    <Dialog
      open={opened}
      onClose={() => setOpened(false)}
      aria-labelledby="custom-modal-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="custom-modal-title" />
      <DialogContent>
        <NoteUI
          key={note.id}
          selectedNoteKey={note.id}
          selectHandler={() => {}}
          customAction={() => {}}
          customActionName=""
          showQuizHandler={() => {}}
          deleteAction={(n) => {}}
          deleteActionName=""
          cardWidth="1200"
          cardHeight="850"
        />
      </DialogContent>
      <DialogActions>
        <SmallButton
          onClick={(event) => {
            close();
          }}
        >
          Close
        </SmallButton>
      </DialogActions>
    </Dialog>
  );
}

export default NoteDetailModal;
