/* eslint-disable prettier/prettier */
import {
  CardHeader,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
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
import {  useDispatch } from 'react-redux';
import LocalLibraryIcon from '@mui/icons-material/LocalLibrary';
import DashboardIcon from '@mui/icons-material/Dashboard';
import EditNoteTwoToneIcon from '@mui/icons-material/EditNoteTwoTone';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';

import ColorPicker from '../ColorPicker';
import { NoteType } from '../../../commons/model/Note';
import customStorage from '../../store/customStorage';
import { noteToLeitnerAdded } from '../../store/reducers/noteSlice';
import RichTextActionMenu from '../richtext/RichTextActionMenu';


const TopRightButton = styled(IconButton)({
  position: 'absolute',
  top: 0,
  right: 0,
  zIndex: 10,
});

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
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

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

        {toggleAnnotation && (
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
       { colorAction && (
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

        {customActionName && (
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
        {!selectedNote.leitnerItemId && (
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

        {deleteActionName && (
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

        { setEmphasis && setEntry && (
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
