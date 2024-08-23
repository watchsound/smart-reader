/* eslint-disable prettier/prettier */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    prompts: [],
    chats: [],
    pinned: [],
    messages: [],
    curMessage: null,
    curChat: null,
    curPrompt: null,
  },
  reducers: {
    chatHandled: (state, action) => {
      const chat = action.payload || null;
      state.curChat = chat;
    },
    chatQueried: (state, action) => {
      const chats = action.payload || [];
      state.chats = chats;
    },
    pinnedQueried: (state, action) => {
      const chats = action.payload || [];
      state.pinned = chats;
    },
    messageHandled: (state, action) => {
      const message = action.payload || null;
      state.curMessage = message;
    },
    messageQueried: (state, action) => {
      const messages = action.payload || [];
      state.messages = messages;
    },
    promptHandled: (state, action) => {
      const prompt = action.payload || null;
      state.curPrompt = prompt;
    },
    promptQueried: (state, action) => {
      const prompts = action.payload || [];
      state.prompts = prompts;
    },
    promptAdded: (state, action) => {
      const prompt = action.payload;
      state.prompts = [...state.prompts, prompt];
    },
    promptUpdated: (state, action) => {
      const updated = action.payload;
      const newNotes = state.prompts.map((chat) =>
        chat.id !== updated.id ? chat : updated,
      );
      state.prompts = newNotes;
    },
    promptDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.prompts.filter((chat) => chat.id !== deletedKey);
      state.prompts = newNotes;
    },
    chatAdded: (state, action) => {
      const chat = action.payload;
      state.chats = [...state.chats, chat];
    },
    pinnedAdded: (state, action) => {
      const chat = action.payload;
      state.pinned = [...state.pinned, chat];
    },
    chatUpdated: (state, action) => {
      const updated = action.payload;
      if( !updated ) return;
      const newNotes = state.chats.map((chat) =>
        chat.id !== updated.id ? chat : updated,
      );
      state.chats = newNotes;
    },
    chatDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.chats.filter((chat) => chat.id !== deletedKey);
      state.chats = newNotes;
    },
    pinnedDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.pinned.filter((chat) => chat.id !== deletedKey);
      state.pinned = newNotes;
    },
    messageAdded: (state, action) => {
      const message = action.payload;
      state.messages = [...state.messages, message];
    },
    messageUpdated: (state, action) => {
      const updated = action.payload;
      const newNotes = state.messages.map((message) =>
        message.id !== updated.id ? message : updated,
      );
      state.messages = newNotes;
    },
    messageDeleted: (state, action) => {
      const deletedKey = action.payload;
      const newNotes = state.messages.filter(
        (message) => message.id !== deletedKey,
      );
      state.messages = newNotes;
    },
  },
});

export const {
  chatHandled,
  chatQueried,
  pinnedQueried,
  pinnedAdded,
  pinnedDeleted,
  messageHandled,
  messageQueried,
  promptHandled,
  promptQueried,
  promptAdded,
  promptUpdated,
  promptDeleted,
  chatAdded,
  chatUpdated,
  chatDeleted,
  messageAdded,
  messageUpdated,
  messageDeleted,
} = chatSlice.actions;
// Export the slice reducer as the default export
export default chatSlice.reducer;
