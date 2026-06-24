/* eslint-disable prettier/prettier */
import { useMemo, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';
import { green, grey } from '@mui/material/colors';
import { Pagination } from '@mui/material';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
// import OpenAI from 'openai';
// import { useGetChatsByQueryQuery } from '../../store/api/chatApiSlice';
import customStorage from '../../store/customStorage';

import TextSearchRow from '../../components/TextSearchRow';
import NoteUI from '../../components/note/NoteUI';
// //
const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  paddingBottom: '16px',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

function NotesLeitnerListView({isReviewDue}) {
  // const [apiKey, setApiKey] = useState('');
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();


  async function t() {
      const result = isReviewDue ? await customStorage.getNotesByQuery({
        query: search || '',
        tag: '',
        star: 0,
        page,
        limit,
      }) : await customStorage.getNotesByDueReview({
        dueTime: new Date(),
        page,
        limit,
      }) ;
      if (!result) return;
      setNotes(result.data || []);
      setTotal(result.total);
    }

  useEffect(() => {
    t();
  }, [page, limit, isReviewDue]);

  const searchIt = (query) => {
    setSearch(query);
    setPage(1)
    t();
  };
  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const createNewVocabulary = (query) => {
    setSearch(query);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <TextSearchRow
        placeHolder=""
        label="Note"
        searchAction={(text) => searchIt(text)}
        searchTip="Search Note"
        sx={{ borderStyle: 'none' }}
      />
      <ScrollPane>
        {notes.length > 0 && notes.map((note) => (
          <NoteUI
            key={note.id}
            selectedNoteKey={note.id}
            cardWidth="230"
            cardHeight="280"
            compactView
            useMiniHeight
            maxHeight={360}
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
      </ScrollPane>
    </>
  );
}

export default NotesLeitnerListView;
