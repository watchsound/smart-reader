import { useEffect, useMemo, useState } from 'react';
import Typography from '@mui/material/Typography';
import { Divider, Pagination } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from '@mui/material/styles';
import { green, grey } from '@mui/material/colors';

import MoodBoardItem from './MoodBoardItem';
import { getMoodBoardsByQuery } from '../../../api/moodBoardApi';
import { moodBoardQueried } from '../../../store/reducers/moodBoardSlice';

const ColoredTextTypography = styled(Typography)({
  color: green[500],
  variants: 'h6',
  fontSize: '12px',
});
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
function MoodBoardList({ moodBoardSearch }) {
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [moodBoards, setMoodBoards] = useState([]);

  const curMoodBoard = useSelector((state) => state.moodBoard.curMoodBoard);

  const dispatch = useDispatch();

  useEffect(() => {
    async function t() {
      const result = await getMoodBoardsByQuery(moodBoardSearch, page, limit);
      setMoodBoards(result.data || []);
      setTotal(result.total);
      dispatch(moodBoardQueried(result.data));
    }
    t();
  }, [moodBoardSearch]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  return (
    <ScrollPane>
      {moodBoards.map((board) => (
        <MoodBoardItem
          key={board.id}
          moodBoard={board}
          isActive={curMoodBoard && curMoodBoard.id === board.id}
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

export default MoodBoardList;
