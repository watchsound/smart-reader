/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import { useState, useRef, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
import { useSelector, useDispatch } from 'react-redux';
import isEqual from 'is-equal';
import watch from 'redux-watch';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';

import store from '../../store/store';
import {
  searchTextInBookHandled,
  cfiChangeHandled,
  pdfHighlightChangeHandled,
} from '../../store/reducers/readerSlice';

import { isEmpty, truncateString } from '../../../commons/utils/commonUtil';
import TextSearchRow from '../../components/TextSearchRow';
import customStorage from '../../store/customStorage';

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

function SearchResultPane() {
  const [searchResult, setSearchResult] = useState([]);
  const [isPDF, setPDF] = useState(false);
  const [book, setBook] = useState(null);
  // const searchResultRef = useRef(searchResult);

  const dispatch = useDispatch();
  const searchTextInBookResult = useSelector(
    (state) => state.reader.searchTextInBookResult,
  );
  const currentBook = useSelector((state) => state.reader.currentBook);
  useEffect(() => {
    if (!currentBook) return;
    setBook(currentBook);
    setPDF(currentBook.format === 'pdf');
  }, [currentBook]);

  useEffect(() => {
    setSearchResult(searchTextInBookResult);
    // if (
    //   searchTextInBookResult.length > 0 &&
    //   typeof searchTextInBookResult[0].isPDF === 'undefined'
    // )
    //   setPDF(false);
    // else setPDF(true);
    // const w = watch(store.getState, 'reader.searchTextInBookResult', isEqual);
    // const unsubscribe = store.subscribe(
    //   w((newVal, oldVal, objectPath) => {
    //     setTimeout(() => {
    //       if (!isEmpty(newVal)) setSearchResult(newVal);
    //     }, 0.5);
    //   }),
    // );
    // return () => unsubscribe();
  }, [searchTextInBookResult]);

  const search = async (inputText) => {
    if (!inputText) return;
    setSearchResult([]);
    if (inputText.trim().indexOf(' ') > 0) {
      const r = await customStorage.getBookContentByQuery({
        bookKey: book.id,
        bookType: book.format,
        query: inputText,
      });
      setSearchResult(r || []);
    } else {
      dispatch(searchTextInBookHandled(inputText));
    }
  };

  const selectEPubHandler = (cfi) => {
    if (!cfi) return;
    // in sematic search, it returns multiple cfi
    const pos = cfi.indexOf('|');
    if (pos < 0) {
      dispatch(cfiChangeHandled(cfi));
    } else {
      const cfis = cfi.split('|');
      const oneCfi = cfis[cfis.length - 1];
      dispatch(cfiChangeHandled(oneCfi));
    }
  };
  const selectPDFHandler = (highlight) => {
    dispatch(pdfHighlightChangeHandled(highlight));
  };
  return (
    <>
      <TextSearchRow
        placeHolder="Search"
        label="content"
        sx={{
          width: '100%',
          marginLeft: '4px',
          marginRight: '4px',
          borderStyle: 'none',
        }}
        searchAction={(text) => search(text)}
      />
      <ScrollPane>
        {searchResult && isPDF && (
          <ul>
            {searchResult.map((match, index) => (
              <li
                key={
                  match.data ? match.data.id : match.key || match.id || index
                }
                onClick={() =>
                  selectPDFHandler(match.data ? match.data : match)
                }
              >
                <Card sx={{ margin: '3px', padding: '3px' }}>
                  {truncateString(
                    match.data
                      ? match.data.content
                        ? match.data.content.text || ''
                        : ''
                      : match.content
                        ? match.content.text || ''
                        : '',
                    150,
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
        {searchResult && !isPDF && (
          <ul>
            {searchResult.map((match, index) => (
              <li
                key={match.key || index}
                onClick={() => selectEPubHandler(match.data.cfi)}
              >
                <Card sx={{ margin: '3px', padding: '3px' }}>
                  {truncateString(match.data.excerpt, 150)}
                </Card>
              </li>
            ))}
          </ul>
        )}
        {(!searchResult || searchResult.length === 0) && (
          <Card sx={{ margin: '4px' }}>No Record Found</Card>
        )}
      </ScrollPane>
    </>
  );
}

export default SearchResultPane;
