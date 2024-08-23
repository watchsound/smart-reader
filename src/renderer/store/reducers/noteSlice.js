import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
// import {
//   queryNote,
//   saveNotes,
//   createNote,
//   getNote,
//   // getByBookKey,
//   updateNote,
//   deleteNote,
// } from '../../api/notesApi';

// import { noteApi } from '../api/noteApiSlice';

export const NoteFilterType = {
  KEYWORD: 'keyword',
  STARS: 'stars',
  TAGS: 'tags',
  NONE: 'none',
};

// // First, create the thunk
// const fetchNotes = createAsyncThunk(
//   'note/fetchNotes',
//   async (query, thunkAPI) => {
//     const response = await queryNote(query);
//     return response;
//   },
// );
// const createNote = createAsyncThunk(
//   'note/createNote',
//   async (query, thunkAPI) => {
//     const response = await createNote(query);
//     return response;
//   },
// );
// const updateNote = createAsyncThunk(
//   'note/updateNote',
//   async (query, thunkAPI) => {
//     const response = await updateNote(query);
//     return response;
//   },
// );
// const deleteNote = createAsyncThunk(
//   'note/deleteNote',
//   async (query, thunkAPI) => {
//     const response = await deleteNote(query);
//     return response;
//   },
// );

const noteSlice = createSlice({
  name: 'note',
  initialState: {
    notes: [],
    loading: 'idle',
    filterBy: NoteFilterType.None,
    filterKey: '',
    filterStars: 0,
    filterTags: [],
    showTextOnly: false,
    addedNoteToLeitner: null,
  },
  reducers: {
    filterByKeyHandled: (state, action) => {
      const filterKey = action.payload || '';
      state.filterBy = NoteFilterType.KEYWORD;
      state.filterKey = filterKey;
    },
    filterByStarsHandled: (state, action) => {
      const filterStars = action.payload || 0;
      state.filterBy = NoteFilterType.STARS;
      state.filterStars = filterStars;
    },
    filterByTagsHandled: (state, action) => {
      const filterTags = action.payload;
      state.filterBy = NoteFilterType.TAGS;
      state.filterTags = filterTags;
    },
    showTextOnlyHandled: (state, action) => {
      const showTextOnly = action.payload;
      state.showTextOnly = showTextOnly;
    },
    notesQueried: (state, action) => {
      const notes = action.payload;
      state.notes = notes;
    },
    noteAdded: (state, action) => {
      const note = action.payload;
      state.notes = [...state.notes, note];
    },
    noteToLeitnerAdded: (state, action) => {
      const note = action.payload;
      state.addedNoteToLeitner = note;
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
  },
  // extraReducers: (builder) => {
  //   builder.addCase(
  //     //  notesApi.endpoints.getNotesFromDB.fulfilled,
  //     fetchNotes.fulfilled,
  //     (state, action) => {
  //       // Add user to the state array
  //       state.notes = action.payload;
  //     },
  //   );
  //   builder.addCase(
  //     // notesApi.endpoints.createNote.fulfilled,
  //     createNote.fulfilled,
  //     (state, action) => {
  //       // Add user to the state array
  //       state.notes.append(action.payload);
  //     },
  //   );
  //   builder.addCase(
  //     // notesApi.endpoints.updateNote.fulfilled,
  //     updateNote.fulfilled,
  //     (state, action) => {
  //       const { updated } = action.payload;
  //       const newNotes = state.notes.map((note) =>
  //         note.id !== updated.id ? note : updated,
  //       );
  //       state.note = newNotes;
  //     },
  //   );
  //   builder.addCase(
  //     // notesApi.endpoints.deleteNote.fulfilled,
  //     deleteNote.fulfilled,
  //     (state, action) => {
  //       const { deletedKey } = action.payload;
  //       const newNotes = state.notes.filter((note) => note.id !== deletedKey);
  //       state.note = newNotes;
  //     },
  //   );
  // },
});

export const {
  filterByKeyHandled,
  filterByStarsHandled,
  filterByTagsHandled,
  showTextOnlyHandled,
  notesQueried,
  noteAdded,
  noteUpdated,
  noteDeleted,
  notesCleared,
  noteToLeitnerAdded,
} = noteSlice.actions;
// Export the slice reducer as the default export
export default noteSlice.reducer;
