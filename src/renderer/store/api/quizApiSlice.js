/* eslint-disable prettier/prettier */
/**
 *  NOTE:::  not used for now...
 *
 *
 *  */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
 getQuizProblemByQuery,
 getQuizProblemById,
 createQuizProblem,
 updateQuizProblem,
 deleteQuizProblem,
  deleteAllQuizProblem,
  getQuizProblemsBySourceKey,
} from '../../api/quizApi';

import {
  quizHandled,
  quizQueried,
  quizAdded,
  quizUpdated,
  quizDeleted,
} from '../reducers/quizSlice';

export const quizApi = createApi({
  reducerPath: 'quizapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['Quiz'],
  endpoints: (build) => ({
    getQuizProblemById: build.query({
      queryFn: async (id) => {
        try {
          const quiz = await getQuizProblemById(id);
          // Return the result in an object with a `data` field
          return { data: quiz };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(quizHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Quiz'],
    }),
     getQuizProblemsBySourceKey: build.query({
      queryFn: async (id) => {
        try {
          const quiz = await getQuizProblemsBySourceKey(id);
          // Return the result in an object with a `data` field
          return { data: quiz };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Quiz'],
    }),
    getQuizProblemByQuery: build.query({
      queryFn: async (query) => {
        try {
          const chats = await getQuizProblemByQuery(query);
          // Return the result in an object with a `data` field
          return { data: chats };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(quizQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Quiz'],
    }),
    createQuizProblem: build.mutation({
      queryFn: async (quiz) => {
        try {
          const r = await createQuizProblem(quiz);
          return { data: r };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(quiz, { dispatch, queryFulfilled }) {
        try {
          const r = await queryFulfilled;
          dispatch(quizAdded(r));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Quiz'],
    }),
    updateQuizProblem  : build.mutation({
      queryFn: async ({id, field, value}) => {
        try {
          const r = await updateQuizProblem(id, field, value);
          return { data: r };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted({id, field, value}, { dispatch, queryFulfilled }) {
        try {
          const r = await queryFulfilled;
          dispatch(quizUpdated(r));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Quiz'],
    }),
    deleteAllQuizProblem: build.mutation({
      queryFn: async () => {
        try {
          await deleteAllQuizProblem();
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(quizQueried([]));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Quiz'],
    }),
     deleteQuizProblem: build.mutation({
      queryFn: async (id) => {
        try {
          await deleteQuizProblem(id);
          return { data: id };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(quizDeleted(id));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Quiz'],
    }),
  }),
});

export const {
  useCreateQuizProblemMutation,
  useDeleteAllQuizProblemMutation,
  useDeleteQuizProblemMutation,
  useGetQuizProblemByIdQuery,
  useGetQuizProblemByQueryQuery,
  useGetQuizProblemsBySourceKeyQuery,
  useUpdateQuizProblemMutation,
} = quizApi;

export const { endpoints, reducerPath, reducer, middleware } = quizApi;
