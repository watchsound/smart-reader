/* eslint-disable prettier/prettier */
import React, {useEffect, useState} from 'react'
import { useSelector, useDispatch } from 'react-redux';
import { useLoaderData } from 'react-router-dom';

import MoodBoardView from './MoodBoardView';
import { moodBoardHandled } from '../../store/reducers/moodBoardSlice';
import { getMoodBoardById } from '../../api/moodBoardApi';

export async function loader({ params }) {
  const id = params.id || '';
  if ( id === ''){
    return { data: null  };
  }
  const moodBoard = await getMoodBoardById(params.id || '');
   return { data: moodBoard };
}


function MoodBoardPage() {
  const [curMoodBoard, setCurCurMoodBoard] = useState(null);
  const { data: moodBoard } = useLoaderData();
  const dispatch = useDispatch();

  useEffect(() => {
    if(!moodBoard) return;
    setCurCurMoodBoard(moodBoard);
     dispatch(moodBoardHandled(moodBoard));
  }, [moodBoard]);



  return (
    <div className="main note__main">
      <MoodBoardView moodBoard={curMoodBoard}/>
    </div>
  );
}
export default MoodBoardPage;
