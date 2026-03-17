/* eslint-disable camelcase */
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';

import CardActions from '@mui/material/CardActions';

import 'react-tagsinput/react-tagsinput.css';
import 'highlight.js/styles/github.css'; // Import the desired highlight.js CSS style

import '../../CustomizedFilterBase/nodefilter-styles.module.css';
import { Grid } from '@mui/material';
import { getQuizProblemsBySourceKey } from '../../../api/quizApi';
import {
  useGetNoteByIdQuery,
  useReplaceNoteMutation,
} from '../../../store/api/noteApiSlice';
import { getImage } from '../../../api/booksApi';
import PageSwitcher from '../../note/PageSwitcher';
import CardHeaderNoSwitch from '../../note/CardHeaderNoSwitch';
import CardContentSwitcher from '../../note/CardContentSwitcher';
import RichTextActionMenu from '../../richtext/RichTextActionMenu';

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '12px',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  '&:hover': {
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
  },
}));

function DiagramNoteUI({
  selectedNoteKey,
  sourceKey,
  selectHandler,
  showQuizHandler,
  compactView,
  customActionName,
  customAction,
  cardWidth,
  cardHeight,
  deleteActionName,
  deleteAction,
  useBgColor,
  showControl,
}) {
  const [selectedSide, setSelectedSide] = useState(0);
  const [values, setValues] = useState(['', '', '']);

  const [cardTypes, setCardTypes] = useState(['', '', '']);

  const [selectedNote, setSelectedNote] = useState(null);
  const [showAnnotation, setShowAnnotation] = useState(true);
  const [emphasis, setEmphasis] = useState('');
  const [entry, setEntry] = useState('');

  const { data: result } = useGetNoteByIdQuery(selectedNoteKey);

  const [ReplaceNote] = useReplaceNoteMutation();
  // const [CreateImage] = useCreateImageMutation();

  const showNoteOnly = useSelector((state) => state.note.showTextOnly);

  // const dispatch = useDispatch();

  const [, setImagesId] = useState([null, null, null]);
  const [imagesSrc, setImagesSrc] = useState([null, null, null]);
  const [, setTwoTextMore] = useState(false);

  useEffect(() => {
    if (!result) return;
    const { note } = result;
    if (!note) return;
    const t0 = note.cards[0] && note.cards[0].text ? note.cards[0].text : '';
    const t1 = note.cards[1] && note.cards[1].text ? note.cards[1].text : '';
    const t2 = note.cards[2] && note.cards[2].text ? note.cards[2].text : '';

    const i0 = note.cards[0] && note.cards[0].image ? note.cards[0].image : '';
    const i1 = note.cards[1] && note.cards[1].image ? note.cards[1].image : '';
    const i2 = note.cards[2] && note.cards[2].image ? note.cards[2].image : '';

    const cardType0 =
      note.cards[0] && note.cards[0].type ? note.cards[0].type : '';
    const cardType1 =
      note.cards[1] && note.cards[1].type ? note.cards[1].type : '';
    const cardType2 =
      note.cards[2] && note.cards[2].type ? note.cards[2].type : '';

    setValues([t0, t1, t2]);

    async function t() {
      const img0 =
        typeof i0 === 'string' && i0.startsWith('data:image/png;base64')
          ? i0
          : await getImage(i0);
      const img1 =
        typeof i1 === 'string' && i1.startsWith('data:image/png;base64')
          ? i1
          : await getImage(i1);
      const img2 =
        typeof i2 === 'string' && i2.startsWith('data:image/png;base64')
          ? i2
          : await getImage(i2);
      setImagesSrc([img0, img1, img2]);
    }
    t();

    setImagesId([i0, i1, i2]);
    setCardTypes([cardType0, cardType1, cardType2]);

    setSelectedNote(result.note);

    setTwoTextMore(!!t1 || !!t2 || !!i1 || !!i2 || result.note.hasQuiz);
  }, [result]);

  useEffect(() => {
    if (compactView) {
      setShowAnnotation(false);
    }
  }, [compactView]);

  useEffect(() => {
    setShowAnnotation(!showNoteOnly);
  }, [showNoteOnly]);

  const tryToJumpQuiz = async () => {
    if (!selectedNote || !selectedNote.hasQuiz) return;
    const quizList = await getQuizProblemsBySourceKey(selectedNote.id);
    if (quizList && quizList.length > 0) showQuizHandler(quizList);
  };

  const handleSideChange = (event) => {
    const side = event.target.value;
    setSelectedSide(side);
  };

  const updateFieldForNote = (prop2values) => {
    if (!selectedNote) return;
    const updatedNote = {
      ...selectedNote,
      ...prop2values,
    };
    ReplaceNote(updatedNote);
  };

  const updateColorForNote = (newValue) => {
    updateFieldForNote({ color: newValue });
  };

  if (selectedNote == null) return null;
  const hasCard1 = selectedNote.cards[1] && selectedNote.cards[1].text;
  const hasCard2 = selectedNote.cards[2] && selectedNote.cards[2].text;
  const needPageSwitch = hasCard1 || hasCard2 || selectedNote.hasQuiz;

  return (
    <StyledCard
      sx={{
        margin: 0,
        width: '100%',
        height: '100%',
        maxWidth: cardWidth,
        maxHeight: cardHeight,
        backgroundColor: useBgColor ? selectedNote.color : 'white',
      }}
    >
      {showControl && (
        <CardHeaderNoSwitch
          selectedNote={selectedNote}
          compact={!showAnnotation}
          useJumpToSource
          toggleAnnotation={() => setShowAnnotation(!showAnnotation)}
          colorAction={(color) => updateColorForNote(color)}
          customActionName={customActionName}
          customAction={customAction}
          deleteActionName={deleteActionName}
          deleteAction={deleteAction}
        />
      )}
      <CardContentSwitcher
        imageCodes={imagesSrc}
        cardTypes={cardTypes}
        cardDatums={selectedNote ? selectedNote.cards : []}
        title={selectedNote ? selectedNote.title : ''}
        selectedSide={selectedSide}
        cardWidth={cardWidth - 2}
        cardHeight={cardHeight - 2}
        entryEffect={entry}
        emphasisEffect={emphasis}
      />
      {needPageSwitch && (
        <CardActions
          disableSpacing
          sx={{ margin: '0px !important', paddingBottom: '0px !important' }}
        >
          <Grid container spacing={0.5} alignItems="center">
            <Grid
              item
              container
              xs={6}
              justifyContent="flex-start"
              spacing={0.5}
            >
              <RichTextActionMenu
                asIconButton
                emphasisCallback={setEmphasis}
                entryCallback={setEntry}
              />
            </Grid>
            <Grid item container xs={6} justifyContent="flex-end" spacing={0.5}>
              <PageSwitcher
                selectedNote={selectedNote}
                edit={false}
                selectedSide={selectedSide}
                handleSideChange={handleSideChange}
                openQuizView={tryToJumpQuiz}
              />
            </Grid>
          </Grid>
        </CardActions>
      )}
    </StyledCard>
  );
}

export default DiagramNoteUI;
