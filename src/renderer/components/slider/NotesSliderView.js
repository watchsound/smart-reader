import { useState, useEffect } from 'react';
import Slider from 'react-slick';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import SmallButton from '../Button/SmallButton';
import NoteUI from '../note/NoteUI';

import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './NotesSliderView.css';

const settings = {
  dots: true,
};

export default function NotesSliderView({ notes, open, callback }) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    setOpened(open);
  }, [open]);

  const close = () => {
    setOpened(false);
    callback();
  };

  return (
    <Dialog
      open={opened}
      onClose={() => setOpened(false)}
      aria-labelledby="custom-modal-title"
      maxWidth="sm"
      fullWidth
      sx={{ margin: '4px' }}
    >
      <DialogTitle id="custom-modal-title" sx={{ margin: '4px' }} />
      <DialogContent>
        <div className="image-slider-container">
          <Slider {...settings}>
            {notes.map((note) => (
              <div key={note.id}>
                <NoteUI
                  key={note.id}
                  selectedNoteKey={note.id}
                  selectHandler={() => {}}
                  customAction={() => {}}
                  customActionName=""
                  deleteAction={(n) => {}}
                  showQuizHandler={() => {}}
                  deleteActionName=""
                  cardWidth="460"
                  cardHeight="560"
                  useBgColor
                />
              </div>
            ))}
          </Slider>
        </div>
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
