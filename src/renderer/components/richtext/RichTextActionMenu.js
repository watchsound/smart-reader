import React, { useState } from 'react';
import {
  Grid,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  IconButton,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import WavesIcon from '@mui/icons-material/Waves';
import BlurCircularIcon from '@mui/icons-material/BlurCircular';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import FlashAutoIcon from '@mui/icons-material/FlashAuto';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import PushPinIcon from '@mui/icons-material/PushPin';
import PasswordIcon from '@mui/icons-material/Password';
import SsidChartIcon from '@mui/icons-material/SsidChart';
import AttractionsIcon from '@mui/icons-material/Attractions';
import LockResetIcon from '@mui/icons-material/LockReset';
import LoginIcon from '@mui/icons-material/Login';
import StarBorderPurple500Icon from '@mui/icons-material/StarBorderPurple500';
import SmallButton from '../Button/SmallButton';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  width: 30,
  height: 30,
  borderRadius: 8,
  transition: 'all 0.15s ease-in-out',
  '& .MuiSvgIcon-root': {
    fontSize: 16,
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.secondary.main, 0.12),
    color: theme.palette.secondary.main,
    transform: 'scale(1.08)',
  },
}));

function RichTextActionMenu({ asIconButton, emphasisCallback, entryCallback }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [emphasisAnchorEl, setEmphasisAnchorEl] = useState(null);
  const [entryAnchorEl, setEntryAnchorEl] = useState(null);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (action, isEntry) => {
    setAnchorEl(null);
    setEmphasisAnchorEl(null);
    setEntryAnchorEl(null);
    if (action) {
      entryCallback(isEntry ? action : '');
      emphasisCallback(isEntry ? '' : action);
    }
  };

  const handelReset = (event) => {
    setEmphasisAnchorEl(null);
    setEntryAnchorEl(null);
    entryCallback('');
    emphasisCallback('');
  };

  const handleEntryOpen = (event) => {
    setEntryAnchorEl(event.currentTarget);
  };

  const handleEmphasisOpen = (event) => {
    setEmphasisAnchorEl(event.currentTarget);
  };

  const handleSubmenuClose = () => {
    setEmphasisAnchorEl(null);
    setEntryAnchorEl(null);
  };

  return (
    <Grid item>
      {asIconButton && (
        <>
          <Tooltip title="Animation Effects">
            <StyledIconButton
              size="small"
              onClick={handleClick}
              aria-label="animation effects"
            >
              <AttractionsIcon />
            </StyledIconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => handleClose(null)}
          >
            <MenuItem onClick={handleEntryOpen}>
              <LoginIcon /> Entry Effects
            </MenuItem>
            <MenuItem onClick={handleEmphasisOpen}>
              <StarBorderPurple500Icon /> Emphasis Effects
            </MenuItem>
            <MenuItem onClick={handelReset}>
              <LockResetIcon /> Reset
            </MenuItem>
          </Menu>
        </>
      )}

      {!asIconButton && (
        <>
          <MenuItem onClick={handleEntryOpen}>
            <LoginIcon /> Entry Effects
          </MenuItem>
          <MenuItem onClick={handleEmphasisOpen}>
            <StarBorderPurple500Icon /> Emphasis Effects
          </MenuItem>
          <MenuItem onClick={handelReset}>
            <LockResetIcon /> Reset
          </MenuItem>
        </>
      )}

      <Menu
        anchorEl={entryAnchorEl}
        open={Boolean(entryAnchorEl)}
        onClose={handleSubmenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={() => handleClose('fade-in', true)}>
          <FlipToBackIcon /> Fade-in
        </MenuItem>
        <MenuItem onClick={() => handleClose('fly-in-left', true)}>
          <KeyboardBackspaceIcon /> Fly-in Left
        </MenuItem>
        <MenuItem onClick={() => handleClose('fly-in-right', true)}>
          <ArrowForwardIcon /> Fly-in Right
        </MenuItem>
        <MenuItem onClick={() => handleClose('fly-in-up', true)}>
          <ArrowUpwardIcon /> Fly-in Up
        </MenuItem>
        <MenuItem onClick={() => handleClose('fly-in-down', true)}>
          <ArrowDownwardIcon /> Fly-in Down
        </MenuItem>
      </Menu>
      <Menu
        anchorEl={emphasisAnchorEl}
        open={Boolean(emphasisAnchorEl)}
        onClose={handleSubmenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <MenuItem onClick={() => handleClose('underline', false)}>
          <FormatUnderlinedIcon /> Underline
        </MenuItem>
        <MenuItem onClick={() => handleClose('apply-wave', false)}>
          <WavesIcon /> Wave
        </MenuItem>
        <MenuItem onClick={() => handleClose('circumscribe', false)}>
          <BlurCircularIcon /> Circumscribe
        </MenuItem>
        <MenuItem onClick={() => handleClose('flash', false)}>
          <FlashAutoIcon /> Flash
        </MenuItem>
        <MenuItem onClick={() => handleClose('focus-on', false)}>
          <CenterFocusStrongIcon /> Focus-on
        </MenuItem>
        <MenuItem onClick={() => handleClose('indicate', false)}>
          <PushPinIcon /> Indicate
        </MenuItem>
        <MenuItem onClick={() => handleClose('show-passing-flash-thin', false)}>
          <PasswordIcon /> Passing-Flash
        </MenuItem>
        <MenuItem onClick={() => handleClose('wiggle', false)}>
          <SsidChartIcon /> Wiggle
        </MenuItem>
      </Menu>
    </Grid>
  );
}

export default RichTextActionMenu;
