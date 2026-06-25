/* eslint-disable prettier/prettier */
import {
  Box,
  CardHeader,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { useState } from 'react';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { styled } from '@mui/material/styles';
import StarHalfIcon from '@mui/icons-material/StarHalf';
import MoveUpIcon from '@mui/icons-material/MoveUp';
import TuneIcon from '@mui/icons-material/Tune';
import DeleteIcon from '@mui/icons-material/Delete';
import LayersIcon from '@mui/icons-material/Layers';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditNoteTwoToneIcon from '@mui/icons-material/EditNoteTwoTone';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import FlashOnIcon from '@mui/icons-material/FlashOn';

import ColorPicker from '../ColorPicker';
import { NoteType } from '../../../commons/model/Note';
import customStorage from '../../store/customStorage';
import { noteToLeitnerAdded } from '../../store/reducers/noteSlice';
import { noteAdded } from '../../store/reducers/moodBoardSlice';
import RichTextActionMenu from '../richtext/RichTextActionMenu';


// Smaller IconButton chrome — 28×28 vs MUI's default 40×40 — so the
// ⋮ menu trigger doesn't occupy a chunky top-right corner of every
// card. Subtle hover background hints at affordance without persistent
// visual weight.
const TopRightButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 10,
  width: 28,
  height: 28,
  padding: 4,
  '& .MuiSvgIcon-root': {
    fontSize: 18,
  },
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

/**
 * Pure: derive the route path for "Jump to source" from a note's source
 * fields, or null when no jump is possible. Reads `sourceType` (NOT
 * `type` — that field is never set by any createNote caller; the old
 * code that read `.type` here silently no-op'd for every note).
 *
 * Exported so the routing rules can be tested without rendering the
 * whole CardHeader + MUI menu chain.
 */
export function getJumpToSourcePath(note) {
  if (!note) return null;
  switch (note.sourceType) {
    case NoteType.Book:
      if (
        note.sourceKey &&
        (note.cfi || (note.position && note.position.length > 0))
      ) {
        return `/reading/${note.sourceKey}/${note.id}`;
      }
      return null;
    case NoteType.Url:
      return note.sourceKey ? `/browser/${note.sourceKey}` : null;
    case NoteType.Chat:
      return note.sourceKey ? `/chat/${note.sourceKey}` : null;
    default:
      return null;
  }
}

function CardHeaderNoSwitch({
  selectedNote,
  toggleAnnotation,
  useJumpToSource,
  colorAction,
  customActionName,
  customAction,
  deleteActionName,
  deleteAction,
  setEmphasis,
  setEntry,
  openCarSettingModal,
  setEditMode,
  deleteNoteAction,
  compact,
  // Hides the "Layout" menu item when explicitly false. Defaults to
  // visible so existing callers (main Notes view, MoodBoard, Leitner,
  // slider) keep the full menu. Reading sidebars (BookNotesPanel,
  // BrowserSidebar) opt out by passing `showLayout={false}` — the
  // Layout/CarSetting modal is for card-design contexts, not browsing.
  showLayout = true,
  // When true, replaces the 3-dot popup with an inline icon toolbar.
  // Used by the Notes Page where the card has enough space to expose
  // actions directly. All other contexts keep the popup menu default.
  toolbarMode = false,
  // When true, the popup menu shows only Jump-to-Source, Add-to-Leitner,
  // Layout, and Edit — drops Annotation toggle, color picker, Add-to-Board,
  // Delete, and Entry/Emphasis/Reset effects. Used by the Leitner page's
  // right-panel notes list where the rest are noise.
  simplifiedMenu = false,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const activeMoodBoardId = useSelector((state) => state.moodBoard.activeMoodBoardId);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const addToLeitnerSystem = async () => {
    const v = await customStorage.addNoteToLeitnerStudy(selectedNote.id);
    dispatch(noteToLeitnerAdded(v));
  };

  const tryToJumpToSource = () => {
    if (!selectedNote) return;
    const path = getJumpToSourcePath(selectedNote);
    if (path) navigate(path);
  };


  if (toolbarMode) {
    return (
      <>
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
          }}
        >
          {useJumpToSource && (
            <Tooltip title="Jump to Source">
              <IconButton size="small" sx={{ width: 28, height: 28 }} onClick={tryToJumpToSource}>
                <MoveUpIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {!selectedNote.leitnerItemId && (
            <Tooltip title="Add to Leitner">
              <IconButton size="small" sx={{ width: 28, height: 28 }} onClick={addToLeitnerSystem}>
                <LocalLibraryIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={activeMoodBoardId ? 'Add to Active Board' : 'Add to Board'}>
            <IconButton
              size="small"
              sx={{ width: 28, height: 28 }}
              onClick={() => {
                dispatch(noteAdded(null));
                dispatch(noteAdded(selectedNote));
                navigate('/moodboard');
              }}
            >
              <FlashOnIcon sx={{ fontSize: 16, color: activeMoodBoardId ? 'success.main' : 'text.disabled' }} />
            </IconButton>
          </Tooltip>
          {showLayout && (
            <Tooltip title="Layout">
              <IconButton size="small" sx={{ width: 28, height: 28 }} onClick={() => openCarSettingModal(true)}>
                <DashboardIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" sx={{ width: 28, height: 28 }} onClick={() => setEditMode(true)}>
              <EditNoteTwoToneIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Note">
            <IconButton size="small" sx={{ width: 28, height: 28 }} onClick={() => deleteNoteAction(selectedNote)}>
              <DeleteForeverOutlinedIcon sx={{ fontSize: 16, color: 'error.main' }} />
            </IconButton>
          </Tooltip>
        </Box>
        {!compact && selectedNote.title && (
          <CardHeader
            title={selectedNote.title}
            titleTypographyProps={{ variant: 'h8' }}
            sx={{ margin: '0px !important', paddingBottom: '0px !important' }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <TopRightButton aria-label="settings" onClick={handleMenuOpen}>
        <MoreVertIcon />
      </TopRightButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
       { useJumpToSource && (
        <MenuItem
          onClick={() => {
            handleMenuClose();
            tryToJumpToSource();
          }}
        >
          <ListItemIcon>
            <MoveUpIcon />
          </ListItemIcon>
          <ListItemText> Jump To Source </ListItemText>
        </MenuItem>
       )}

        {!simplifiedMenu && toggleAnnotation && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              toggleAnnotation();
            }}
          >
            <ListItemIcon>
              <StarHalfIcon />
            </ListItemIcon>
            <ListItemText> Annotation </ListItemText>
          </MenuItem>
        )}
       { !simplifiedMenu && colorAction && (
        <MenuItem>
          <ColorPicker
            getInitialSelection={() => null}
            selectionCallback={(color) => {
              handleMenuClose();
              colorAction(color);
            }}
            orientation="horizontal"
          />
        </MenuItem>
       )}

        {!simplifiedMenu && customActionName && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              customAction(selectedNote);
            }}
          >
            <ListItemIcon>
              <LayersIcon />
            </ListItemIcon>
            <ListItemText> {customActionName} </ListItemText>
          </MenuItem>
        )}
        {(simplifiedMenu || !selectedNote.leitnerItemId) && (
          <MenuItem
            onClick={() => {
              addToLeitnerSystem();
              handleMenuClose();
            }}
          >
            <ListItemIcon>
              <LocalLibraryIcon />
            </ListItemIcon>
            <ListItemText>Add To Leitner System</ListItemText>
          </MenuItem>
        )}

        {!simplifiedMenu && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              dispatch(noteAdded(null));
              dispatch(noteAdded(selectedNote));
              navigate('/moodboard');
            }}
          >
            <ListItemIcon>
              <FlashOnIcon fontSize="small" sx={{ color: activeMoodBoardId ? 'success.main' : 'text.disabled' }} />
            </ListItemIcon>
            <ListItemText>
              {activeMoodBoardId ? 'Add to Active Board' : 'Add to Board (open MoodBoard first)'}
            </ListItemText>
          </MenuItem>
        )}

        {!simplifiedMenu && deleteActionName && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              deleteAction(selectedNote);
            }}
          >
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText> {deleteActionName} </ListItemText>
          </MenuItem>
        )}

        {showLayout && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              openCarSettingModal(true);
            }}
          >
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText>Layout</ListItemText>
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            handleMenuClose();
            setEditMode(true);
          }}
        >
          <ListItemIcon>
            <EditNoteTwoToneIcon />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>

        {!simplifiedMenu && (
          <MenuItem
            onClick={() => {
              handleMenuClose();
              deleteNoteAction(selectedNote);
            }}
          >
            <ListItemIcon>
              <DeleteForeverOutlinedIcon />
            </ListItemIcon>
            <ListItemText>Delete Note</ListItemText>
          </MenuItem>
        )}

        { !simplifiedMenu && setEmphasis && setEntry && (
          <RichTextActionMenu
          asIconButton={false}
          emphasisCallback={setEmphasis}
          entryCallback={setEntry}
          />
        )}

      </Menu>
      {!compact && selectedNote.title && (
        <CardHeader
          title={selectedNote.title}
          titleTypographyProps={{ variant: 'h8' }}
          sx={{ margin: '0px !important', paddingBottom: '0px !important' }}
        />
      )}

    </>
  );
}

export default CardHeaderNoSwitch;
