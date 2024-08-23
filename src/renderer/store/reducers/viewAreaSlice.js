import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isBackup: false,
  isOpenTokenDialog: false,
};
const viewAreaSlice = createSlice({
  name: 'viewArea',
  initialState,
  reducers: {
    // Give case reducers meaningful past-tense "event"-style names
    openMenuHandle: (state, action) => {
      const { isOpenMenu } = action.payload;
      state.isOpenMenu = isOpenMenu;
    },
    openHighlightHandle: (state, action) => {
      const { isOpenHighlight } = action.payload;
      state.isOpenHighlight = isOpenHighlight;
    },
    showBookmarkHandle: (state, action) => {
      const { isShowBookmark } = action.payload;
      state.isShowBookmark = isShowBookmark;
    },
    selectionHandle: (state, action) => {
      const { selection } = action.payload;
      state.selection = selection;
    },
    dialogLocationHandle: (state, action) => {
      const { dialogLocation } = action.payload;
      state.dialogLocation = dialogLocation;
    },
    menuModeHandle: (state, action) => {
      const { menuMode } = action.payload;
      state.menuMode = menuMode;
    },
    changeDirectionHandle: (state, action) => {
      const { isChangeDirection } = action.payload;
      state.isChangeDirection = isChangeDirection;
    },
  },
});

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const {
  openMenuHandle,
  openHighlightHandle,
  showBookmarkHandle,
  selectionHandle,
  dialogLocationHandle,
  menuModeHandle,
  changeDirectionHandle,
} = viewAreaSlice.actions;

// Export the slice reducer as the default export
export default viewAreaSlice.reducer;
