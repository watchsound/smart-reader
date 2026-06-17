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
import LearnAboutPage from './views/learnabout';
import KnowledgeDashboard from './views/knowledge';
import LearningCalendarPage from './views/calendar';
import { LearningPlansPage } from './views/learning';
import { StudySessionPage } from './views/study';
import AISessionView from './views/aiSession/AISessionView';
import SessionSummaryView from './views/aiSession/SessionSummaryView';


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
        shouldReload: false,
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

        shouldReload: false,
      },
      {
        path: 'bookmarks',
        element: <BookmarksPage />,
        // loader: notesLoader,

        shouldReload: false,
      },
      {
        path: 'home',
        element: <HomePage />,
        // loader: notesLoader,

        shouldReload: false,
      },
      {
        path: 'moodBoard',
        element: <MoodBoardPage />,
        loader: moodBoardLoader,

        shouldReload: false,
      },
      {
        path: 'moodBoard/:id',
        element: <MoodBoardPage />,
        loader: moodBoardLoader,

        shouldReload: false,
      },
      {
        path: 'vocabulary',
        element: <VocabularyPage />,

        shouldReload: false,
      },
      {
        path: 'writing',
        element: <WritingPage />,

        shouldReload: false,
      },
      {
        path: 'translate',
        element: <TranslatePage />,

        shouldReload: false,
        // loader: notesLoader,
      },
      {
        path: 'grammar',
        element: <GrammarPage />,

        shouldReload: false,
      },
      {
        path: 'chat/:id',
        element: <ChatPage />,
        loader: chatLoader,

        shouldReload: false,
      },
      {
        path: 'chat',
        element: <ChatPage />,
        loader: chatLoader,

        shouldReload: false,
      },
      {
        path: 'learnabout',
        element: <LearnAboutPage />,
        // loader: notesLoader,

        shouldReload: false,
      },
      {
        path: 'knowledge',
        element: <KnowledgeDashboard />,

        shouldReload: false,
      },
      {
        path: 'calendar',
        element: <LearningCalendarPage />,

        shouldReload: false,
      },
      {
        path: 'learning-plans',
        element: <LearningPlansPage />,

        shouldReload: false,
      },
      {
        path: 'study/:planId',
        element: <StudySessionPage />,

        shouldReload: false,
      },
      {
        path: 'study',
        element: <StudySessionPage />,

        shouldReload: false,
      },
      {
        path: 'quiz',
        element: <QuizPage />,

        shouldReload: false,
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

        shouldReload: false,
      },
      {
        path: 'reading/:id/:noteId',
        element: <EReaderPage />,
        loader: bookLoader,

        shouldReload: false,
      },
      {
        path: 'browser/:id',
        element: <BrowserView />,
        loader: urlLoader,

        shouldReload: false,
      },
      {
        path: 'browser',
        element: <BrowserView />,
        loader: urlLoader,

        shouldReload: false,
      },
      {
        // Phase 10b-2 Task 5: AI-directed study session shell.
        path: 'ai-session/:id',
        element: <AISessionView />,

        shouldReload: false,
      },
      {
        // Phase 10b-2 Task 7: End-of-session recap.
        path: 'ai-session/:id/summary',
        element: <SessionSummaryView />,

        shouldReload: false,
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
