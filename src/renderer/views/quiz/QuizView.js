import React, { useState, useEffect } from 'react';

import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';

import Typography from '@mui/material/Typography';
import { Grid, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
// import Tabs from '@mui/material/Tabs';
// import Tab from '@mui/material/Tab';
// import TabList from '@mui/lab/TabList';
// import TabContext from '@mui/lab/TabContext';
// import TabPanel from '@mui/lab/TabPanel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import LockResetIcon from '@mui/icons-material/LockReset';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
// import { v4 as uuid } from 'uuid';

import { useDispatch } from 'react-redux';
import Pagination from '@mui/material/Pagination';
import Divider from '@mui/material/Divider';

import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import customStorage from '../../store/customStorage';
import InstantResultQuiz from '../../components/surveyjs/InstantResultQuiz';
// import ReviewQuiz from '../../components/surveyjs/ReviewQuiz';
import ScoredQuiz from '../../components/surveyjs/ScoredQuiz';
// import { QuizProblem } from '../../../commons/model/Quiz';
import { quizToSurveyJs } from '../../components/surveyjs/SurveyUtil';
import { QuizType } from '../../../commons/model/DataTypes';
import { truncString } from '../../../commons/utils/commonUtil';
import { getQuizProblemByQuery } from '../../api/quizApi';
import TextSearchRow from '../../components/TextSearchRow';
import { quizQueried } from '../../store/reducers/quizSlice';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

// const MyTabPanel = styled(TabPanel)({
//   padding: '1px 1px',
//   margin: '1px 1px',
// });
const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 60px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));
/**
 *
 * @param {*} param0
 * @returns
 */
function QuizPageView() {
  // const isSmOrDown = useMediaQuery(theme.breakpoints.down('sm'));
  // const [tabValue, setTabValue] = React.useState('1');
  const [quizProblems, setQuizProblems] = useState([]);
  const [surveyProblems, setSurveyProblems] = useState(null);
  const [quizType, setQuizType] = useState(QuizType.InstantResultQuiz);
  const [quizList, setQuizList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');

  const theme = useTheme();
  const dispatch = useDispatch();
  // const handleTabChange = (event, newValue) => {
  //   setTabValue(newValue);
  // };

  useEffect(() => {
    if (!quizProblems || quizProblems.length === 0) return;
    async function t() {
      const r = await quizToSurveyJs(quizProblems);
      setSurveyProblems(r);
      const qt = await customStorage.getItem('quiz_type');
      setQuizType(qt || QuizType.InstantResultQuiz);
    }
    t();
  }, [quizProblems]);

  useEffect(() => {
    async function t() {
      const result = await getQuizProblemByQuery({
        query: search || '',
        page,
        limit,
      });
      setQuizList(result.data || []);
      setTotal(result.total);
      dispatch(quizQueried(result.data));
    }
    t();
  }, [search, page, limit]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const mainPanel = (
    <Grid container spacing={1} sx={{ width: '100%' }}>
      <Grid item xs>
        {surveyProblems && quizType === QuizType.InstantResultQuiz && (
          <InstantResultQuiz
            quizJson={surveyProblems}
            quizProblems={quizProblems}
          />
        )}
        {surveyProblems && quizType !== QuizType.InstantResultQuiz && (
          <ScoredQuiz quizJson={surveyProblems} quizProblems={quizProblems} />
        )}
      </Grid>
    </Grid>
  );

  const rightPanel = (
    <Box sx={{ width: '100%' }}>
      <TextSearchRow
        placeHolder="Search"
        label="content"
        sx={{ width: '240px', borderStyle: 'none' }}
        searchAction={(text) => setSearch(text)}
        createAction={() => setQuizProblems([])}
        createButton={<LockResetIcon />}
        createTip="Reset,Clear Quiz"
      />
      <ScrollPane>
        {quizList.map((quiz) => (
          <Card
            key={quiz.id}
            sx={{
              marginTop: 1,
              width: '100%',
              padding: theme.spacing(1),
            }}
          >
            <Grid container alignItems="center">
              <Grid item xs>
                <Typography
                  variant="body4" // Choose the variant that fits your needs
                  sx={{
                    fontSize: '14px', // Apply the desired font weight
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    maxWidth: '170px',
                  }}
                >
                  {truncString(quiz.question, 30)}
                </Typography>
              </Grid>
              <Grid item xs>
                <Typography
                  variant="body6" // Choose the variant that fits your needs
                  sx={{
                    fontSize: '12px', // Apply the desired font weight
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    maxWidth: '170px',
                  }}
                >
                  {truncString(
                    (quiz.options && quiz.options.optionA) || '',
                    40,
                  )}
                </Typography>
              </Grid>
              <Grid container spacing={0.1} alignItems="center">
                <Grid item xs={10} justifyContent="flex-start">
                  {quiz.correct > 0 && (
                    <Tooltip title="Correct">
                      <IconButton size="small">
                        <CheckIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {quiz.correct < 0 && (
                    <Tooltip title="Incorrect">
                      <IconButton size="small">
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Grid>
                <Grid item xs={2} justifyContent="flex-end">
                  <Tooltip title="Add To ProblemSet">
                    <IconButton
                      size="small"
                      onClick={() => setQuizProblems([...quizProblems, quiz])}
                      aria-label="play"
                      sx={{
                        backgroundColor: mapToPredefinedColor(
                          `${quiz.sourceKey}`,
                        ),
                      }}
                    >
                      <PlaylistAddIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
            </Grid>
          </Card>
        ))}
        <Divider />
        <Pagination
          count={Math.ceil(total / limit)}
          page={page}
          onChange={handlePageChange}
          variant="outlined"
          color="secondary"
          sx={{ margin: '10px' }}
        />
      </ScrollPane>
    </Box>
  );

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={mainPanel}
      rightPanelWidth="240"
    />
  );
}
export default QuizPageView;
