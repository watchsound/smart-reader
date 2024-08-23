/* eslint-disable prettier/prettier */
import React, {useEffect, useState} from 'react'
// import { useSelector, useDispatch } from 'react-redux';

import VocabularyView from './VocabularyView';

function VocabularyPage() {

  return (
    <div className="main note__main">
      <VocabularyView />
    </div>
  );
}
export default VocabularyPage;
