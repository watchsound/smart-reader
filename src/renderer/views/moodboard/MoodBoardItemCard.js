import React, { useState } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

// Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import AutoAwesomeMosaicIcon from '@mui/icons-material/AutoAwesomeMosaic';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboard';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FlashOffIcon from '@mui/icons-material/FlashOff';

import { useDispatch } from 'react-redux';
import { updateMoodBoard } from '../../api/moodBoardApi';
import { moodBoardUpdated } from '../../store/reducers/moodBoardSlice';
import DeleteMoodBoardModal from '../../components/MoodBoard/gridLayout/DeleteMoodBoardModal';
import EditMoodBoardModal from '../../components/MoodBoard/gridLayout/EditMoodBoardModal';

// Color palette for mood board cards
const CARD_COLORS = [
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' },
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' },
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' },
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' },
  { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' },
  { bg: '#E8EAF6', accent: '#3F51B5', icon: '#283593' },
  { bg: '#F1F8E9', accent: '#8BC34A', icon: '#558B2F' },
];

// Dark mode colors
const CARD_COLORS_DARK = [
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  { bg: '#2D1515', accent: '#F44336', icon: '#E57373' },
  { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
  { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
  { bg: '#1A1D2E', accent: '#3F51B5', icon: '#7986CB' },
  { bg: '#1D2A15', accent: '#8BC34A', icon: '#AED581' },
];

// Icons for variety
const BOARD_ICONS = [
  DashboardIcon,
  GridViewIcon,
  ViewQuiltIcon,
  AutoAwesomeMosaicIcon,
  SpaceDashboardIcon,
];

function getColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % CARD_COLORS.length;
}

function getIconForBoard(name) {
  if (!name) return DashboardIcon;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BOARD_ICONS[Math.abs(hash) % BOARD_ICONS.length];
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MoodBoardItemCard({ moodBoard, isActive, isActivePinned, onSelect, onSetActive, onUpdate }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isDark = theme.palette.mode === 'dark';

  const [isHovered, setIsHovered] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');

  const colorPalette = isDark ? CARD_COLORS_DARK : CARD_COLORS;
  const colorIndex = getColorIndex(moodBoard.id || moodBoard.name);
  const colors = colorPalette[colorIndex];
  const IconComponent = getIconForBoard(moodBoard.name);
  const isPinned = moodBoard.pinned;

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleTogglePin = async (event) => {
    event.stopPropagation();
    try {
      const updated = await updateMoodBoard(moodBoard.id, 'pinned', !moodBoard.pinned);
      dispatch(moodBoardUpdated(updated));
      if (onUpdate) onUpdate();
    } catch (error) {
      setAlertContent('Failed to update pin status');
      setAlert(true);
    }
    handleMenuClose();
  };

  const handleEdit = (event) => {
    event?.stopPropagation();
    setOpenEdit(true);
    handleMenuClose();
  };

  const handleDelete = (event) => {
    event?.stopPropagation();
    setOpenDelete(true);
    handleMenuClose();
  };

  const handleCardClick = () => {
    if (onSelect) onSelect(moodBoard);
  };

  return (
    <>
      <Box
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          height: 64,
          borderRadius: '10px',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08)
            : theme.palette.background.paper,
          border: `1px solid ${isActive
            ? alpha(theme.palette.primary.main, 0.4)
            : alpha(theme.palette.divider, 0.08)}`,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateX(4px)',
            boxShadow: isDark
              ? `0 4px 16px ${alpha('#000', 0.4)}`
              : `0 4px 16px ${alpha('#000', 0.08)}`,
            borderColor: alpha(colors.accent, 0.4),
          },
        }}
      >
        {/* Left accent/icon section */}
        <Box
          sx={{
            width: 56,
            minWidth: 56,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            bgcolor: colors.bg,
            borderRadius: '10px 0 0 10px',
          }}
        >
          {/* Left accent stripe */}
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              bgcolor: isActive ? theme.palette.primary.main : colors.accent,
              borderRadius: '10px 0 0 10px',
            }}
          />
          <IconComponent
            sx={{
              fontSize: 24,
              color: colors.icon,
            }}
          />
        </Box>

        {/* Content section */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: 1.5,
            py: 0.75,
            minWidth: 0,
          }}
        >
          {/* Title row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: isActive ? 600 : 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: '0.85rem',
                color: isActive ? theme.palette.primary.main : theme.palette.text.primary,
              }}
            >
              {moodBoard.name || 'Untitled Board'}
            </Typography>
            {isActivePinned && (
              <Tooltip title="Active board — notes from other pages go here">
                <FlashOnIcon
                  sx={{
                    fontSize: 14,
                    color: 'success.main',
                    flexShrink: 0,
                  }}
                />
              </Tooltip>
            )}
            {isPinned && !isHovered && (
              <PushPinIcon
                sx={{
                  fontSize: 14,
                  color: theme.palette.warning.main,
                  flexShrink: 0,
                  transform: 'rotate(45deg)',
                }}
              />
            )}
          </Box>

          {/* Description or meta row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {moodBoard.description ? (
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.7rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {moodBoard.description}
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 11, color: theme.palette.text.disabled }} />
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.disabled, fontSize: '0.68rem' }}
                >
                  {formatDate(moodBoard.createdAt)}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Action buttons */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            pr: 0.5,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          <Tooltip title={isPinned ? 'Unpin' : 'Pin'}>
            <IconButton
              size="small"
              onClick={handleTogglePin}
              sx={{
                p: 0.5,
                '&:hover': {
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                },
              }}
            >
              {isPinned ? (
                <PushPinIcon
                  sx={{ fontSize: 16, color: theme.palette.warning.main, transform: 'rotate(45deg)' }}
                />
              ) : (
                <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={handleMenuClick}
            sx={{ p: 0.5 }}
          >
            <MoreVertIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Right accent edge */}
        <Box
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ flex: 1, bgcolor: colors.accent, opacity: 0.5 }} />
          <Box
            sx={{
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderRight: `4px solid ${theme.palette.background.default}`,
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            minWidth: 180,
            boxShadow: `0 4px 20px ${alpha('#000', isDark ? 0.4 : 0.15)}`,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          },
        }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            if (onSetActive) onSetActive(moodBoard);
          }}
          sx={{ color: isActivePinned ? 'success.main' : undefined }}
        >
          <ListItemIcon>
            {isActivePinned
              ? <FlashOnIcon fontSize="small" sx={{ color: 'success.main' }} />
              : <FlashOffIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{isActivePinned ? 'Active board ✓' : 'Set as active board'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleTogglePin}>
          <ListItemIcon>
            {isPinned ? (
              <PushPinOutlinedIcon fontSize="small" />
            ) : (
              <PushPinIcon fontSize="small" sx={{ transform: 'rotate(45deg)' }} />
            )}
          </ListItemIcon>
          <ListItemText>{isPinned ? 'Unpin' : 'Pin to top'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: theme.palette.error.main }}>
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" sx={{ color: theme.palette.error.main }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Modals */}
      <EditMoodBoardModal
        open={openEdit}
        moodBoard={moodBoard}
        callback={() => {
          setOpenEdit(false);
          if (onUpdate) onUpdate();
        }}
      />
      <DeleteMoodBoardModal
        open={openDelete}
        moodBoard={moodBoard}
        callback={() => {
          setOpenDelete(false);
          if (onUpdate) onUpdate();
        }}
      />

      {/* Error Snackbar */}
      <Snackbar
        open={alert}
        autoHideDuration={4000}
        onClose={() => setAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setAlert(false)}>
          {alertContent}
        </Alert>
      </Snackbar>
    </>
  );
}

export default MoodBoardItemCard;
