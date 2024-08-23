/* eslint-disable prettier/prettier */
import React from 'react'
import QuizPageView from './QuizView';
// import { useLoaderData } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { v4 as uuid } from 'uuid';
// import { getNote } from '../../api/notesApi';

// export async function loader({ params }) {
//   const key = params.key || '';
//   if (!key) return { data: null}
//   const note = await getNote(params.key || '');
//   return { data: note };
// }


function QuizPage() {
  // const { data: note } = useLoaderData();
  return (
    <div className="main note__main">
      <QuizPageView />
    </div>
  );
}
export default QuizPage;
