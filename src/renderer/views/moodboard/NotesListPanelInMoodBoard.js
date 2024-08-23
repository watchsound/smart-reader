import { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Grid, Typography, Pagination, Divider } from '@mui/material';
import { isEmpty } from '../../../commons/utils/commonUtil';
import NoteUI from '../../components/note/NoteUI';

import { getNotesByQuery } from '../../api/notesApi';

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

function NotesListPanelInMoodBoard({ query, noteSelectionHandler }) {
  // states
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  //  const dispatch = useDispatch();

  useEffect(() => {
    async function t() {
      const result = await getNotesByQuery({
        query: query || '',
        tag: '',
        star: 0,
        page,
        limit,
      });
      setNotes(result.data || []);
      setTotal(result.total);
    }
    t();
  }, [query, page, limit]);

  const selectHandler = (note) => {
    noteSelectionHandler(note);
  };

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  return (
    <ScrollPane>
      {notes.map((note) => (
        <NoteUI
          key={note.id}
          selectedNoteKey={note.id}
          selectHandler={() => {}}
          compactView
          useMiniHeight
          customAction={() => selectHandler(note)}
          customActionName="Use it in MoodBoard"
          cardWidth="310"
          cardHeight="280"
        />
      ))}
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
    </ScrollPane>
  );
}

export default NotesListPanelInMoodBoard;
