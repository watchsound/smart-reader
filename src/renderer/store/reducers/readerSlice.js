/* eslint-disable no-nested-ternary */
/* eslint-disable radix */
import { createSlice } from '@reduxjs/toolkit';

import customStorage from '../customStorage';
import AddTrash from '../../api/addTrash';

const initialState = {
  bookmarks: [],
  notes: [],
  annotations: [],
  digests: [],
  chapters: null,
  currentChapter: '',
  currentChapterIndex: 0,
  color: 0,
  noteKey: '',
  originalText: '',
  currentBook: null,
  readerMode: 'double',
  bookmarksHandled: false,
  notesHandled: false,
  loading: false,
  error: null,
  searchTextInBook: '',
  searchTextInBookResult: [],
  cfiChange: null,
  pdfHighlightChanges: null,
  showCommunityNote: false,
  selectedCommunityNote: null,
};
const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    fetchDataStart(state) {
      state.loading = true;
      state.error = null;
    },
    fetchDataSuccess(state, action) {
      const { readerMode, color } = action.payload;
      state.loading = false;
      state.readerMode = readerMode;
      state.color = color;
    },
    fetchDataFailure(state, action) {
      state.loading = false;
      state.error = action.payload;
    },
    searchTextInBookHandled: (state, action) => {
      const searchTextInBook = action.payload;
      state.searchTextInBook = searchTextInBook;
    },
    // Give case reducers meaningful past-tense "event"-style names
    bookmarksHandle: (state, action) => {
      const bookmarks = action.payload;
      state.bookmarks = bookmarks;
    },
    notesQueried: (state, action) => {
      const notes = action.payload;
      state.notes = notes;
    },
    noteAdded: (state, action) => {
      const note = action.payload;
      state.notes = [...state.notes, note];
    },
    noteUpdated: (state, action) => {
      const updated = action.payload;
      const newNotes = state.notes.map((note) =>
        note.id !== updated.id ? note : updated,
      );
      state.notes = newNotes;
    },
    noteDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.notes.filter((note) => note.id !== deletedKey);
      state.notes = newNotes;
    },
    notesCleared: (state, action) => {
      state.notes = [];
    },

    annotationsQueried: (state, action) => {
      const annotations = action.payload;
      state.annotations = annotations;
    },
    annotationAdded: (state, action) => {
      const annotation = action.payload;
      state.annotations = [...state.annotations, annotation];
    },
    annotationUpdated: (state, action) => {
      const updated = action.payload;
      const newNotes = state.annotations.map((note) =>
        note.id !== updated.id ? note : updated,
      );
      state.annotations = newNotes;
    },
    annotationDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.annotations.filter((note) => note.id !== deletedKey);
      state.annotations = newNotes;
    },
    annotationsCleared: (state, action) => {
      state.annotations = [];
    },
    currentChapterHandle: (state, action) => {
      const currentChapter = action.payload;
      state.currentChapter = currentChapter;
    },
    currentChapterIndexHandle: (state, action) => {
      const currentChapterIndex = action.payload;
      state.currentChapterIndex = currentChapterIndex;
    },
    originalTextHandle: (state, action) => {
      const originalText = action.payload;
      state.originalText = originalText;
    },
    currentBookHandled: (state, action) => {
      const currentBook = action.payload;
      state.currentBook = currentBook;
    },
    colorHandle: (state, action) => {
      const color = action.payload;
      state.color = color;
    },
    noteKeyHandle: (state, action) => {
      const noteKey = action.payload;
      state.noteKey = noteKey;
    },
    digestsHandle: (state, action) => {
      const digests = action.payload;
      state.digests = digests;
    },
    sectionHandle: (state, action) => {
      const section = action.payload;
      state.section = section;
    },
    chaptersHandle: (state, action) => {
      const chapters = action.payload;
      state.chapters = chapters;
    },
    notesHandled: (state, action) => {
      // const { notesHandled } = action.payload;
      state.notesHandled = true;
    },
    bookmarksHandled: (state, action) => {
      // const { bookmarksHandled } = action.payload;
      state.bookmarksHandled = true;
    },
    searchTextInBookResultHandled: (state, action) => {
      const searchTextInBookResult = action.payload;
      state.searchTextInBookResult = searchTextInBookResult;
    },
    cfiChangeHandled: (state, action) => {
      const cfiChange = action.payload;
      state.cfiChange = cfiChange;
    },
    pdfHighlightChangeHandled: (state, action) => {
      const pdfHighlightChanges = action.payload;
      state.pdfHighlightChanges = pdfHighlightChanges;
    },
    communityNoteToggled: (state, action) => {
      const showCommunityNote = action.payload;
      state.showCommunityNote = showCommunityNote;
    },
    communityNoteSelected: (state, action) => {
      const selectedCommunityNote = action.payload;
      state.selectedCommunityNote = selectedCommunityNote;
    },
  },
});

const handleKeyRemove = (items, arr) => {
  const itemArr = [];
  if (!arr[0]) {
    return items;
  }
  for (let i = 0; i < items.length; i++) {
    if (arr.indexOf(items[i].sourceKey) === -1) {
      itemArr.push(items[i]);
    }
  }
  return itemArr;
};

// Async action creator to fetch initial data
export const fetchInitialData = () => async (dispatch) => {
  dispatch(readerSlice.actions.fetchDataStart());
  try {
    const readerMode =
      (await customStorage.getReaderConfig('readerMode')) || 'double';
    const highlightIndex = await customStorage.getReaderConfig('highlightIndex');
    const appSkin = await customStorage.getReaderConfig('appSkin');
    const isOSNight = await customStorage.getReaderConfig('isOSNight');

    const color = parseInt(highlightIndex)
      ? parseInt(highlightIndex)
      : appSkin === 'night' || (appSkin === 'system' && isOSNight === 'yes')
        ? 3
        : 0;

    dispatch(readerSlice.actions.fetchDataSuccess({ color, readerMode }));
  } catch (error) {
    dispatch(readerSlice.actions.fetchDataFailure(error.message));
  }
};

export function handleFetchNotes() {
  return (dispatch) => {
    customStorage.getItem('note', (err, value) => {
      let noteArr;
      if (value === null || value === []) {
        noteArr = [];
      } else {
        noteArr = value;
      }
      const keyArr = AddTrash.getAllTrash();
      dispatch(
        readerSlice.actions.notesHandled(handleKeyRemove(noteArr, keyArr)),
      );
      dispatch(
        readerSlice.actions.digestsHandle(
          handleKeyRemove(
            noteArr.filter((item) => {
              return item.notes === '';
            }),
            keyArr,
          ),
        ),
      );
    });
  };
}

export function handleFetchBookmarks() {
  return (dispatch) => {
    customStorage.getItem('bookmarks', (err, value) => {
      let bookmarkArr;
      if (value === null || value === []) {
        bookmarkArr = [];
      } else {
        bookmarkArr = value;
      }
      const keyArr = AddTrash.getAllTrash();
      dispatch(
        readerSlice.actions.bookmarksHandled(
          handleKeyRemove(bookmarkArr, keyArr),
        ),
      );
    });
  };
}

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const {
  bookmarksHandle,
  currentChapterHandle,
  currentChapterIndexHandle,
  originalTextHandle,
  currentBookHandled,
  colorHandle,
  noteKeyHandle,
  digestsHandle,
  sectionHandle,
  chaptersHandle,
  notesHandled,
  bookmarksHandled,
  notesQueried,
  noteAdded,
  noteUpdated,
  noteDeleted,
  notesCleared,
  annotationsQueried,
  annotationAdded,
  annotationUpdated,
  annotationDeleted,
  annotationsCleared,
  searchTextInBookHandled,
  searchTextInBookResultHandled,
  cfiChangeHandled,
  communityNoteToggled,
  communityNoteSelected,
  pdfHighlightChangeHandled,
} = readerSlice.actions;

// Export the slice reducer as the default export
export default readerSlice.reducer;
