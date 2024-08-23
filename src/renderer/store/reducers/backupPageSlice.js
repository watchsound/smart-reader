import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isBackup: false,
  isOpenTokenDialog: false,
};
const backupPageSlice = createSlice({
  name: 'backupPage',
  initialState,
  reducers: {
    // Give case reducers meaningful past-tense "event"-style names
    backupHandled: (state, action) => {
      const { isBackup } = action.payload;
      state.isBackup = isBackup;
    },
    tokenDialogHandled: (state, action) => {
      const { isOpenTokenDialog } = action.payload;
      state.isOpenTokenDialog = isOpenTokenDialog;
    },
  },
});

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const { backupHandled, tokenDialogHandled } = backupPageSlice.actions;

// Export the slice reducer as the default export
export default backupPageSlice.reducer;
