/* eslint-disable prettier/prettier */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  saveBookNote,
  updateBookNote,
  // deleteBookAnnotation,
  clearBookNotes,
  getBookNotes,
} from '../../api/booksApi';

import {
  deleteNoteById
} from '../../api/notesApi';

import {
  notesQueried,
  noteAdded,
  noteUpdated,
  noteDeleted,
  notesCleared,
  annotationsQueried,
  annotationAdded,
  annotationUpdated,
  annotationDeleted,
  annotationsCleared,
} from '../reducers/readerSlice';



export const readerApi = createApi({
  reducerPath: 'readerapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['BookNote', 'Book'],
  endpoints: (build) => ({
    getBookNotes: build.query({
      queryFn: async (bookId) => {
        try {
          const notes = await getBookNotes(bookId);
          return { data: notes };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(notesQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['BookNote'],
    }),


    saveBookNote: build.mutation({
      queryFn: async (bookKey, note) => {
        try {
          await saveBookNote(bookKey, note);
          return { data: note };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(note, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(noteAdded(note));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['BookNote'],
    }),

    // saveBookAnnotations: build.mutation({
    //   queryFn: async (bookKey, annotations) => {
    //     try {
    //       await saveBookAnnotations(bookKey, annotations);
    //       return { data: annotations };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    //   invalidatesTags: ['BookNote'],
    // }),
    updateBookNote: build.mutation({
      queryFn: async (bookKey, noteId, note) => {
        try {
          await updateBookNote(bookKey, noteId, note);
          return { data: note };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(note, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(noteUpdated(note));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['BookNote'],
    }),


    deleteNoteById: build.mutation({
      queryFn: async (id) => {
        try {
          await deleteNoteById(id );
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
      invalidatesTags: ['BookNote'],
    }),

    // deleteBookAnnotation: build.mutation({
    //   queryFn: async (bookKey, id) => {
    //     try {
    //       await deleteBookAnnotation(bookKey, id);
    //       return { data: id };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    //   async onQueryStarted(id, { dispatch, queryFulfilled }) {
    //     try {
    //       await queryFulfilled;
    //       dispatch(annotationDeleted(id));
    //     } catch (err) {
    //       console.log(err);
    //     }
    //   },
    //   invalidatesTags: ['BookNote'],
    // }),

    clearBookNotes: build.mutation({
      queryFn: async () => {
        try {
          await clearBookNotes();
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
      invalidatesTags: ['Book'],
    }),
  }),
});

export const {
  useGetBookNotesQuery,
  useSaveBookNoteMutation,
  useUpdateBookNoteMutation,
  useDeleteNoteByIdMutation,
//  useDeleteBookAnnotationMutation,
  useClearBookNotesMutation,
} = readerApi;

export const { endpoints, reducerPath, reducer, middleware } = readerApi;
