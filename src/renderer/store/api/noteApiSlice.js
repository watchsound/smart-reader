/**
 *  NOTE:::  not used for now...
 *
 *
 *  */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import {
  getNotesByQuery,
  // saveNotes,
  createNote,
  getNoteById,
  // getByBookKey,
  updateNote,
  replaceNote,
  deleteNoteById,
  deleteAllNote,
} from '../../api/notesApi';

import customStorage from '../customStorage';

import {
  notesQueried,
  noteAdded,
  noteUpdated,
  noteDeleted,
  notesCleared,
} from '../reducers/noteSlice';

async function populateNote(note) {
  const images = [];
  for (let i = 0; i <= 2; i++) {
    images[i] =
      note && note.cards && note.cards[i] && note.cards[i].image
        ? await customStorage.getImage(note.cards[i].image)
        : null;
  }
  return { data: { note, images } };
}

export const noteApi = createApi({
  reducerPath: 'noteapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['Note', 'Image'],
  endpoints: (build) => ({
    // normal HTTP endpoint using fetchBaseQuery
    // getPosts: build.query({
    //   query: () => ({ url: 'posts' }),
    // }),
    // endpoint with a custom `queryFn` and separate async logic
    getNotesByQuery: build.query({
      queryFn: async (parmas) => {
        try {
          const notes = await getNotesByQuery(parmas);
          // Return the result in an object with a `data` field
          return { data: notes };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(notesQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Note'],
    }),
    // getNotesFromBookKey: build.query({
    //   queryFn: async (query) => {
    //     try {
    //       const notes = await getByBookKey(query);
    //       return { data: notes };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    //   providesTags: ['BookNote'],
    // }),
    // saveNotesToDB: build.mutation({
    //   queryFn: async (notes) => {
    //     try {
    //       await saveNotes(notes);
    //       return { data: notes };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    //   async onQueryStarted(notes, { dispatch, queryFulfilled }) {
    //     try {
    //       await queryFulfilled;
    //       dispatch(notesQueried(notes));
    //     } catch (err) {
    //       console.log(err);
    //     }
    //   },
    //   invalidatesTags: ['Note'],
    // }),
    createNote: build.mutation({
      queryFn: async (note) => {
        try {
          const note2 = await createNote(note);
          return { data: note2 };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(note, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(noteAdded(data));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Note'],
    }),

    getNoteById: build.query({
      queryFn: async (id) => {
        try {
          const note = await getNoteById(id);
          return populateNote(note);
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Note'],
    }),
    // updateBookOrFreeNote: build.mutation({
    //   queryFn: async (note) => {
    //     try {
    //       if (note.sourceKey) updateBookNote(note.sourceKey, note.id, note);
    //       else updateNote(note);
    //       return { data: note };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    // }),
    updateNote: build.mutation({
      queryFn: async (note) => {
        try {
          const r = await updateNote(note);
          return { data: r };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(note, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(noteUpdated(data));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Note'],
    }),
    replaceNote: build.mutation({
      queryFn: async (note) => {
        try {
          const r = await replaceNote(note.id, note);
          return r > 0 ? { data: note } : { data: null };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(note, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data) dispatch(noteUpdated(data));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Note'],
    }),
    //  deleteBookOrFreeNote : build.mutation({
    //     queryFn: async (id) => {
    //       try {
    //         deleteNote(id);
    //         return { data: id };
    //       } catch (error) {
    //         return { error };
    //       }
    //     },
    //   }),
    deleteNoteById: build.mutation({
      queryFn: async (id) => {
        try {
          await deleteNoteById(id);
          return { data: id };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(noteDeleted(id));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Note'],
    }),
    deleteAllNote: build.mutation({
      queryFn: async () => {
        try {
          await deleteAllNote();
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(notesCleared());
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Note'],
    }),
    getImage: build.query({
      queryFn: async (id) => {
        try {
          const note = await customStorage.getImage(id);
          return { data: note };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Image'],
    }),
    createImage: build.mutation({
      queryFn: async (  image ) => {
        try {
          const r = await customStorage.createImage( image );
          return { data: [r.id] };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: ['Image'],
    }),
  }),
});

export const {
  useGetNotesByQueryQuery,
  // useSaveNotesToDBMutation,
  useCreateNoteMutation,
  useGetNoteByIdQuery,
  useReplaceNoteMutation,
  // useGetBookOrFreeNoteQuery,
  // useUpdateBookOrFreeNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteByIdMutation,
  // useDeleteBookOrFreeNoteMutation,
  useDeleteAllNoteMutation,
  useGetImageQuery,
  useCreateImageMutation,
} = noteApi;

export const { endpoints, reducerPath, reducer, middleware } = noteApi;
