/* eslint-disable prettier/prettier */
import React, {useEffect, useState} from 'react'
// import { useSelector, useDispatch } from 'react-redux';

import WritingView from './WritingView';

function WritingPage() {

  return (
    <div className="main note__main">
      <WritingView />
    </div>
  );
}
export default WritingPage;
