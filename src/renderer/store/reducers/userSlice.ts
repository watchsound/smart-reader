import { createSlice } from '@reduxjs/toolkit';

const userSlice = createSlice({
  name: 'user',
  initialState: {
    userInfo: null,
  },
  reducers: {
    loginHandled: (state, action) => {
      const userInfo = action.payload || { user: '', email: '', token: '' };
      state.userInfo = userInfo;
    },
    logoutHandled: (state, action) => {
      const userInfo = { user: '', email: '', token: '' };
      state.userInfo = userInfo;
    },
  },
});

export const { loginHandled, logoutHandled } = userSlice.actions;

export default userSlice.reducer;
