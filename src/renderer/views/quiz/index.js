import React from 'react';
import { Box } from '@mui/material';
import QuizPageView from './QuizView';

function QuizPage() {
  return (
    <Box sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
      <QuizPageView />
    </Box>
  );
}

export default QuizPage;
