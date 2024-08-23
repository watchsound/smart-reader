import { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import { useSelector, useDispatch } from 'react-redux';
import { Pagination } from '@mui/material';
import Divider from '@mui/material/Divider';

import NoteUI from '../../components/note/NoteUI';
// import NotesContext from './NotesContext';
import CustomizedFilterBase from '../../components/CustomizedFilterBase';
import {
  cfiChangeHandled,
  notesQueried,
} from '../../store/reducers/readerSlice';
import QuizModal from '../../components/surveyjs/QuizModal';
import { getBookNotes } from '../../api/booksApi';
import TextSearchRow from '../../components/TextSearchRow';

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

function BookNotesPanel({ sourceKey, width }) {
  // states
  const [notes, setNotes] = useState([]);
  const [fullNotes, setFullNotes] = useState([]);
  const [openQuizModal, setOpenQuizModal] = useState(false);
  const [quizProblems, setQuizProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [notesInPages, setNotesInPages] = useState([]);
  // const filterKey = useSelector((state) => state.note.filterKey);
  // const filterStars = useSelector((state) => state.note.filterStars);
  // const filterTags = useSelector((state) => state.note.filterTags);

  const bookNotes = useSelector((state) => state.reader.notes);

  const dispatch = useDispatch();

  useEffect(() => {
    setTotal(notes.length);
    const offset = (page - 1) * limit;
    setNotesInPages(notes.slice(offset, offset + limit));
  }, [page, limit, notes]);

  useEffect(() => {
    setFullNotes(bookNotes);
    setNotes(bookNotes);
  }, [bookNotes]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  async function doLocalFiltering(query) {
    if (!query) return;
    setNotes(
      fullNotes.filter((m) => {
        if (m.title && m.title.indexOf(query) >= 0) return true;
        if (
          m.cards &&
          m.cards[0] &&
          m.cards[0].text &&
          m.cards[0].text.indexOf(query) > 0
        )
          return true;
        if (
          m.cards &&
          m.cards[1] &&
          m.cards[1].text &&
          m.cards[1].text.indexOf(query) > 0
        )
          return true;
        if (
          m.cards &&
          m.cards[2] &&
          m.cards[2].text &&
          m.cards[2].text.indexOf(query) > 0
        )
          return true;
        return false;
      }),
    );
  }

  useEffect(() => {
    if (!sourceKey) return;
    async function t() {
      const v = await getBookNotes(sourceKey);
      dispatch(notesQueried(v));
      setFullNotes(bookNotes);
      setNotes(v);
    }
    t();
  }, [sourceKey]);

  const selectHandler = (note) => {
    dispatch(cfiChangeHandled(note.cfi));
  };

  return (
    <>
      <TextSearchRow
        placeHolder="Search"
        label="content"
        sx={{
          width: '100%',
          marginLeft: '4px',
          marginRight: '4px',
          borderStyle: 'none',
        }}
        searchAction={(text) => doLocalFiltering(text)}
      />

      {notesInPages.map((note) => (
        <NoteUI
          key={note.id}
          selectedNoteKey={note.id}
          selectHandler={() => selectHandler(note)}
          showQuizHandler={(quizList) => {
            setQuizProblems(quizList);
            setOpenQuizModal(true);
          }}
          compactView
          customAction={() => {}}
          customActionName=""
          cardWidth={width - 5}
          cardHeight="120"
          useMiniHeight
        />
      ))}
      <Divider />
      <Pagination
        count={Math.ceil(total / limit)}
        page={page}
        size="small"
        onChange={handlePageChange}
        color="primary"
        sx={{ margin: '10px' }}
      />
      <QuizModal
        open={openQuizModal}
        quizProblems={quizProblems}
        callback={() => setOpenQuizModal(false)}
        sx={{ minWidth: '360px' }}
      />
    </>
  );
}

export default BookNotesPanel;
