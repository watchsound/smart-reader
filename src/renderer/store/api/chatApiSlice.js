/* eslint-disable prettier/prettier */
/**
 *  NOTE:::  not used for now...
 *
 *
 *  */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  getChatsByQuery,
  getChatById,
  getPinnedChats,
  createChat,
  updateChat,
  getPromptById,
  getPromptsByQuery,
  createPrompt,
  getMessagesByChatId,
  getMessageById,
  createMessage,
  deleteChat,
  deleteAllChats,
  deleteAllPrompts,
  updateMessage,
} from '../../api/chatApi';

import {
  chatHandled,
  chatQueried,
  messageHandled,
  messageQueried,
  promptHandled,
  promptQueried,
  chatAdded,
  chatUpdated,
  chatDeleted,
  messageAdded,
  messageUpdated,
  messageDeleted,
} from '../reducers/chatSlice';

export const chatApi = createApi({
  reducerPath: 'chatapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['Chat', 'Message', 'Prompt'],
  endpoints: (build) => ({
    getChatById: build.query({
      queryFn: async (query) => {
        try {
          const chats = await getChatById(query);
          // Return the result in an object with a `data` field
          return { data: chats };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(chatHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Chat'],
    }),
    getChatsByQuery: build.query({
      queryFn: async (params) => {
        try {
          const chats = await getChatsByQuery(params);
          // Return the result in an object with a `data` field
          return { data: chats };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(params, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(chatQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Chat'],
    }),
    createChat: build.mutation({
      queryFn: async (chat) => {
        try {
          const chat2 = await createChat(chat);
          return { data: chat2 };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(chat, { dispatch, queryFulfilled }) {
        try {
          const r = await queryFulfilled;
          dispatch(chatAdded(r));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Chat'],
    }),
    updateChat: build.mutation({
      queryFn: async ({id, field, value}) => {
        try {
          const c = await updateChat({id, field, value});
          return { data: c };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted({id, field, value}, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(chatUpdated(data));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Chat'],
    }),
    deleteAllChats: build.mutation({
      queryFn: async () => {
        try {
          await deleteAllChats();
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatQueried([]));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Chat'],
    }),
     deleteChat: build.mutation({
      queryFn: async (id) => {
        try {
          await deleteChat(id);
          return { data: id };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(chatDeleted(id));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Chat'],
    }),
    //
    //
    getPromptById: build.query({
      queryFn: async (id) => {
        try {
          const note = await getPromptById(id);
          // Return the result in an object with a `data` field
          return { data: note };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(promptHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Prompt'],
    }),
    getPromptsByQuery: build.query({
      queryFn: async (params) => {
        try {
          const prompts = await getPromptsByQuery(params);
          // Return the result in an object with a `data` field
          return { data: prompts };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(params, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(promptQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Prompt'],
    }),
    createPrompt: build.mutation({
      queryFn: async (prompts) => {
        try {
          const p = await createPrompt(prompts);
          return { data: p };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: ['Prompt'],
    }),
    //
    getMessageById: build.query({
      queryFn: async (query) => {
        try {
          const messages = await getMessageById(query);
          // Return the result in an object with a `data` field
          return { data: messages };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(messageHandled(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Message'],
    }),
    getMessagesByChatId: build.query({
      queryFn: async (id) => {
        try {
          const messages = await getMessagesByChatId(id);
          // Return the result in an object with a `data` field
          return { data: messages };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(messageQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Message'],
    }),
    createMessage: build.mutation({
      queryFn: async (messages) => {
        try {
          const m = await createMessage(messages);
          return { data: m };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(messages, { dispatch, queryFulfilled }) {
        try {
          const m = await queryFulfilled;
          dispatch(messageAdded(m));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Message'],
    }),
    updateMessage: build.mutation({
      queryFn: async ({id, key, value}) => {
        try {
          const m = await updateMessage({id, key, value});
          return { data: m };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted({id, key, value}, { dispatch, queryFulfilled }) {
        try {
          const m = await queryFulfilled;
          dispatch(messageUpdated(m));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Message'],
    }),
    deleteAllPrompts: build.mutation({
      queryFn: async () => {
        try {
          await deleteAllPrompts();
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(promptQueried([]));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Prompt'],
    }),
  }),
});

export const {
  useGetChatsByQueryQuery,
  useGetChatByIdQuery,
  useCreateChatMutation,
  useUpdateChatMutation,
  useDeleteChatMutation,
  useGetPromptByIdQuery,
  useGetPromptsByQueryQuery,
  useCreatePromptMutation,
  useGetMessagesByChatIdQuery,
  useGetMessageByIdQuery,
  useCreateMessageMutation,
  useDeleteAllChatsMutation,
  useDeleteAllPromptsMutation,
} = chatApi;

export const { endpoints, reducerPath, reducer, middleware } = chatApi;
