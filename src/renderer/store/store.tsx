import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import bookReducer from './reducers/bookSlice';
import managerReducer from './reducers/managerSlice';
import progressPanelReducer from './reducers/progressPanelSlice';
import readerReducer from './reducers/readerSlice';
import viewAreaReducer from './reducers/viewAreaSlice';
import sidebarReducer from './reducers/sidebarSlice';
import backupPageReducer from './reducers/backupPageSlice';
import BookModel from '../../commons/model/Book';
import NoteModel from '../../commons/model/Note';
import BookmarkModel from '../../commons/model/Bookmark';
import { noteApi } from './api/noteApiSlice';
import { bookApi } from './api/bookApiSlice';
import { readerApi } from './api/readerApiSlice';
import noteReducer from './reducers/noteSlice';
import { chatApi } from './api/chatApiSlice';
import chatReducer from './reducers/chatSlice';
import { quizApi } from './api/quizApiSlice';
import quizReducer from './reducers/quizSlice';
import authReducer from './reducers/authSlice';
import userReducer from './reducers/userSlice';
import bookshelfReducer from './reducers/bookshelfSlice';
import { moodBoardApi } from './api/moodBoardApiSlice';
import moodBoardReducer from './reducers/moodBoardSlice';
import vocabularyReducer from './reducers/vocabularySlice';

const defaultMiddlewareConfig = {
  serializableCheck: false,
  // serializableCheck: {
  //  ignoredPaths: ['book.renderBookFunc', 'book.renderNoteFunc'],
  // },
};
// Automatically adds the thunk middleware and the Redux DevTools extension
const store = configureStore({
  // Automatically calls `combineReducers`
  reducer: {
    // Add the generated RTK Query "API slice" caching reducer
    [noteApi.reducerPath]: noteApi.reducer,
    [bookApi.reducerPath]: bookApi.reducer,
    [readerApi.reducerPath]: readerApi.reducer,
    [chatApi.reducerPath]: chatApi.reducer,
    [quizApi.reducerPath]: quizApi.reducer,
    [moodBoardApi.reducerPath]: moodBoardApi.reducer,
    user: userReducer,
    auth: authReducer,
    book: bookReducer,
    bookshelf: bookshelfReducer,
    manager: managerReducer,
    reader: readerReducer,
    note: noteReducer,
    chat: chatReducer,
    quiz: quizReducer,
    progressPanel: progressPanelReducer,
    viewArea: viewAreaReducer,
    sidebar: sidebarReducer,
    backupPage: backupPageReducer,
    moodBoard: moodBoardReducer,
    vocabulary: vocabularyReducer,
  },
  // Add the RTK Query API middleware
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware(defaultMiddlewareConfig)
      .concat(noteApi.middleware)
      .concat(readerApi.middleware)
      .concat(bookApi.middleware)
      .concat(chatApi.middleware)
      .concat(moodBoardApi.middleware)
      .concat(quizApi.middleware),
  // getDefaultMiddleware(defaultMiddlewareConfig),
});

// optional, but required for refetchOnFocus/refetchOnReconnect behaviors
// see `setupListeners` docs - 'takes an optional callback as the 2nd arg for customization
setupListeners(store.dispatch);

export default store;

export type stateType = {
  manager: {
    books: BookModel[];
    deletedBooks: BookModel[];
    searchResults: number[];
    isSearch: boolean;
    isBookSort: boolean;
    isSettingOpen: boolean;
    viewMode: string;
    isSortDisplay: boolean;
    isAboutOpen: boolean;
    isShowLoading: boolean;
    isShowNew: boolean;
    isNewWarning: boolean;
    isSelectBook: boolean;
    selectedBooks: string[];
    isTipDialog: boolean;
    bookSortCode: { sort: number; order: number };
    noteSortCode: { sort: number; order: number };
    tip: string;
  };
  book: {
    isOpenEditDialog: boolean;
    isOpenDeleteDialog: boolean;
    isOpenAddDialog: boolean;
    isOpenActionDialog: boolean;
    isReading: boolean;
    dragItem: string;
    currentBook: BookModel;
    renderBookFunc: () => void;
    renderNoteFunc: () => void;
  };
  backupPage: {
    isBackup: boolean;
    isOpenTokenDialog: boolean;
  };
  progressPanel: {
    percentage: number;
    locations: any[];
  };
  reader: {
    bookmarks: BookmarkModel[];
    notes: NoteModel[];
    digests: NoteModel[];
    color: number;
    chapters: any[];
    noteKey: string;
    currentChapter: string;
    currentChapterIndex: number;
    originalText: string;
    currentBook: BookModel;
  };
  sidebar: {
    mode: string;
    shelfIndex: number;
    isCollapsed: boolean;
  };
  viewArea: {
    selection: string;
    menuMode: string;
    isOpenMenu: boolean;
    isChangeDirection: boolean;
    isShowBookmark: boolean;
  };
};
