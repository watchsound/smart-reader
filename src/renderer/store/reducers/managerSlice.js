/* eslint-disable no-restricted-syntax */
// import localforage from "localforage";
// import { Dispatch } from 'redux';
import { createSlice } from '@reduxjs/toolkit';

import SortUtil from '../../api/sortUtil';
// import BookModel from '../../../commons/model/Book';
import AddTrash from '../../api/addTrash';
import customStorage from '../customStorage';

const initialState = {
  books: [],
  deletedBooks: [],
  searchResults: [],
  isSearch: false,
  isAboutOpen: false,
  isBookSort: false, // localStorage.getItem("bookSortCode") ? true : false,
  isNoteSort: false,
  isSettingOpen: false,
  viewMode: 'card',
  isSortDisplay: false,
  isShowLoading: false,
  isNewWarning: false,
  isTipDialog: false,
  isShowNew: false,
  addDialogHandled: false,
  bookSortCode: { sort: 1, order: 2 },
  noteSortCode: { sort: 2, order: 2 },
  isSelectBook: false,
  message: 'Add Successfully',
  tip: '',
  selectedBooks: [],
};
const managerSlice = createSlice({
  name: 'manager',
  initialState,
  reducers: {
    // Give case reducers meaningful past-tense "event"-style names
    booksHandled: (state, action) => {
      const { books } = action.payload;
      state.books = books;
    },
    booksQueried: (state, action) => {
      const books = action.payload;
      state.books = books;
    },
    bookAdded: (state, action) => {
      const book = action.payload;
      state.books = [...state.books, book];
    },
    bookUpdated: (state, action) => {
      const updated = action.payload;
      const newNotes = state.books.map((note) =>
        note.id !== updated.id ? note : updated,
      );
      state.books = newNotes;
    },
    bookDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.books.filter((note) => note.id !== deletedKey);
      state.books = newNotes;
    },
    booksCleared: (state, action) => {
      state.books = [];
    },

    booksDeleted: (state, action) => {
      const { deletedBooks } = action.payload;
      state.deletedBooks = deletedBooks;
    },
    bookSearched: (state, action) => {
      const { searchResults } = action.payload;
      state.searchResults = searchResults;
    },
    bookSelected: (state, action) => {
      const { isSelectBook } = action.payload;
      state.isSelectBook = isSelectBook;
    },
    addDialogHandled: (state, action) => {
      const { addDialogHandled } = action.payload;
      state.addDialogHandled = addDialogHandled;
    },
    selectedBooks: (state, action) => {
      const { selectedBooks } = action.payload;
      state.selectedBooks = selectedBooks;
    },
    tipDialogHandled: (state, action) => {
      const { isTipDialog } = action.payload;
      state.isTipDialog = isTipDialog;
    },
    tipHandled: (state, action) => {
      const { tip } = action.payload;
      state.tip = tip;
    },
    searchHandled: (state, action) => {
      const { isSearch } = action.payload;
      state.isSearch = isSearch;
    },
    searchResultsHandled: (state, action) => {
      const { searchResults } = action.payload;
      state.searchResults = searchResults;
    },
    settingHandled: (state, action) => {
      const { isSettingOpen } = action.payload;
      state.isSettingOpen = isSettingOpen;
    },
    aboutHandled: (state, action) => {
      const { isAboutOpen } = action.payload;
      state.isAboutOpen = isAboutOpen;
    },
    aboutToggled: (state, action) => {
      state.isAboutOpen = !state.isAboutOpen;
    },
    bookSortHandled: (state, action) => {
      const { isBookSort } = action.payload;
      state.isBookSort = isBookSort;
    },
    noteSortHandled: (state, action) => {
      const { isNoteSort } = action.payload;
      state.isNoteSort = isNoteSort;
    },
    viewModeHandled: (state, action) => {
      const { viewMode } = action.payload;
      state.viewMode = viewMode;
    },
    sortDisplayHandled: (state, action) => {
      const { isSortDisplay } = action.payload;
      state.isSortDisplay = isSortDisplay;
    },
    sortDisplayToggled: (state, action) => {
      state.isSortDisplay = !state.isSortDisplay;
    },
    loadingDialogHandled: (state, action) => {
      const { isShowLoading } = action.payload;
      state.isShowLoading = isShowLoading;
    },
    newDialogHandled: (state, action) => {
      const { isShowNew } = action.payload;
      state.isShowNew = isShowNew;
    },
    newWarningHandled: (state, action) => {
      const { isNewWarning } = action.payload;
      state.isNewWarning = isNewWarning;
    },
    sortCodeHandled: (state, action) => {
      const { sort, order } = action.payload;
      state.bookSortCode = {
        sort,
        order,
      };
    },
    noteSortCodeHandled: (state, action) => {
      const { sort, order } = action.payload;
      state.noteSortCode = {
        sort,
        order,
      };
    },
  },
});
export function handleFetchBooks(isTrash = false) {
  return async (dispatch) => {
    const bookArr = await customStorage.getItem('books');
    const keyArr = AddTrash.getAllTrash();
    if (isTrash) {
      dispatch(
        managerSlice.actions.booksDeleted(
           handleKeyFilter(bookArr, keyArr),
        ),
      );
    } else {
      dispatch(
        managerSlice.actions.booksHandled(
           handleKeyRemove(bookArr, keyArr),
        ),
      );
    }
  };
}
export function handleFetchBookSortCode() {
  return (dispatch) => {
    const bookSortCode = SortUtil.getBookSortCode();
    dispatch(managerSlice.actions.sortCodeHandled(bookSortCode));
  };
}
export function handleFetchNoteSortCode() {
  return (dispatch) => {
    const noteSortCode = SortUtil.getNoteSortCode();
    dispatch(managerSlice.actions.noteSortCodeHandled(noteSortCode));
  };
}
export function handleFetchList() {
  return async (dispatch) => {
    const viewMode = (await customStorage.getReaderConfig('viewMode')) || 'card';
    dispatch(managerSlice.actions.viewModeHandled(viewMode));
  };
}

const handleKeyRemove = (items, arr) => {
  if (!items) return [];
  const itemArr = [];
  if (!arr[0]) {
    return items;
  }
  for (const item of items) {
    if (arr.indexOf(item.id) === -1) {
      itemArr.push(item);
    }
  }

  return itemArr;
};

const handleKeyFilter = (items, arr) => {
  if (!items) {
    return [];
  }
  const itemArr = [];
  for (const item of items) {
    if (arr.indexOf(item.id) > -1) {
      itemArr.push(item);
    }
  }
  return itemArr;
};

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const {
  booksQueried,
  bookAdded,
  bookUpdated,
  bookDeleted,
  booksCleared,
  booksHandled,
  booksDeleted,
  bookSearched,
  bookSelected,
  tipDialogHandled,
  tipHandled,
  searchHandled,
  searchResultsHandled,
  settingHandled,
  aboutHandled,
  bookSortHandled,
  noteSortHandled,
  viewModeHandled,
  sortDisplayHandled,
  sortDisplayToggled,
  loadingDialogHandled,
  newDialogHandled,
  newWarningHandled,
  sortCodeHandled,
  noteSortCodeHandled,
  aboutToggled,
  addDialogHandled,
} = managerSlice.actions;

// Export the slice reducer as the default export
export default managerSlice.reducer;
