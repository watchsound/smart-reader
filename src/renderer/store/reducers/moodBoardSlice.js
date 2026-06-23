/* eslint-disable prettier/prettier */
import { createSlice } from '@reduxjs/toolkit';

const moodBoardSlice = createSlice({
  name: 'moodBoard',
  initialState: {
    moodBoards: [],
    curMoodBoard: null,
    activeMoodBoardId: null,
    addedNote: null,
    curDiagramNote: null,
    editState: true,
    showControl: false,
    linkModel: 'default',
  },
  reducers: {
    noteAdded : (state, action) => {
      const note = action.payload || null;
      state.addedNote = note;
    },
    diagramNoteHandled : (state, action) => {
      const note = action.payload || null;
      state.curDiagramNote = note;
    },
    linkModelChanged : (state, action) => {
      const note = action.payload || null;
      state.linkModel = note;
    },
    showControlChanged : (state, action) => {
      const showControl = action.payload || false;
      state.showControl = showControl;
    },
    editStateChanged : (state, action) => {
      const note = action.payload || false;
      state.editState = note;
    },
    moodBoardHandled: (state, action) => {
      const moodBoard = action.payload || null;
      state.curMoodBoard = moodBoard;
    },
    activeMoodBoardIdSet: (state, action) => {
      state.activeMoodBoardId = action.payload ?? null;
    },
    moodBoardQueried: (state, action) => {
      const ms = action.payload || [];
      state.moodBoards = ms;
    },

    moodBoardAdded: (state, action) => {
      const ms = action.payload;
      state.moodBoards = [...state.moodBoards, ms];
    },
    moodBoardUpdated: (state, action) => {
      const updated = action.payload;
      const newOnes = state.moodBoards.map((ms) =>
        ms.id !== updated.id ? ms : updated,
      );
      state.moodBoards = newOnes;
    },
    moodBoardDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newOnes = state.moodBoards.filter((ms) => ms.id !== deletedKey);
      state.moodBoards = newOnes;
    },

  },
});

export const {
  noteAdded,
  editStateChanged,
  showControlChanged,
  linkModelChanged,
  moodBoardHandled,
  activeMoodBoardIdSet,
  moodBoardQueried,
  moodBoardAdded,
  moodBoardUpdated,
  moodBoardDeleted,
  diagramNoteHandled,
} = moodBoardSlice.actions;
// Export the slice reducer as the default export
export default moodBoardSlice.reducer;
