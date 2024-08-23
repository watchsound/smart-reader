/* eslint-disable prettier/prettier */
import { createSlice } from '@reduxjs/toolkit';

const vocabularySlice = createSlice({
  name: 'vocabulary',
  initialState: {
    vocabularyInSet: [],
    vocabularySets: [],
    queryStr: '',
    addVocabulary: null,
    curVocabularySet: null,
  },
  reducers: {
    vocabularyAdded : (state, action) => {
      const note = action.payload || null;
      state.addVocabulary = note;
      state.vocabularyInSet = [...state.vocabularyInSet, note];
    },
    curVocabularySetHandled : (state, action) => {
      const note = action.payload || null;
      state.curVocabularySet = note;
    },

    vocabularyInSetHandled: (state, action) => {
      const ms = action.payload || [];
      state.vocabularyInSet = ms;
    },

    vocabularySetQueried: (state, action) => {
      const ms = action.payload || [];
      state.vocabularySets = ms;
    },
    vocabularyQueryStrChanged: (state, action) => {
      const ms = action.payload || [];
      state.queryStr = ms;
    },
  },
});

export const {
  vocabularyAdded,
  vocabularyInSetHandled,
  vocabularyQueryStrChanged,
  curVocabularySetHandled,
  vocabularySetQueried,
} = vocabularySlice.actions;
// Export the slice reducer as the default export
export default vocabularySlice.reducer;
