import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isOpenEditDialog: false,
  isOpenDeleteDialog: false,
  isOpenAddDialog: false,
  isOpenActionDialog: false,
  isReading: false,
  dragItem: '',
  currentBook: null,
  renderBookFunc: () => {},
  renderNoteFunc: () => {},
};
const bookSlice = createSlice({
  name: 'book',
  initialState,
  reducers: {
    // Give case reducers meaningful past-tense "event"-style names
    editDialogHandled: (state, action) => {
      const { isOpenEditDialog } = action.payload;
      state.isOpenEditDialog = isOpenEditDialog;
    },
    deleteDialogHandled: (state, action) => {
      const { isOpenDeleteDialog } = action.payload;
      state.isOpenDeleteDialog = isOpenDeleteDialog;
    },
    renterBookFuncHandled: (state, action) => {
      const { renderBookFunc } = action.payload;
      state.renderBookFunc = renderBookFunc;
    },
    renterNoteFuncHandled: (state, action) => {
      const { renderNoteFunc } = action.payload;
      state.renderNoteFunc = renderNoteFunc;
    },
    addDialogHandled: (state, action) => {
      const { isOpenAddDialog } = action.payload;
      state.isOpenAddDialog = isOpenAddDialog;
    },
    actionDialogHandled: (state, action) => {
      const { isOpenActionDialog } = action.payload;
      state.isOpenActionDialog = isOpenActionDialog;
    },
    readingStateHandled: (state, action) => {
      const { isReading } = action.payload;
      state.isReading = isReading;
    },
    readingBookHandled: (state, action) => {
      const { currentBook } = action.payload;
      state.currentBook = currentBook;
    },
    dragItemHandled: (state, action) => {
      const { dragItem } = action.payload;
      state.dragItem = dragItem;
    },
    redirectHandled: (state, action) => {
      const { isRedirect } = action.payload;
      state.isRedirect = isRedirect;
    },
  },
});

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const {
  editDialogHandled,
  deleteDialogHandled,
  renterBookFuncHandled,
  renterNoteFuncHandled,
  addDialogHandled,
  actionDialogHandled,
  readingStateHandled,
  readingBookHandled,
  dragItemHandled,
  redirectHandled,
} = bookSlice.actions;

// Export the slice reducer as the default export
export default bookSlice.reducer;
