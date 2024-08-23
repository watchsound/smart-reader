/* eslint-disable prettier/prettier */
/**
 *  NOTE:::  not used for now...
 *
 *
 *  */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
 getMoodBoardById,
 createMoodBoard,
 updateMoodBoard,
 deleteMoodBoardById,
deleteAllMoodBoards,
} from '../../api/moodBoardApi';

import {
  moodBoardHandled,
  moodBoardQueried,
  moodBoardAdded,
  moodBoardUpdated,
  moodBoardDeleted,
} from '../reducers/moodBoardSlice';

export const moodBoardApi = createApi({
  reducerPath: 'moodboardapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['MoodBoard'],
  endpoints: (build) => ({
    getMoodBoardById: build.query({
      queryFn: async (id) => {
        try {
          const moodBoard = await getMoodBoardById(id);
          // Return the result in an object with a `data` field
          return { data: moodBoard };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(moodBoardHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['MoodBoard'],
    }),

    createMoodBoard: build.mutation({
      queryFn: async (moodBoard) => {
        try {
          const r = await createMoodBoard(moodBoard);
          return { data: r };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(moodBoard, { dispatch, queryFulfilled }) {
        try {
          const r = await queryFulfilled;
          dispatch(moodBoardAdded(r));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['MoodBoard'],
    }),
    updateMoodBoard  : build.mutation({
      queryFn: async ({id, field, value, token}) => {
        try {
          const r = await updateMoodBoard(id, field, value, token);
          return { data: r };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted({id, field, value, token}, { dispatch, queryFulfilled }) {
        try {
          const r = await queryFulfilled;
          dispatch(moodBoardUpdated(r));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['MoodBoard'],
    }),
    deleteAllMoodBoards: build.mutation({
      queryFn: async () => {
        try {
          await deleteAllMoodBoards();
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(moodBoardQueried([]));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['MoodBoard'],
    }),
     deleteMoodBoardById: build.mutation({
      queryFn: async (id) => {
        try {
          await deleteMoodBoardById(id);
          return { data: id };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(moodBoardDeleted(id));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['MoodBoard'],
    }),
  }),
});

export const {
  useCreateMoodBoardMutation,
  useDeleteAllMoodBoardsMutation,
  useDeleteMoodBoardByIdMutation,
  useGetMoodBoardByIdQuery,
  useUpdateMoodBoardMutation,
} = moodBoardApi;

export const { endpoints, reducerPath, reducer, middleware } = moodBoardApi;
