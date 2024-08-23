/* eslint-disable prettier/prettier */
/* eslint-disable no-inner-declarations */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import React, { useState, useEffect } from 'react';
// import { useSelector, useDispatch } from 'react-redux';

// import { isElectron } from 'react-device-detect';
// import toast from 'react-hot-toast';
// import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';


import { createBook } from '../../api/booksApi';
import customStorage from '../../store/customStorage';
import SmallButton from '../Button/SmallButton';
import { Button } from '@mui/material';

// import customStorage from '../../store/customStorage';
// import BookUtil from '../../utils/bookUtil';
// import ShelfUtil from '../../api/shelfUtil';
// import managerSliceReducer, {
//   handleFetchBooks,
// } from '../../store/reducers/managerSlice';
// import bookSliceReducer, {
//   readingBookHandled,
// } from '../../store/reducers/bookSlice';


function ImportFileAsBook({importFileCallback}) {

  // const deletedBooks = useSelector((state) => state.manager.deletedBooks);
  // const books = useSelector((state) => state.manager.books) || [];
  // const selectedBooks = useSelector((state) => state.manager.selectedBooks);

  // const dispatch = useDispatch();


  useEffect(() => {

  }, []);


  async function tryImportFile() {
    const book = await customStorage.importBookFromFile();
    if( book ){
      // createBook(book);
      importFileCallback(book);
    } else {
      importFileCallback(null);
    }
    console.log(` in try import file , result = ${book}`);
  }
  return (
    <Button className="texture-wood-4" onClick={() => {
      tryImportFile();
    }} variant="contained" endIcon={<CloudUploadIcon />}>
      Import Book
    </Button>
  );
}

export default ImportFileAsBook;
