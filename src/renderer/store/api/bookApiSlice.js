import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  getBooksByQuery,
  getBooksByCategory,
  // saveBooksToDB,
  getBookById,
  updateBook,
  // deleteBook,
  clearAllBooks,
  getImage,
  createImage,
} from '../../api/booksApi';

import {
  booksQueried,
  bookAdded,
  bookUpdated,
  bookDeleted,
  booksCleared,
} from '../reducers/managerSlice';
import customStorage from '../customStorage';

async function populateBook(book) {
  const image =
    book && book.cover ? await customStorage.getImage(book.cover) : null;
  return { data: { book, image } };
}

export const bookApi = createApi({
  reducerPath: 'bookapi',
  baseQuery: fetchBaseQuery({ url: '/' }),
  tagTypes: ['Book', 'Image'],
  endpoints: (build) => ({
    getBooksByQuery: build.query({
      queryFn: async (query) => {
        try {
          const books = await getBooksByQuery(query);
          return { data: books };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(booksQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Book'],
    }),
    getBooksByCategory: build.query({
      queryFn: async (query) => {
        try {
          const books = await getBooksByCategory(query);
          return { data: books };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(query, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(booksQueried(data));
        } catch (err) {
          console.log(err);
        }
      },
      providesTags: ['Book'],
    }),
    // saveBooksToDB: build.mutation({
    //   queryFn: async (books) => {
    //     try {
    //       await saveBooksToDB(books);
    //       return { data: books };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    //   invalidatesTags: ['Book'],
    // }),
    getBookById: build.query({
      queryFn: async (id) => {
        try {
          const book = await getBookById(id);
          // return { data: book };
          return populateBook(book);
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Book'],
    }),
    updateBook: build.mutation({
      queryFn: async ({ id, field, value }) => {
        try {
          const r = await updateBook({ id, field, value });
          return { data: r };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted({ id, field, value }, { dispatch, queryFulfilled }) {
        try {
          const r = await queryFulfilled;
          dispatch(bookUpdated(r));
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Book'],
    }),
    // deleteBook: build.mutation({
    //   queryFn: async (id) => {
    //     try {
    //       await deleteBook(id);
    //       return { data: id };
    //     } catch (error) {
    //       return { error };
    //     }
    //   },
    //   async onQueryStarted(id, { dispatch, queryFulfilled }) {
    //     try {
    //       await queryFulfilled;
    //       dispatch(bookDeleted(id));
    //     } catch (err) {
    //       console.log(err);
    //     }
    //   },
    //   invalidatesTags: ['Book'],
    // }),
    clearAllBooks: build.mutation({
      queryFn: async () => {
        try {
          await clearAllBooks();
          return { data: [] };
        } catch (error) {
          return { error };
        }
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(booksCleared());
        } catch (err) {
          console.log(err);
        }
      },
      invalidatesTags: ['Book'],
    }),
    getImage: build.query({
      queryFn: async (imageId) => {
        try {
          const image = await getImage(imageId);
          return { data: image };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Image'],
    }),
    createImage: build.mutation({
      queryFn: async ( image ) => {
        try {
          const r = await createImage( image );
          return { data: r.id };
        } catch (error) {
          return { error };
        }
      },
      invalidatesTags: ['Image'],
    }),
  }),
});

export const {
  useGetBooksByQueryQuery,
  useGetBooksByCategoryQuery,
  // useSaveBooksToDBMutation,
  useGetBookByIdQuery,
  useUpdateBookMutation,
  // useDeleteBookMutation,
  useClearAllBooksMutation,
  useGetImageQuery,
  useCreateImageMutation,
} = bookApi;

export const { endpoints, reducerPath, reducer, middleware } = bookApi;
