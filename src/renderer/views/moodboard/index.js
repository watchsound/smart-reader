/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLoaderData } from 'react-router-dom';
import Box from '@mui/material/Box';

import MoodBoardView from './MoodBoardView';
import { moodBoardHandled } from '../../store/reducers/moodBoardSlice';
import { getMoodBoardById } from '../../api/moodBoardApi';

export async function loader({ params }) {
  const id = params.id || '';
  if (id === '') {
    return { data: null };
  }
  const moodBoard = await getMoodBoardById(params.id || '');
  return { data: moodBoard };
}

function MoodBoardPage() {
  const [curMoodBoard, setCurMoodBoard] = useState(null);
  const { data: moodBoard } = useLoaderData();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!moodBoard) return;
    setCurMoodBoard(moodBoard);
    dispatch(moodBoardHandled(moodBoard));
  }, [moodBoard, dispatch]);

  return (
    <Box
      sx={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <MoodBoardView moodBoard={curMoodBoard} />
    </Box>
  );
}

export default MoodBoardPage;
