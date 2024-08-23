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

// import { useGetChatsByQueryQuery } from '../../store/api/chatApiSlice';
import customStorage from '../../store/customStorage';
import {
  curVocabularySetHandled,
} from '../../store/reducers/vocabularySlice';
import TextSearchRow from '../../components/TextSearchRow';

// const ColoredTextTypography = styled(Typography)({
//   color: green[500],
//   variants: 'h6',
//   fontSize: '12px',
// });
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
function VocabularySetListView() {
  const [vocabularySetList, setVocabularySetList] = useState([]);
  const [vocabularySet, setVocabularySet] = useState([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const dispatch = useDispatch();

 async function t() {
      const result = await customStorage.getVocabularySetByQuery({
        query: search || '',
        page,
        limit,
      });
      if (!result) return; // never happen
      setVocabularySetList(result.data || []);
      setTotal(result.total);
    }
  useEffect(() => {
    t();
  }, [page, limit]);

  const searchIt = (query) => {
    setSearch(query);
    setPage(1);
    t();
  };
  const handlePageChange = (event, value) => {
    setPage(value);
  };
  const vocabularySetSelected = (vocabularySet) => {
    if (!vocabularySet) return;
    setVocabularySet(vocabularySet);
    dispatch(curVocabularySetHandled(vocabularySet));
  };

  const createNewVocabularySet = async (text) => {
      const v = await customStorage.createVocabularySet({
        name: text,
        score: 0,
        lastTimeAt: '',
      });
      setVocabularySetList([v, ...vocabularySetList])
  };

  return (
    <>
      <TextSearchRow
            placeHolder="Search"
            label="title"
            sx={{ borderStyle: 'none' }}
            searchAction={(text) => searchIt(text)}
            createAction={(text) => createNewVocabularySet(text)}
          />
    <ScrollPane>
      {vocabularySetList.length > 0 && (
        <>
          {vocabularySetList.map((cardset) => (
            <Card sx={{ minWidth: 120 }} key={cardset.id}>
              <CardContent>
                <Typography
                  sx={{ fontSize: 14 }}
                  color="text.secondary"
                  gutterBottom
                >
                  {cardset.name}
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" onClick={() => vocabularySetSelected(cardset)}>
                  Select
                </Button>
              </CardActions>
            </Card>
          ))}
        </>
      )}

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
   </>
  );
}

export default VocabularySetListView;
