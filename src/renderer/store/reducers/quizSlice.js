/* eslint-disable prettier/prettier */
import { createSlice } from '@reduxjs/toolkit';

const quizSlice = createSlice({
  name: 'quiz',
  initialState: {
    quizzes: [],
    curQuiz: null,
  },
  reducers: {
    quizHandled: (state, action) => {
      const quiz = action.payload || null;
      state.curQuiz = quiz;
    },
    quizQueried: (state, action) => {
      const quizzes = action.payload || [];
      state.quizzes = quizzes;
    },

    quizAdded: (state, action) => {
      const quiz = action.payload;
      state.quizzes = [...state.quizzes, quiz];
    },
    quizUpdated: (state, action) => {
      const updated = action.payload;
      const newNotes = state.quizzes.map((quiz) =>
        quiz.id !== updated.id ? quiz : updated,
      );
      state.quizzes = newNotes;
    },
    quizDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.quizzes.filter((chat) => chat.id !== deletedKey);
      state.quizzes = newNotes;
    },

  },
});

export const {
  quizHandled,
  quizQueried,
  quizAdded,
  quizUpdated,
  quizDeleted,
} = quizSlice.actions;
// Export the slice reducer as the default export
export default quizSlice.reducer;
