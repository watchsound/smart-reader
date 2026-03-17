/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import LearnAboutView from './LearnAboutView';



function LearnAboutPage() {
  const [curChat, setCurChat] = useState(null);
  const dispatch = useDispatch();

  useEffect(() => {
  }, [ ]);

  // React.useEffect(() => {
  //   if (!chat) return;
  //   async function cdr() {
  //   }
  //   cdr();
  // }, [chat]);

  return (
    <div className="main note__main">
      <LearnAboutView chat={curChat} />
    </div>
  );
}
export default LearnAboutPage;
