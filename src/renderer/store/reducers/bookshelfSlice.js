import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  bookshelfList: [],
};
const bookshelfSlice = createSlice({
  name: 'bookshelf',
  initialState,
  reducers: {
    bookshelfQuried: (state, action) => {
      const { bookshelfList } = action.payload;
      state.bookshelfList = bookshelfList;
    },
    bookshelfAdded: (state, action) => {
      const ms = action.payload;
      state.bookshelfList = [...state.bookshelfList, ms];
    },
    bookshelfRenamed: (state, action) => {
      const updated = action.payload;
      const newOnes = state.bookshelfList.map((ms) =>
        ms.id !== updated.id ? ms : updated,
      );
      state.bookshelfList = newOnes;
    },
    bookshelfDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newOnes = state.bookshelfList.filter((ms) => ms.id !== deletedKey);
      state.bookshelfList = newOnes;
    },
  },
});

export const {
  bookshelfQuried,
  bookshelfAdded,
  bookshelfRenamed,
  bookshelfDeleted,
} = bookshelfSlice.actions;

export default bookshelfSlice.reducer;
