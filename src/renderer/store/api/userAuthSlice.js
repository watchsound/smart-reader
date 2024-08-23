/* eslint-disable prettier/prettier */
/**
 *  NOTE:::  not used for now...
 *
 *
 *  */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  login,
  logout,
  register
} from '../../api/userAuthApi';

import {
  loginHandled,
  logoutHandled,
} from '../reducers/userSlice';

export const userAuthApi = createApi({
  reducerPath: 'userauthapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['User'],
  endpoints: (build) => ({
    login: build.query({
      queryFn: async ({email,password}) => {
        try {
          const userInfo = await login(email,password);
          // Return the result in an object with a `data` field
          return { data: userInfo };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(loginHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['User'],
    }),
    logout: build.query({
      queryFn: async ({token}) => {
        try {
          const userInfo = await logout(token);
          // Return the result in an object with a `data` field
          return { data: userInfo };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          dispatch(logoutHandled( ));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['User'],
    }),
    register: build.query({
      queryFn: async ({user, email, password}) => {
        try {
          const userInfo = await register(user, email, password);
          // Return the result in an object with a `data` field
          return { data: userInfo };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(loginHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['User'],
    }),
  }),
});

export const {
  useRegisterQuery,
  useLoginQuery,
  useLogoutQuery,
} = userAuthApi;

export const { endpoints, reducerPath, reducer, middleware } = userAuthApi;
