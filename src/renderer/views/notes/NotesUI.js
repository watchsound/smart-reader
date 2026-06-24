/* eslint-disable no-use-before-define */
import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Typography, Pagination, Divider, Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import Tab from '@mui/material/Tab';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import ArticleIcon from '@mui/icons-material/Article';

import NoteCard from './NoteCard';
import CreateNoteCell from './CreateNoteCell';
import NoteUI from '../../components/note/NoteUI';
import CustomizedFilterBase from '../../components/CustomizedFilterBase';
import {
  noteDeleted,
  notesQueried,
} from '../../store/reducers/noteSlice';

import customStorage from '../../store/customStorage';
import BookmarkUI from './BookmarkUI';
import QuizModal from '../../components/surveyjs/QuizModal';
import { deleteNoteById, getNotesByQuery } from '../../api/notesApi';

function NotesUI() {
  const theme = useTheme();
  const [bookmarkItems, setBookmarkItems] = useState([]);
  const [openQuizModal, setOpenQuizModal] = useState(false);
  const [quizProblems, setQuizProblems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [rightTab, setRightTab] = useState('1');

  const navigate = useNavigate();
  const filterKey = useSelector((state) => state.note.filterKey);
  const filterStars = useSelector((state) => state.note.filterStars);
  const filterTags = useSelector((state) => state.note.filterTags);
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

  const queryGenRef = useRef(0);

  const doQuery = async () => {
    const myGen = queryGenRef.current + 1;
    queryGenRef.current = myGen;
    const isStale = () => myGen !== queryGenRef.current;
    if (filterKey && filterKey.trim().indexOf(' ') > 0) {
      const r = await customStorage.semanticQuery(filterKey, 10, undefined);
      if (isStale()) return;
      if (r && r.ids && r.ids.length > 0) {
        const bmItems = [];
        const noteIds = [];
        for (let i = 0; i < r.ids.length; i++) {
          const pos = r.ids[i].indexOf('|');
          if (pos < 0) {
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
          if (isStale()) return;
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
      if (isStale()) return;
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

  const deleteNote = (note) => {
    deleteNoteById(note.id);
    dispatch(noteDeleted(note));
    const localNotes = notes.filter((m) => m.id !== note.id);
    setNotes(localNotes);
    if (selectedNoteId === note.id) {
      setSelectedNoteId(null);
      setRightTab('1');
    }
  };

  const noteAdded = (note) => {
    const localNotes = [note, ...notes];
    setNotes(localNotes);
    setSelectedNoteId(note.id);
    setRightTab('2');
  };

  const handleNoteClick = (note) => {
    setSelectedNoteId(note.id);
    setRightTab('2');
  };

  const bookmarkItemSelectHandler = (bookKey) => {
    navigate(`/reading/${bookKey}`);
  };

  const pageCount = Math.ceil(total / limit);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Filter bar */}
      <Box className="note_header">
        <Box className="note__bottom_row">
          <CustomizedFilterBase
            useForSidePane={false}
            queryActionCallback={doQuery}
          />
        </Box>
      </Box>

      {/* Main body: left list + right detail */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel — note list */}
        <Box
          sx={{
            width: 320,
            minWidth: 280,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${theme.palette.divider}`,
            overflow: 'hidden',
          }}
        >
          {/* Scrollable list */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 1, py: 1 }}>
            {bookmarkItems.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ px: 0.5, pb: 0.5, display: 'block' }}>
                  Semantic matches
                </Typography>
                {bookmarkItems.map((bm) => (
                  <Box key={bm.bookKey + bm.cfi} sx={{ mb: 1 }}>
                    <BookmarkUI
                      content={bm.content}
                      bookKey={bm.bookKey}
                      cfi={bm.cfi}
                      selectHandler={bookmarkItemSelectHandler}
                    />
                  </Box>
                ))}
                <Divider sx={{ my: 1 }} />
              </>
            )}

            {notes.length === 0 && (
              <Typography
                variant="body2"
                color="text.disabled"
                sx={{ textAlign: 'center', mt: 4 }}
              >
                No notes yet
              </Typography>
            )}

            {notes.map((note) => (
              <Box key={note.id} sx={{ mb: 1 }}>
                <NoteCard
                  note={note}
                  viewMode="list"
                  toolbarMode
                  selected={note.id === selectedNoteId}
                  onClick={handleNoteClick}
                  onDelete={deleteNote}
                  onShowQuiz={(quizList) => {
                    setQuizProblems(quizList);
                    setOpenQuizModal(true);
                  }}
                />
              </Box>
            ))}
          </Box>

          {/* Pagination anchored at bottom of list panel */}
          {pageCount > 1 && (
            <>
              <Divider />
              <Pagination
                count={pageCount}
                page={page}
                size="small"
                onChange={handlePageChange}
                variant="outlined"
                color="secondary"
                sx={{ p: 1, display: 'flex', justifyContent: 'center' }}
              />
            </>
          )}
        </Box>

        {/* Right panel — create / detail tabs */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TabContext value={rightTab}>
            <Box sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
              <TabList
                onChange={(_, val) => setRightTab(val)}
                variant="fullWidth"
              >
                <Tab
                  icon={<NoteAddIcon fontSize="small" />}
                  iconPosition="start"
                  label="New Note"
                  value="1"
                  sx={{ minHeight: 44, fontSize: '0.8rem' }}
                />
                <Tab
                  icon={<ArticleIcon fontSize="small" />}
                  iconPosition="start"
                  label="View Note"
                  value="2"
                  disabled={!selectedNoteId}
                  sx={{ minHeight: 44, fontSize: '0.8rem' }}
                />
              </TabList>
            </Box>

            <TabPanel
              value="1"
              sx={{ flex: 1, overflow: 'auto', p: 2 }}
            >
              <CreateNoteCell noteCreationHandler={(note) => noteAdded(note)} />
            </TabPanel>

            <TabPanel
              value="2"
              sx={{ flex: 1, overflow: 'auto', p: 2 }}
            >
              {selectedNoteId && (
                <NoteUI
                  selectedNoteKey={selectedNoteId}
                  selectHandler={() => {}}
                  showQuizHandler={(quizList) => {
                    setQuizProblems(quizList);
                    setOpenQuizModal(true);
                  }}
                  customAction={() => {}}
                  customActionName=""
                  deleteAction={(n) => deleteNote(n)}
                  deleteActionName="Delete"
                  isInNotesUIView
                  toolbarMode
                />
              )}
            </TabPanel>
          </TabContext>
        </Box>
      </Box>

      <QuizModal
        open={openQuizModal}
        quizProblems={quizProblems}
        callback={() => setOpenQuizModal(false)}
        sx={{ minWidth: '360px' }}
      />
    </Box>
  );
}

export default NotesUI;
