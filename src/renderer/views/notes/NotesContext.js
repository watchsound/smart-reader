/* eslint-disable prettier/prettier */
import { createContext } from 'react';

const NotesContext = createContext({
  tags: [],
  query: '',
  stars: 0,
});

export default NotesContext;
