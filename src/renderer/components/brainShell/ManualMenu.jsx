import React, { useState } from 'react';
import { IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';

/**
 * ManualMenu — escape-hatch dropdown listing the 21 routes.
 * Always available regardless of Brain state. Lets the user bypass
 * the Brain and go directly to a known surface.
 *
 * Routes use shallow paths (no params); deep links remain reachable
 * via in-view affordances (e.g., bookshelf → reading/:id).
 */
const ROUTES = [
  { label: 'Library Snapshot (old home)', path: '/library-home' },
  { label: 'Bookshelf', path: '/bookshelf' },
  { label: 'Bookmarks', path: '/bookmarks' },
  { label: 'Notes', path: '/notes' },
  { label: 'Chats', path: '/chats' },
  { label: 'Browser', path: '/browser' },
  { label: 'Vocabulary', path: '/vocabulary' },
  { label: 'Translate', path: '/translate' },
  { label: 'Writing', path: '/writing' },
  { label: 'Grammar', path: '/grammar' },
  { label: 'Quiz', path: '/quiz' },
  { label: 'MoodBoard', path: '/moodboard' },
  { label: 'Learn About', path: '/learnabout' },
  { label: 'Knowledge', path: '/knowledge' },
  { label: 'Study', path: '/study' },
  { label: 'Calendar', path: '/calendar' },
  { label: 'Learning Plan', path: '/learning' },
  { label: 'Settings', path: '/settings' },
];

export default function ManualMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();

  const open = (e) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);
  const go = (path) => {
    close();
    navigate(path);
  };

  return (
    <>
      <Tooltip title="Open route menu">
        <IconButton aria-label="manual route menu" onClick={open} size="small">
          <MenuIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
        {ROUTES.map((r) => (
          <MenuItem key={r.path} onClick={() => go(r.path)}>
            {r.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
