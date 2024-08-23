/* eslint-disable prettier/prettier */
import React, {  useEffect,   useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';


import customStorage from '../../store/customStorage';
import { QuizProblem } from '../../../commons/model/Quiz';
import { quizToSurveyJs } from './SurveyUtil';
import { QuizType } from '../../../commons/model/DataTypes';

import InstantResultQuiz from './InstantResultQuiz';
import ScoredQuiz from './ScoredQuiz';
import SmallButton from '../Button/SmallButton';

function QuizModal({
  open,
  quizProblems,
  callback,
}: {
  open: boolean;
  quizProblems: QuizProblem[];
  callback: () => {};
}) {
  const [opened, setOpened] = useState(open);
  const [surveyProblems, setSurveyProblems] = useState(null);
  const [quizType, setQuizType] = useState(QuizType.InstantResultQuiz);
  useEffect(() => {
    if(!quizProblems) return;
     async function t(){
       const r = await quizToSurveyJs(quizProblems);
       setSurveyProblems(r);
       const qt = await customStorage.getItem('quiz_type');
       setQuizType(qt || QuizType.InstantResultQuiz)
     }
     t();
  }, [quizProblems]);

  useEffect(() => {
    setOpened(open);
  }, [open]);

  function close() {
    setOpened(false);
    callback();
  }

  return (
    <Dialog
      open={opened}
      onClose={() => close( )}
      sx={{minWidth: '340px'}}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title"></DialogTitle>
      <DialogContent  sx={{minWidth: '340px'}}>
      {quizType === QuizType.InstantResultQuiz && (
         <InstantResultQuiz quizJson={surveyProblems} />
      )}
      {quizType !== QuizType.InstantResultQuiz && (
        <ScoredQuiz quizJson={surveyProblems} />
      )}
      </DialogContent>
      <DialogActions>
        <SmallButton variant="contained" onClick={() => close( )} autoFocus>
          Close
        </SmallButton>
      </DialogActions>
    </Dialog>
  );
}

export default QuizModal;
