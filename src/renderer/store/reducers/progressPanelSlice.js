import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  percentage: null,
  locations: null,
};
const progressPanelSlice = createSlice({
  name: 'progressPanel',
  initialState,
  reducers: {
    // Give case reducers meaningful past-tense "event"-style names
    percentageHandle: (state, action) => {
      const { percentage } = action.payload;
      state.percentage = percentage;
    },
    sectionHandle: (state, action) => {
      const { section } = action.payload;
      state.section = section;
    },
    locationsHandle: (state, action) => {
      const { locations } = action.payload;
      state.locations = locations;
    },
  },
});

// `createSlice` automatically generated action creators with these names.
// export them as named exports from this "slice" file
export const { percentageHandle, sectionHandle, locationsHandle } =
  progressPanelSlice.actions;

// Export the slice reducer as the default export
export default progressPanelSlice.reducer;
