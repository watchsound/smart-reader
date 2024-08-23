/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable no-nested-ternary */
/* eslint-disable react/button-has-type */
import React, { useEffect } from 'react';
import { Outlet, NavLink, useNavigation, useNavigate } from 'react-router-dom';

import { useSelector, useDispatch } from 'react-redux';
import HomeIcon from '@mui/icons-material/Home';
import LanguageIcon from '@mui/icons-material/Language';
import ChatIcon from '@mui/icons-material/Chat';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import DashboardIcon from '@mui/icons-material/Dashboard';
import QuizIcon from '@mui/icons-material/Quiz';
import TuneIcon from '@mui/icons-material/Tune';
import LoginIcon from '@mui/icons-material/Login';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import AbcIcon from '@mui/icons-material/Abc';
import GTranslateIcon from '@mui/icons-material/GTranslate';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import RuleIcon from '@mui/icons-material/Rule';
import { styled } from '@mui/material/styles';
import { grey } from '@mui/material/colors';
// import { logoutHandled } from '../store/reducers/userSlice';
import customStorage from '../store/customStorage';
// import Login from '../views/login/Login';
import '../App.css';

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 0px)',
  // width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

export default function Root() {
  const [serverUrl, setServerUrl] = React.useState('');
  const navigation = useNavigation();
  const userInfo = useSelector((state) => state.user.userInfo);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  useEffect(() => {
    async function t() {
      const url = await customStorage.getServerUrl();
      setServerUrl(url || '');
    }
    t();
    document.addEventListener('mycustomlink', (event) => {
      console.log('Received in renderer view:', event.data);
    });
  }, []);

  if (!userInfo || !userInfo.token) {
    return (
      <>
        <div id="sidebar">
          <h1>My AI Powered Reader</h1>
          <div />
          <div>
            <NavLink
              to="login"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <LoginIcon style={{ marginRight: 8 }} />
              Login
            </NavLink>
          </div>
          <div>
            <NavLink
              to="register"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <HowToRegIcon style={{ marginRight: 8 }} />
              Register
            </NavLink>
          </div>
        </div>
        <div id="detail" className="app-background">
          <Outlet />
        </div>
      </>
    );
  }
  return (
    <>
      <ScrollPane>
        <div id="sidebar">
          <h1>My AI Powered Reader</h1>
          <div />
          <div>
            <NavLink
              to="bookshelf"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <LibraryBooksIcon style={{ marginRight: 8 }} />
              Bookshelf
            </NavLink>
          </div>
          {serverUrl && (
            <div>
              <NavLink
                to="home"
                className={({ isActive, isPending }) =>
                  isActive ? 'active' : isPending ? 'pending' : ''
                }
                style={{
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit',
                }}
              >
                <HomeIcon style={{ marginRight: 8 }} />
                Library(Server)
              </NavLink>
            </div>
          )}

          <div>
            <NavLink
              to="browser"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <LanguageIcon style={{ marginRight: 8 }} />
              Browser
            </NavLink>
          </div>
          <div>
            <NavLink
              to="chat"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <ChatIcon style={{ marginRight: 8 }} />
              AI-Bot
            </NavLink>
          </div>
          <div>
            <NavLink
              to="bookmarks"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <BookmarksIcon style={{ marginRight: 8 }} />
              Bookmarks
            </NavLink>
          </div>
          <div>
            <NavLink
              to="notes"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <TextSnippetIcon style={{ marginRight: 8 }} />
              Notes
            </NavLink>
          </div>
          <div>
            <NavLink
              to="moodBoard"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <DashboardIcon style={{ marginRight: 8 }} />
              Mood Board
            </NavLink>
          </div>
          <div>
            <NavLink
              to="vocabulary"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <AbcIcon style={{ marginRight: 8 }} />
              Vocabulary
            </NavLink>
          </div>
          <div>
            <NavLink
              to="quiz"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <QuizIcon style={{ marginRight: 8 }} />
              Quiz
            </NavLink>
          </div>
          <div>
            <NavLink
              to="writing"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <DriveFileRenameOutlineIcon style={{ marginRight: 8 }} />
              Writing
            </NavLink>
          </div>

          <div>
            <NavLink
              to="translate"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <GTranslateIcon style={{ marginRight: 8 }} />
              Translation
            </NavLink>
          </div>
          <div>
            <NavLink
              to="grammar"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <RuleIcon style={{ marginRight: 8 }} />
              Grammar Check
            </NavLink>
          </div>
          <div>
            <div
              onClick={async () => {
                await customStorage.logout(dispatch);
                navigate('/login');
              }}
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <ExitToAppIcon style={{ marginRight: 8 }} />
              Logout
            </div>
          </div>
          <div>
            <NavLink
              to="register"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <HowToRegIcon style={{ marginRight: 8 }} />
              Register
            </NavLink>
          </div>
          <div>
            <NavLink
              to="settings"
              className={({ isActive, isPending }) =>
                isActive ? 'active' : isPending ? 'pending' : ''
              }
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                color: 'inherit',
              }}
            >
              <TuneIcon style={{ marginRight: 8 }} />
              Settings
            </NavLink>
          </div>
        </div>
      </ScrollPane>
      <div
        id="detail"
        className={navigation.state === 'loading' ? 'loading' : ''}
      >
        <Outlet />
      </div>
    </>
  );
}
