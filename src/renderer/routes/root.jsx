/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable no-nested-ternary */
/* eslint-disable react/button-has-type */
import React, { useEffect, useState } from 'react';
import {
  Outlet,
  NavLink,
  useNavigation,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Avatar,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Dialog,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
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
import CastForEducationIcon from '@mui/icons-material/CastForEducation';
import GTranslateIcon from '@mui/icons-material/GTranslate';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import RuleIcon from '@mui/icons-material/Rule';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import SchoolIcon from '@mui/icons-material/School';
import CreateIcon from '@mui/icons-material/Create';
import HubIcon from '@mui/icons-material/Hub';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FlagIcon from '@mui/icons-material/Flag';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

import customStorage from '../store/customStorage';
import { loginHandled } from '../store/reducers/userSlice';
import Index from './index';
import HeaderQuickActions from '../components/header/HeaderQuickActions';
import BrainOrb from '../components/brainShell/BrainOrb';
import FlowCoordinator from '../components/brainShell/FlowCoordinator';
import OrbQuestMenu from '../components/brainShell/OrbQuestMenu';
import useBrainState from '../brain/useBrainState';
import triggerBus from '../brain/triggerBus';
import useBookIndexingToasts from '../hooks/useBookIndexingToasts';
import { Toaster } from 'react-hot-toast';

const drawerWidth = 260;

// Slack-style sidebar color palette
const colors = {
  primary: '#4a154b', // Slack aubergine
  accent: '#611f69', // Lighter aubergine
  background: '#3f0e40', // Slack sidebar dark purple
  surface: '#350d36', // Darker surface
  textMuted: 'rgba(255, 255, 255, 0.7)', // White with transparency
  hover: 'rgba(255, 255, 255, 0.06)',
  active: 'rgba(255, 255, 255, 0.12)', // White tint for active state
  border: 'rgba(255, 255, 255, 0.08)',
};

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '16px 12px',
  justifyContent: 'space-between',
}));

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: drawerWidth,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: drawerWidth,
    boxSizing: 'border-box',
    background: colors.background,
    color: '#fff',
    borderRight: 'none',
    boxShadow: '4px 0 25px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    '& > div': {
      overflowY: 'auto',
      overflowX: 'hidden',
      '&::-webkit-scrollbar': {
        width: '4px',
      },
      '&::-webkit-scrollbar-track': {
        background: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        background: 'rgba(255, 255, 255, 0.15)',
        borderRadius: '2px',
      },
      '&::-webkit-scrollbar-thumb:hover': {
        background: 'rgba(255, 255, 255, 0.25)',
      },
    },
  },
}));

const StyledListItemButton = styled(ListItemButton)(({ theme, active }) => ({
  margin: '2px 10px',
  padding: '9px 14px',
  borderRadius: '8px',
  transition: 'all 0.15s ease',
  backgroundColor: active ? colors.active : 'transparent',
  '&:hover': {
    backgroundColor: colors.hover,
  },
  '& .MuiListItemIcon-root': {
    color: active ? '#fff' : colors.textMuted,
    minWidth: 34,
  },
  '& .MuiListItemText-primary': {
    fontWeight: active ? 500 : 400,
    fontSize: '0.875rem',
    color: active ? '#fff' : colors.textMuted,
  },
}));

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: theme.palette.mode === 'dark' ? '#222529' : '#ffffff',
  boxShadow: 'none',
  borderBottom:
    theme.palette.mode === 'dark' ? '1px solid #3d4043' : '1px solid #e8e8e8',
}));

const LogoText = styled(Typography)(({ theme }) => ({
  color: theme.palette.mode === 'dark' ? '#d1d2d3' : '#1d1c1d',
  fontWeight: 700,
  letterSpacing: '-0.3px',
  fontSize: '1.1rem',
}));

const MainContent = styled('main')(({ theme }) => ({
  flex: 1,
  width: '100%',
  height: '100vh',
  overflow: 'auto',
  backgroundColor: theme.palette.mode === 'dark' ? '#1a1d21' : '#f8f8f8',
  // Hide scrollbar but allow scrolling
  '&::-webkit-scrollbar': {
    width: 0,
    background: 'transparent',
  },
  scrollbarWidth: 'none',
}));

const navItems = {
  reading: [
    { path: 'bookshelf', label: 'Bookshelf', icon: LibraryBooksIcon },
    { path: 'browser', label: 'Browser', icon: LanguageIcon },
    { path: 'bookmarks', label: 'Bookmarks', icon: BookmarksIcon },
  ],
  learning: [
    { path: 'learning-plans', label: 'Learning Plans', icon: FlagIcon },
    { path: 'calendar', label: 'Learning Calendar', icon: CalendarMonthIcon },
    { path: 'knowledge', label: 'Knowledge Graph', icon: HubIcon },
    { path: 'learnabout', label: 'Learn About', icon: CastForEducationIcon },
    { path: 'vocabulary', label: 'Vocabulary', icon: AbcIcon },
    { path: 'quiz', label: 'Quiz', icon: QuizIcon },
  ],
  writing: [
    { path: 'writing', label: 'Writing', icon: DriveFileRenameOutlineIcon },
    { path: 'translate', label: 'Translation', icon: GTranslateIcon },
    { path: 'grammar', label: 'Grammar Check', icon: RuleIcon },
  ],
  tools: [
    { path: 'chat', label: 'AI Assistant', icon: ChatIcon },
    { path: 'notes', label: 'Notes', icon: TextSnippetIcon },
    { path: 'moodBoard', label: 'Mood Board', icon: DashboardIcon },
  ],
};

export default function Root() {
  useBookIndexingToasts();
  const [serverUrl, setServerUrl] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    reading: true,
    learning: true,
    writing: false,
    tools: true,
  });

  const navigation = useNavigation();
  const location = useLocation();
  const userInfo = useSelector((state) => state.user.userInfo);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Brain-driven shell (Plan 1): subscribe to TriggerBus + render Orb + Flow.
  const { orbState, queue, activeProposal } = useBrainState();
  const [questMenuAnchor, setQuestMenuAnchor] = useState(null);
  const onOrbClick = async () => {
    const top = queue[0];
    if (top) {
      await triggerBus.accept(top.id);
    } else {
      await triggerBus.pull();
    }
  };
  const onOrbContextMenu = (e) => {
    e.preventDefault();
    setQuestMenuAnchor(e.currentTarget);
  };

  useEffect(() => {
    async function t() {
      const url = await customStorage.getServerUrl();
      setServerUrl(url || '');
    }
    t();

    // Validate session on app startup - sync renderer localStorage with main process session
    const localUserInfo = customStorage.getUserInfo();
    if (localUserInfo && localUserInfo.token) {
      customStorage.validateSession().then((sessionInfo) => {
        if (sessionInfo) {
          // Session is valid - update Redux state
          dispatch(loginHandled(sessionInfo));
        }
        // If invalid, validateSession already cleared localStorage
      });
    }

    // Initialize renderer-side AI provider from saved settings so that
    // components using instanceInRender directly (e.g. Learn About) work
    // immediately on startup without requiring a fresh login or settings save.
    customStorage.setupAiProvider(localUserInfo?.id);

    const handleCustomLink = (event) => {
      console.log('Received in renderer view:', event.data);
    };
    document.addEventListener('mycustomlink', handleCustomLink);
    return () => {
      document.removeEventListener('mycustomlink', handleCustomLink);
    };
  }, [dispatch]);

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleSectionToggle = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const isActive = (path) => {
    return location.pathname.includes(path);
  };

  const renderNavItem = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      style={{ textDecoration: 'none', color: 'inherit' }}
      onClick={() => setDrawerOpen(false)}
    >
      <StyledListItemButton active={isActive(item.path) ? 1 : 0}>
        <ListItemIcon>
          <item.icon sx={{ fontSize: 20 }} />
        </ListItemIcon>
        <ListItemText primary={item.label} />
      </StyledListItemButton>
    </NavLink>
  );

  const renderSection = (title, items, sectionKey, icon) => (
    <Box key={sectionKey} sx={{ mb: 0.5 }}>
      <ListItem disablePadding>
        <ListItemButton
          onClick={() => handleSectionToggle(sectionKey)}
          sx={{
            py: 0.75,
            px: 2,
            '&:hover': { backgroundColor: colors.hover },
          }}
        >
          <ListItemIcon sx={{ color: colors.textMuted, minWidth: 30 }}>
            {icon}
          </ListItemIcon>
          <ListItemText
            primary={title}
            primaryTypographyProps={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          />
          {expandedSections[sectionKey] ? (
            <ExpandLess sx={{ color: colors.textMuted, fontSize: 18 }} />
          ) : (
            <ExpandMore sx={{ color: colors.textMuted, fontSize: 18 }} />
          )}
        </ListItemButton>
      </ListItem>
      <Collapse in={expandedSections[sectionKey]} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          {items.map(renderNavItem)}
        </List>
      </Collapse>
    </Box>
  );

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DrawerHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #2eb67d 0%, #1d9bd1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AutoStoriesIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.95rem',
                lineHeight: 1.2,
                color: '#fff',
              }}
            >
              SmartReader
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: colors.textMuted }}>
              AI Learning
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={handleDrawerToggle}
          sx={{ color: colors.textMuted, p: 0.5 }}
        >
          <ChevronLeftIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </DrawerHeader>

      <Divider sx={{ borderColor: colors.border, mx: 1.5 }} />

      <Box sx={{ py: 1.5, flex: 1, overflow: 'auto' }}>
        {serverUrl && (
          <NavLink
            to="home"
            style={{ textDecoration: 'none', color: 'inherit' }}
            onClick={() => setDrawerOpen(false)}
          >
            <StyledListItemButton active={isActive('home') ? 1 : 0}>
              <ListItemIcon>
                <HomeIcon sx={{ fontSize: 20 }} />
              </ListItemIcon>
              <ListItemText primary="Library (Server)" />
            </StyledListItemButton>
          </NavLink>
        )}

        {renderSection(
          'Reading',
          navItems.reading,
          'reading',
          <LibraryBooksIcon sx={{ fontSize: 16 }} />,
        )}
        {renderSection(
          'Learning',
          navItems.learning,
          'learning',
          <SchoolIcon sx={{ fontSize: 16 }} />,
        )}
        {renderSection(
          'Writing',
          navItems.writing,
          'writing',
          <CreateIcon sx={{ fontSize: 16 }} />,
        )}
        {renderSection(
          'Tools',
          navItems.tools,
          'tools',
          <DashboardIcon sx={{ fontSize: 16 }} />,
        )}
      </Box>

      <Divider sx={{ borderColor: colors.border, mx: 1.5 }} />

      <Box sx={{ p: 1 }}>
        <NavLink
          to="settings"
          style={{ textDecoration: 'none', color: 'inherit' }}
          onClick={() => setDrawerOpen(false)}
        >
          <StyledListItemButton active={isActive('settings') ? 1 : 0}>
            <ListItemIcon>
              <TuneIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText primary="Settings" />
          </StyledListItemButton>
        </NavLink>

        {userInfo && userInfo.token && (
          <StyledListItemButton
            onClick={async () => {
              await customStorage.logout(dispatch);
              navigate('/login');
            }}
          >
            <ListItemIcon>
              <ExitToAppIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </StyledListItemButton>
        )}
      </Box>
    </Box>
  );

  const isLoggedIn = userInfo && userInfo.token;
  const isAuthPage =
    location.pathname === '/login' || location.pathname === '/register';

  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100%' }}>
      <StyledAppBar position="fixed">
        <Toolbar>
          {isLoggedIn && (
            <IconButton
              aria-label="open drawer"
              onClick={handleDrawerToggle}
              edge="start"
              sx={{ mr: 1.5, color: colors.background }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Box
            onClick={() => navigate('/')}
            title="Go to Brain Dashboard"
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              '&:hover': { opacity: 0.85 },
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 1.5,
              }}
            >
              <AutoStoriesIcon sx={{ fontSize: 18, color: '#fff' }} />
            </Box>
            <LogoText variant="h6">SmartReader</LogoText>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          {isLoggedIn && <HeaderQuickActions />}
          {isLoggedIn && (
            <Box sx={{ mr: 1.5 }}>
              <BrainOrb
                state={orbState}
                queueDepth={queue.length}
                onClick={onOrbClick}
                onContextMenu={onOrbContextMenu}
              />
            </Box>
          )}
          {isLoggedIn ? (
            <Tooltip title={userInfo?.username || 'User'}>
              <Avatar
                sx={{
                  bgcolor: colors.primary,
                  width: 32,
                  height: 32,
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {(userInfo?.username || 'U')[0].toUpperCase()}
              </Avatar>
            </Tooltip>
          ) : (
            <>
              <NavLink to="login" style={{ textDecoration: 'none' }}>
                <Tooltip title="Login">
                  <IconButton sx={{ color: colors.background }}>
                    <LoginIcon />
                  </IconButton>
                </Tooltip>
              </NavLink>
              <NavLink to="register" style={{ textDecoration: 'none' }}>
                <Tooltip title="Register">
                  <IconButton sx={{ color: colors.background }}>
                    <HowToRegIcon />
                  </IconButton>
                </Tooltip>
              </NavLink>
            </>
          )}
        </Toolbar>
      </StyledAppBar>

      {isLoggedIn && (
        <StyledDrawer
          variant="temporary"
          anchor="left"
          open={drawerOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
        >
          {drawerContent}
        </StyledDrawer>
      )}

      <MainContent>
        <Toolbar />
        <Box
          className={navigation.state === 'loading' ? 'loading' : ''}
          sx={{
            height: 'calc(100vh - 64px)',
            width: '100%',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            '&::-webkit-scrollbar': { width: 0, background: 'transparent' },
            scrollbarWidth: 'none',
          }}
        >
          {/* Always render the dashboard (Index) when on auth pages */}
          {isAuthPage ? <Index /> : <Outlet />}
        </Box>
      </MainContent>

      {/* Global toast surface — book-indexing progress, etc. */}
      <Toaster position="bottom-right" />

      {/* Brain-driven shell: active Flow renders here (floating overlay). */}
      <FlowCoordinator proposal={activeProposal} />

      {/* Brain-driven shell: right-click Orb opens the Quest menu. */}
      <OrbQuestMenu
        anchorEl={questMenuAnchor}
        onClose={() => setQuestMenuAnchor(null)}
      />

      {/* Login/Register Modal Dialog */}
      <Dialog
        open={isAuthPage}
        onClose={() => navigate('/')}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.25)',
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          },
        }}
      >
        <Outlet />
      </Dialog>
    </Box>
  );
}
