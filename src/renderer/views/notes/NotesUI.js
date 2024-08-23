/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, Grid, Typography, Pagination, Divider } from '@mui/material';

import CreateNoteCell from './CreateNoteCell';
import NoteUI from '../../components/note/NoteUI';
// import NotesContext from './NotesContext';
import CustomizedFilterBase from '../../components/CustomizedFilterBase';
// import { useGetNotesByQueryQuery } from '../../store/api/noteApiSlice';
import {
  NoteFilterType,
  noteDeleted,
  notesQueried,
} from '../../store/reducers/noteSlice';

import customStorage from '../../store/customStorage';
import BookmarkUI from './BookmarkUI';
import QuizModal from '../../components/surveyjs/QuizModal';
import { deleteNoteById, getNotesByQuery } from '../../api/notesApi';

function NotesUI() {
  // states

  const [bookmarkItems, setBookmarkItems] = useState([]);
  // const [notesFiltered, setNotesFiltered] = useState([]);
  const [openQuizModal, setOpenQuizModal] = useState(false);
  const [quizProblems, setQuizProblems] = useState([]);

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [notes, setNotes] = useState([]);
  const navigate = useNavigate();

  const filterKey = useSelector((state) => state.note.filterKey);
  const filterStars = useSelector((state) => state.note.filterStars);
  const filterTags = useSelector((state) => state.note.filterTags);

  // const notes = useSelector((state) => state.note.notes);
  const dispatch = useDispatch();
  useEffect(() => {
    async function t() {
      const result = await getNotesByQuery({
        query: '',
        tag: filterTags && filterTags.length > 0 ? filterTags[0] : '',
        star: filterStars || 0,
        page,
        limit,
      });
      setNotes(result.data || []);
      setTotal(result.total);
      dispatch(notesQueried(result.data));
    }
    t();
  }, []);

  const doQuery = async () => {
    if (filterKey && filterKey.trim().indexOf(' ') > 0) {
      const r = await customStorage.semanticQuery(filterKey, 10, undefined);
      if (r && r.ids && r.ids.length > 0) {
        const bmItems = [];
        const noteIds = [];
        for (let i = 0; i < r.ids.length; i++) {
          const pos = r.ids[i].indexOf('|');
          if (pos < 0) {
            // it is a bad design .. use | to mark epub
            noteIds.push(r.ids[i]);
          } else {
            const bookKey = r.ids[i].substring(0, pos);
            const cfi = r.ids[i].substring(pos + 1);
            bmItems.push({ content: r.documents[i], bookKey, cfi });
          }
        }
        setBookmarkItems(bmItems);
        if (noteIds.length > 0) {
          const ns = await customStorage.getNotesByIds(noteIds);
          setNotes(ns);
        } else {
          setNotes([]);
        }
      }
    } else {
      const result = await getNotesByQuery({
        query: filterKey,
        tag: filterTags && filterTags.length > 0 ? filterTags[0] : '',
        star: filterStars || 0,
        page,
        limit,
      });
      setNotes(result.data || []);
      setTotal(result.total);
      dispatch(notesQueried(result.data));
    }
  };

  useEffect(() => {
    doQuery();
  }, [filterKey, filterStars, filterTags, page, limit]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  // const filterLocalNotes = (notes) => {
  //   // notes = notes || [];
  //   if (filterBy === NoteFilterType.KEYWORD) {
  //     if (!filterKey) return notes;
  //     return notes.filter((item) => {
  //       for (let i = 0; i < item.cards.length; i++) {
  //         const card = item.cards[i];
  //         if (card && card.text && card.text.indexOf(filterKey) >= 0)
  //           return true;
  //       }
  //       return false;
  //     });
  //   }
  //   if (filterBy === NoteFilterType.STARS) {
  //     return notes.filter((item) => item.rate >= filterStars);
  //   }
  //   if (filterBy === NoteFilterType.TAGS) {
  //     return notes.filter((item) => {
  //       for (const i in filterTags) {
  //         if (!item.tags.includes(filterTags[i])) {
  //           return false;
  //         }
  //       }
  //       return true;
  //     });
  //   }
  //   // if none of above return all todos
  //   return notes;
  // };

  const deleteNote = (note) => {
    deleteNoteById(note.id);
    dispatch(noteDeleted(note));
    const localNotes = notes.filter((m) => m.id !== note.id);
    setNotes(localNotes);
  };

  const noteAdded = (note) => {
    const localNotes = [note, ...notes];
    setNotes(localNotes);
  };

  const bookmarkItemSelectHandler = (bookKey, cfi) => {
    navigate(`/reading/${bookKey}`);
  };

  return (
    <>
      <div className="note_header">
        <div className="note__bottom_row">
          <CustomizedFilterBase
            useForSidePane={false}
            queryActionCallback={doQuery}
          />
        </div>
      </div>
      {bookmarkItems.length > 0 && (
        <div
          className="notes"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
        >
          {bookmarkItems.map((note) => (
            <BookmarkUI
              key={note.bookKey + note.cfi}
              content={note.content}
              bookKey={note.bookKey}
              cfi={note.cfi}
              selectHandler={bookmarkItemSelectHandler}
            />
          ))}
        </div>
      )}
      <div
        className="notes"
        style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}
      >
        <CreateNoteCell noteCreationHandler={(note) => noteAdded(note)} />
        {notes.map((note) => (
          <NoteUI
            key={note.id}
            selectedNoteKey={note.id}
            selectHandler={() => {}}
            showQuizHandler={(quizList) => {
              setQuizProblems(quizList);
              setOpenQuizModal(true);
            }}
            customAction={() => {}}
            customActionName=""
            deleteAction={(n) => deleteNote(n)}
            deleteActionName="Delete"
            cardWidth="360"
            cardHeight="450"
            isInNotesUIView
          />
        ))}
      </div>
      <Divider />
      <Pagination
        count={Math.ceil(total / limit)}
        page={page}
        size="small"
        onChange={handlePageChange}
        variant="outlined"
        color="secondary"
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

export default NotesUI;
