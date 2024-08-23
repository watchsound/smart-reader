import { useState, useEffect } from 'react';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import SmallButton from '../Button/SmallButton';
import CardSettingPanel from './CardSettingPanel';
import PageSwitcher from '../note/PageSwitcher';
import { useReplaceNoteMutation } from '../../store/api/noteApiSlice';

function CardSettingModal({ curNote, width, height, open, callback }) {
  const [opened, setOpened] = useState(false);
  const [selectedSide, setSelectedSide] = useState(0);
  const [selectedNote, setSelectedNote] = useState(curNote);
  const [ReplaceNote] = useReplaceNoteMutation();
  useEffect(() => {
    setOpened(open);
  }, [open]);

  const close = () => {
    setOpened(false);
    callback(selectedNote);
  };
  const cardSettingChanged = (cardData) => {
    const updatedNote = {
      ...selectedNote,
      cards: selectedNote.cards.map((m, index) => {
        if (index === selectedSide) return { ...m, ...cardData };
        return m;
      }),
    };
    ReplaceNote(updatedNote);
    setSelectedNote(updatedNote);
  };
  const handleSideChange = (event) => {
    const side = event.target.value;
    setSelectedSide(side);
  };

  return (
    <Dialog
      open={opened}
      onClose={close}
      aria-labelledby="custom-modal-title"
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle id="custom-modal-title" />
      <DialogContent>
        <div className="two_end_container">
          <div className="two_end_start">
            <PageSwitcher
              selectedNote={selectedNote}
              edit={false}
              selectedSide={selectedSide}
              handleSideChange={handleSideChange}
            />
          </div>
          <div className="two_end_end">
            <SmallButton
              onClick={(event) => {
                close();
              }}
            >
              Close
            </SmallButton>
          </div>
        </div>
        <CardSettingPanel
          cardData={selectedNote.cards[selectedSide]}
          cardTitle={selectedNote.title || ''}
          width={width}
          height={height}
          selectionCallback={cardSettingChanged}
        />
      </DialogContent>
    </Dialog>
  );
}

export default CardSettingModal;
