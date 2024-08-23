import { createSlice } from '@reduxjs/toolkit';


const initialState = {
  isBackup: false,
  isOpenTokenDialog: false,
};
const sidebarSlice = createSlice({
  name: 'sidebar',
  initialState,
  reducers: {
    // Give case reducers meaningful past-tense "event"-style names
    modeHandle: (state, action) => {
      const { mode } = action.payload;
      state.mode = mode;
    },
    shelfIndexHandle: (state, action) => {
      const { shelfIndex } = action.payload;
      state.shelfIndex = shelfIndex;
    },
    collapseHandle: (state, action) => {
      const { isCollapsed } = action.payload;
      state.isCollapsed = isCollapsed;
    },
  },
});

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const { modeHandle, shelfIndexHandle, collapseHandle } =
  sidebarSlice.actions;

// Export the slice reducer as the default export
export default sidebarSlice.reducer;
