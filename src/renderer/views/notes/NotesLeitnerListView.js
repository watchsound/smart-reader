/* eslint-disable prettier/prettier */
import { useMemo, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';
import { green, grey } from '@mui/material/colors';
import { Pagination, Snackbar, Alert } from '@mui/material';
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
  // The CardHeaderNoSwitch ⋮ menu dispatches noteToLeitnerAdded after
  // it writes note.leitner_item_id, but no UI was subscribed — so the
  // list silently kept its stale rows and the action looked like a
  // no-op. Watching this signal triggers a refetch so the user sees
  // the new leitnerItemId reflected on the next render.
  const addedNoteToLeitner = useSelector(
    (state) => state.note.addedNoteToLeitner,
  );
  const [snack, setSnack] = useState(null);

  useEffect(() => {
    if (addedNoteToLeitner == null) return;
    if (
      addedNoteToLeitner === -1 ||
      (typeof addedNoteToLeitner === 'object' && !addedNoteToLeitner?.id)
    ) {
      setSnack({ severity: 'error', message: 'Failed to add note to Leitner' });
    } else if (addedNoteToLeitner.wasAlreadyAdded) {
      setSnack({
        severity: 'info',
        message: 'Note is already in the Leitner system',
      });
    } else {
      setSnack({
        severity: 'success',
        message: 'Note added to Leitner system',
      });
    }
  }, [addedNoteToLeitner]);


  // Tab semantics: isReviewDue=true → "Notes For Review" tab shows the
  // notes that are due today (getNotesByDueReview). isReviewDue=false →
  // "Notes In Query" tab runs the keyword/tag/star filter
  // (getNotesByQuery). The ternary was previously inverted.
  async function t() {
      const result = isReviewDue ? await customStorage.getNotesByDueReview({
        dueTime: new Date(),
        page,
        limit,
      }) : await customStorage.getNotesByQuery({
        query: search || '',
        tag: '',
        star: 0,
        page,
        limit,
      }) ;
      if (!result) return;
      setNotes(result.data || []);
      setTotal(result.total);
    }

  useEffect(() => {
    t();
  }, [page, limit, isReviewDue, addedNoteToLeitner, search]);

  const searchIt = (query) => {
    // setSearch alone triggers refetch via the useEffect dep — no need
    // to call t() here (the immediate call would read stale `search`
    // from this closure and miss the new keyword).
    setSearch(query);
    setPage(1);
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
            cardHeight="125"
            compactView
            useMiniHeight
            maxHeight={160}
            simplifiedMenu
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
      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)}>
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}

export default NotesLeitnerListView;
