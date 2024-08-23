// import { createRoot } from 'react-dom/client';
// import App from './App';

// const container = document.getElementById('root') as HTMLElement;
// const root = createRoot(container);
// root.render(<App />);
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';

import { CssBaseline } from '@mui/material';
import { CacheProvider } from '@emotion/react';
import { Provider } from 'react-redux';
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from '@mui/material/styles';
import { ThemeProvider, useTheme } from './ThemeContext';
import lightTheme from './theme/lightTheme'; // Import your light theme configuration
import darkTheme from './theme/darkTheme'; // Import your dark theme configuration

import ErrorPage from './error-page';

import './App.css';
import './styles/globals.css';
import './styles/Note.css';
import './styles/github-markdown.css';
import 'katex/dist/katex.min.css';

import Root from './routes/root';
import Index from './routes/index';
import NotePage from './views/notes/index';
import EReaderPage, { loader as bookLoader } from './views/reading/index';
import BrowserView, { loader as urlLoader } from './views/browser/index';
import BookshelfPage from './views/bookshelf/index';
import BookmarksPage from './views/bookmarks';
import HomePage from './views/home/index';
import SettingsPage from './views/settings';
import Login from './views/login/Login';
import Register from './views/login/Register';
import WritingPage from './views/writing';
import QuizPage from './views/quiz/index';
import ChatPage, { loader as chatLoader } from './views/chat/index';
import store from './store/store';
import MoodBoardPage, { loader as moodBoardLoader } from './views/moodboard';
import VocabularyPage from './views/vocabulary';
import TranslatePage from './views/translate';
import GrammarPage from './views/grammar';
import ErrorBoundary from './ErrorBoundary';

const router = createHashRouter([
  {
    path: '/',
    element: <Root />,
    errorElement: <ErrorPage />,
    // children:{
    //   errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Index /> },
      {
        path: 'notes',
        element: <NotePage />,
        // loader: notesLoader,
      },
      // {
      //   path: 'books',
      //   element: <BooksPage />,
      //   // loader: notesLoader,
      // },
      {
        path: 'bookshelf',
        element: <BookshelfPage />,
        // loader: notesLoader,
      },
      {
        path: 'bookmarks',
        element: <BookmarksPage />,
        // loader: notesLoader,
      },
      {
        path: 'home',
        element: <HomePage />,
        // loader: notesLoader,
      },
      {
        path: 'moodBoard',
        element: <MoodBoardPage />,
        loader: moodBoardLoader,
      },
      {
        path: 'moodBoard/:id',
        element: <MoodBoardPage />,
        loader: moodBoardLoader,
      },
      {
        path: 'vocabulary',
        element: <VocabularyPage />,
      },
      {
        path: 'writing',
        element: <WritingPage />,
      },
      {
        path: 'translate',
        element: <TranslatePage />,
        // loader: notesLoader,
      },
      {
        path: 'grammar',
        element: <GrammarPage />,
      },
      {
        path: 'chat/:id',
        element: <ChatPage />,
        loader: chatLoader,
      },
      {
        path: 'chat',
        element: <ChatPage />,
        loader: chatLoader,
      },
      {
        path: 'quiz',
        element: <QuizPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'login',
        element: <Login />,
      },
      {
        path: 'register',
        element: <Register />,
      },
      {
        path: 'reading/:id',
        element: <EReaderPage />,
        loader: bookLoader,
      },
      {
        path: 'reading/:id/:noteId',
        element: <EReaderPage />,
        loader: bookLoader,
      },
      {
        path: 'browser/:id',
        element: <BrowserView />,
        loader: urlLoader,
      },
      {
        path: 'browser',
        element: <BrowserView />,
        loader: urlLoader,
      },
    ],
  },
  // },
]);

// initTheme();
// initSystemFont();
function ThemedApp() {
  const { themeMode } = useTheme();
  const theme = createTheme(themeMode === 'light' ? lightTheme : darkTheme);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </MuiThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<p>Something went wrong</p>}>
      <Provider store={store}>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);

// calling IPC exposed from preload script
window.electron.ipcRenderer.once('ipc-example', (arg) => {
  // eslint-disable-next-line no-console
  console.log(arg);
});
window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
