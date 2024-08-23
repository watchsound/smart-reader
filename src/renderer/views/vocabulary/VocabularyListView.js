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
import {
  vocabularyAdded,
} from '../../store/reducers/vocabularySlice';
import TextSearchRow from '../../components/TextSearchRow';
import VocabularyItemView from './VocabularyItemView';
import CreateVocabularyModal from './CreateVocabularyModal';
// //
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

function VocabularyListView({isReviewDue}) {
  // const [apiKey, setApiKey] = useState('');
  const [vocabularies, setVocabularies] = useState([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();


  async function t() {
      const result = isReviewDue ? await customStorage.getVocabulariesByQuery({
        query: search || '',
        page,
        limit,
      }) : await customStorage.getVocabulariesByDueReview({
        dueTime: new Date(),
        page,
        limit,
      }) ;
      if (!result) return;
      setVocabularies(result.data || []);
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

  const handleSave = async (vocabulary) => {
    if (!vocabulary || !vocabulary.name || !vocabulary.definition) return;
     const newOne = await customStorage. createVocabulary(
        {
          word: vocabulary.name,
          detail:  { definition: vocabulary.definition || '', root: vocabulary.relatedWord || '', example: vocabulary.example || '' },
          setId: -1,
          score: 0,
        } );
     if (!newOne) return;
    setVocabularies([newOne, ...vocabularies]);
    dispatch(vocabularyAdded(newOne));
  };

  const createNewVocabularyByAI = async (text) => {
     if (!text || text.length < 3 || text.length > 30) return;
     const exists = await customStorage.getVocabularyByName(text.trim());
     if (exists) return;
     const newOne = await customStorage.addToVocabulary(text);
     if (!newOne) return;
    setVocabularies([newOne, ...vocabularies]);
    dispatch(vocabularyAdded(newOne));

  };

  return (
    <>
    <TextSearchRow
            placeHolder=""
            label="Word"
            sx={{ borderStyle: 'none' }}
            searchAction={(text) => searchIt(text)}
            searchTip="Search Word"
            createAction={(text) => createNewVocabularyByAI(text)}
            createTip="Automatically Create New Word"
            thirdAction={(text) => createNewVocabulary(text)}
            thirdTip="Dialog for Create New Word"
          />
    <ScrollPane>
      {vocabularies.length > 0 && (
        <>
          {vocabularies.map((card) => (
            <VocabularyItemView sx={{ minWidth: 120 }}
               key={card.id}
               vocabulary={card}
                />
          ))}
        </>
      )}

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
     <CreateVocabularyModal
        open={open}
        onClose={handleClose}
        onSave={handleSave}
        word={search}
      />
  </>
  );
}

export default VocabularyListView;
