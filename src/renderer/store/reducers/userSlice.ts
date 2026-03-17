import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UserInfo {
  user: string;
  email: string;
  token: string;
}

interface UserState {
  userInfo: UserInfo | null;
}

const initialState: UserState = {
  userInfo: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    loginHandled: (state, action: PayloadAction<UserInfo | null>) => {
      state.userInfo = action.payload || { user: '', email: '', token: '' };
    },
    logoutHandled: (state) => {
      state.userInfo = null;
    },
  },
});

export const { loginHandled, logoutHandled } = userSlice.actions;

export default userSlice.reducer;
